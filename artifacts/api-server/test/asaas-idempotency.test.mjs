import assert from "node:assert/strict";
import http from "node:http";
import net from "node:net";
import test from "node:test";
import Database from "better-sqlite3";
import {
  asaasExternalReferences,
  assertAsaasExternalReference,
  hashAsaasCreationParameters,
} from "../dist/asaas-idempotency.mjs";
import {
  AsaasCreationIntentConflictError,
  createAsaasCreationIntentStore,
  initializeAsaasCreationIntentSchema,
} from "../dist/asaas-intents.mjs";
import {
  createAsaasCharge,
  createAsaasCustomer,
  createAsaasCustomerDetailed,
  createAsaasSubscription,
  listAsaasCustomersByCpfCnpj,
  listAsaasCustomersByExternalReference,
  listAsaasPaymentsByExternalReference,
  listAsaasSubscriptionsByExternalReference,
  setAsaasBaseUrlForTests,
  setAsaasConfig,
} from "../dist/asaas.mjs";

const uuid = "123e4567-e89b-12d3-a456-426614174000";
const otherUuid = "123e4567-e89b-12d3-a456-426614174001";

function intentInput(overrides = {}) {
  return {
    intentId: uuid,
    resourceType: "payment",
    entityType: "billing_transaction",
    entityId: otherUuid,
    operationKey: "charge",
    externalReference: asaasExternalReferences.billingTransactionPayment(otherUuid),
    parameterHash: hashAsaasCreationParameters({ amountCents: 2500, dueDate: "2030-01-01" }),
    ...overrides,
  };
}

function temporaryStore() {
  const sqlite = new Database(":memory:");
  sqlite.exec("CREATE TABLE billing_transactions (id TEXT PRIMARY KEY, amount REAL NOT NULL)");
  initializeAsaasCreationIntentSchema(sqlite);
  return { sqlite, store: createAsaasCreationIntentStore(sqlite) };
}

function startServer(t, handler) {
  const server = http.createServer(handler);
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      t.after(() => new Promise((done, fail) => server.close((error) => error ? fail(error) : done())));
      resolve("http://127.0.0.1:" + port);
    });
  });
}

function refusedUrl() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close((error) => error ? reject(error) : resolve("http://127.0.0.1:" + port));
    });
  });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.setEncoding("utf8");
    req.on("data", (chunk) => { body += chunk; });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

test("migração de intenções é aditiva e idempotente", () => {
  const sqlite = new Database(":memory:");
  sqlite.exec("CREATE TABLE billing_transactions (id TEXT PRIMARY KEY, amount REAL NOT NULL); INSERT INTO billing_transactions VALUES ('old', 42)");
  initializeAsaasCreationIntentSchema(sqlite);
  initializeAsaasCreationIntentSchema(sqlite);

  const table = sqlite.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'asaas_creation_intents'").get();
  assert.ok(table.sql.includes("external_reference TEXT NOT NULL UNIQUE"));
  const columns = sqlite.prepare("PRAGMA table_info(billing_transactions)").all().map((row) => row.name);
  assert.ok(columns.includes("asaas_creation_intent_id"));
  assert.deepEqual(sqlite.prepare("SELECT id, amount FROM billing_transactions").get(), { id: "old", amount: 42 });
  const indexes = sqlite.prepare("SELECT name FROM sqlite_master WHERE type = 'index'").all().map((row) => row.name);
  for (const index of [
    "idx_asaas_creation_intents_status", "idx_asaas_creation_intents_lease_expires_at",
    "idx_asaas_creation_intents_entity", "idx_asaas_creation_intents_asaas_resource_id",
    "idx_billing_transactions_creation_intent",
  ]) assert.ok(indexes.includes(index));
  sqlite.close();
});

test("referências externas são determinísticas, preservam IDs e rejeitam entradas inválidas", () => {
  const references = [
    asaasExternalReferences.desmancheCustomer(uuid),
    asaasExternalReferences.guinchoCustomer(uuid),
    asaasExternalReferences.billingTransactionPayment(uuid),
    asaasExternalReferences.monthlyConsolidatedPayment(uuid),
    asaasExternalReferences.guinchoAnnualPayment(uuid),
    asaasExternalReferences.guinchoMonthlySubscription(uuid),
  ];
  assert.deepEqual(references, [
    `cdd:c:d:${uuid}`, `cdd:c:g:${uuid}`, `cdd:p:bt:${uuid}`,
    `cdd:p:mc:${uuid}`, `cdd:p:g:${uuid}:annual`, `cdd:s:g:${uuid}:p:monthly`,
  ]);
  for (const reference of references) assert.ok(reference.length <= 100);
  assert.equal(asaasExternalReferences.desmancheCustomer(uuid), asaasExternalReferences.desmancheCustomer(uuid));
  assert.throws(() => asaasExternalReferences.desmancheCustomer(""), /must not be empty/);
  assert.throws(() => asaasExternalReferences.guinchoCustomer("with space"), /whitespace/);
  assert.throws(() => assertAsaasExternalReference("x".repeat(101)), /at most 100/);
  assert.throws(() => assertAsaasExternalReference("  "), /blank/);
});

test("hash canônico ordena chaves e rejeita valores fora de JSON", () => {
  assert.equal(
    hashAsaasCreationParameters({ z: [2, { b: true, a: null }], a: "x" }),
    hashAsaasCreationParameters({ a: "x", z: [2, { a: null, b: true }] }),
  );
  assert.notEqual(hashAsaasCreationParameters({ amount: 1 }), hashAsaasCreationParameters({ amount: 2 }));
  for (const value of [{ a: undefined }, { a: () => {} }, { a: NaN }, { a: Infinity }]) {
    assert.throws(() => hashAsaasCreationParameters(value), /Cannot hash/);
  }
});

test("createOrGet preserva estado, detecta conflitos e serializa criação simulada", () => {
  const { sqlite, store } = temporaryStore();
  const input = intentInput();
  const first = store.createOrGetAsaasCreationIntent(input);
  const repeated = store.createOrGetAsaasCreationIntent(input);
  assert.equal(first.intentId, repeated.intentId);
  const retriedWithNewIntentId = store.createOrGetAsaasCreationIntent({ ...input, intentId: "123e4567-e89b-12d3-a456-426614174099" });
  assert.equal(retriedWithNewIntentId.intentId, first.intentId);
  assert.equal(first.status, "pending");
  assert.throws(() => store.createOrGetAsaasCreationIntent({ ...input, parameterHash: hashAsaasCreationParameters({ changed: true }) }), AsaasCreationIntentConflictError);
  assert.throws(() => store.createOrGetAsaasCreationIntent({ ...input, intentId: otherUuid, entityId: uuid }), AsaasCreationIntentConflictError);

  const concurrent = intentInput({ intentId: "123e4567-e89b-12d3-a456-426614174002", entityId: "123e4567-e89b-12d3-a456-426614174003", externalReference: "cdd:p:bt:123e4567-e89b-12d3-a456-426614174003" });
  const results = [store.createOrGetAsaasCreationIntent(concurrent), store.createOrGetAsaasCreationIntent(concurrent)];
  assert.equal(results[0].intentId, results[1].intentId);
  assert.equal(sqlite.prepare("SELECT COUNT(*) AS count FROM asaas_creation_intents WHERE intent_id = ?").get(concurrent.intentId).count, 1);
  sqlite.close();
});

test("claim, lease e transições terminais são atômicos", (t) => {
  const { sqlite, store } = temporaryStore();
  const originalNow = Date.now;
  let now = 2_000_000_000_000;
  Date.now = () => now;
  t.after(() => { Date.now = originalNow; sqlite.close(); });
  const input = intentInput();
  store.createOrGetAsaasCreationIntent(input);
  assert.equal(store.claimAsaasCreationIntent({ intentId: input.intentId, leaseOwner: "worker-a", leaseDurationSeconds: 15 }).outcome, "claimed");
  assert.equal(store.claimAsaasCreationIntent({ intentId: input.intentId, leaseOwner: "worker-b", leaseDurationSeconds: 15 }).outcome, "busy");
  now += 16_000;
  assert.equal(store.claimAsaasCreationIntent({ intentId: input.intentId, leaseOwner: "worker-b", leaseDurationSeconds: 15 }).outcome, "claimed");
  assert.equal(store.markAsaasCreationIntentCreated({ intentId: input.intentId, leaseOwner: "worker-a", asaasResourceId: "pay_a" }).outcome, "conflict");
  assert.equal(store.markAsaasCreationIntentAmbiguous({ intentId: input.intentId, leaseOwner: "worker-b", errorCode: "NETWORK_TIMEOUT" }).outcome, "marked");
  assert.equal(store.claimAsaasCreationIntent({ intentId: input.intentId, leaseOwner: "worker-c", leaseDurationSeconds: 15 }).outcome, "claimed");
  assert.equal(store.markAsaasCreationIntentCreated({ intentId: input.intentId, leaseOwner: "worker-c", asaasResourceId: "pay_a" }).outcome, "marked");
  const created = store.claimAsaasCreationIntent({ intentId: input.intentId, leaseOwner: "worker-d", leaseDurationSeconds: 15 });
  assert.equal(created.outcome, "created");
  assert.equal(created.asaasResourceId, "pay_a");
  assert.equal(store.markAsaasCreationIntentCreated({ intentId: input.intentId, leaseOwner: "worker-c", asaasResourceId: "pay_b" }).outcome, "conflict");
  assert.equal(store.getAsaasCreationIntent({ intentId: input.intentId }).asaasResourceId, "pay_a");

  const failed = intentInput({ intentId: "123e4567-e89b-12d3-a456-426614174010", entityId: "123e4567-e89b-12d3-a456-426614174011", externalReference: "cdd:p:bt:123e4567-e89b-12d3-a456-426614174011" });
  store.createOrGetAsaasCreationIntent(failed);
  store.claimAsaasCreationIntent({ intentId: failed.intentId, leaseOwner: "worker-f", leaseDurationSeconds: 15 });
  assert.equal(store.markAsaasCreationIntentFailed({ intentId: failed.intentId, leaseOwner: "worker-f", errorCode: "HTTP_400" }).outcome, "marked");
  assert.equal(store.getAsaasCreationIntent({ externalReference: failed.externalReference }).status, "failed");
  assert.throws(() => store.claimAsaasCreationIntent({ intentId: failed.intentId, leaseOwner: "bad owner", leaseDurationSeconds: 15 }), /whitespace/);
});

test("GETs Asaas paginam, classificam falhas e POSTs mantêm compatibilidade", async (t) => {
  const seen = [];
  const calls = new Map();
  const baseUrl = await startServer(t, async (req, res) => {
    calls.set(req.url, (calls.get(req.url) ?? 0) + 1);
    const url = new URL(req.url, "http://local");
    if (url.pathname.startsWith("/slow")) return setTimeout(() => res.end(JSON.stringify({ data: [], hasMore: false })), 100);
    if (url.pathname.startsWith("/http400")) { res.writeHead(400); return res.end("bad"); }
    if (url.pathname.startsWith("/http500")) { res.writeHead(500); return res.end("bad"); }
    if (url.pathname === "/invalid/payments") return res.end("not json");
    if (url.pathname === "/inconsistent/payments") return res.end(JSON.stringify({ data: [], hasMore: true }));
    if (req.method === "POST") {
      seen.push({ path: url.pathname, body: JSON.parse(await readBody(req)) });
      res.writeHead(200, { "content-type": "application/json" });
      return res.end(JSON.stringify({ id: "asaas_test", status: "PENDING", invoiceUrl: "http://local/invoice" }));
    }
    if (url.pathname === "/customers") {
      assert.equal(url.searchParams.get("externalReference"), "cdd:c:d:test-id");
      assert.equal(url.searchParams.get("cpfCnpj"), "00000000000");
      return res.end(JSON.stringify({ data: [{ id: "cus_1", externalReference: "cdd:c:d:test-id" }], hasMore: false }));
    }
    if (url.pathname === "/payments") {
      const offset = Number(url.searchParams.get("offset"));
      return res.end(JSON.stringify(offset === 0
        ? { data: [{ id: "pay_1", value: 10, customer: "cus_1" }], hasMore: true }
        : { data: [{ id: "pay_2", dueDate: "2030-01-01", status: "PENDING" }], hasMore: false }));
    }
    if (url.pathname === "/subscriptions") return res.end(JSON.stringify({ data: [], hasMore: false }));
    res.writeHead(404); res.end();
  });
  t.after(() => setAsaasBaseUrlForTests(undefined));
  setAsaasConfig("test-key", "sandbox");
  setAsaasBaseUrlForTests(baseUrl);

  assert.deepEqual(await listAsaasCustomersByExternalReference("cdd:c:d:test-id", { cpfCnpj: "00000000000" }), { ok: true, data: [{ id: "cus_1", externalReference: "cdd:c:d:test-id" }] });
  const payments = await listAsaasPaymentsByExternalReference("cdd:p:bt:test", { limit: 1 });
  assert.equal(payments.ok, true);
  assert.equal(payments.data.length, 2);
  assert.deepEqual(await listAsaasSubscriptionsByExternalReference("cdd:s:g:test:p:monthly"), { ok: true, data: [] });

  setAsaasBaseUrlForTests(baseUrl + "/http400");
  assert.deepEqual(await listAsaasPaymentsByExternalReference("cdd:p:bt:test"), { ok: false, errorType: "http", statusCode: 400 });
  setAsaasBaseUrlForTests(baseUrl + "/http500");
  assert.deepEqual(await listAsaasSubscriptionsByExternalReference("cdd:s:g:test:p:monthly"), { ok: false, errorType: "http", statusCode: 500 });
  setAsaasBaseUrlForTests(baseUrl + "/invalid");
  assert.deepEqual(await listAsaasPaymentsByExternalReference("cdd:p:bt:test"), { ok: false, errorType: "invalid_response" });
  setAsaasBaseUrlForTests(baseUrl + "/inconsistent");
  assert.deepEqual(await listAsaasPaymentsByExternalReference("cdd:p:bt:test"), { ok: false, errorType: "invalid_response" });
  setAsaasBaseUrlForTests(await refusedUrl());
  assert.deepEqual(await listAsaasPaymentsByExternalReference("cdd:p:bt:test"), { ok: false, errorType: "network" });

  const originalTimeout = AbortSignal.timeout;
  t.after(() => { AbortSignal.timeout = originalTimeout; });
  AbortSignal.timeout = () => originalTimeout(10);
  setAsaasBaseUrlForTests(baseUrl + "/slow");
  assert.deepEqual(await listAsaasPaymentsByExternalReference("cdd:p:bt:test"), { ok: false, errorType: "timeout" });
  assert.equal(calls.get("/slow/payments?externalReference=cdd%3Ap%3Abt%3Atest&limit=100&offset=0"), 1);
  AbortSignal.timeout = originalTimeout;

  setAsaasBaseUrlForTests(baseUrl);
  await createAsaasCustomer({ name: "Test", email: "test@example.test", phone: "11999999999", cpfCnpj: "00000000000" });
  await createAsaasCharge({ customerId: "cus_1", value: 10, dueDate: "2030-01-01", description: "Test", billingType: "PIX", externalReference: "cdd:p:bt:test" });
  await createAsaasSubscription({ customerId: "cus_1", value: 10, nextDueDate: "2030-01-01", description: "Test", billingType: "PIX", cycle: "MONTHLY", externalReference: "cdd:s:g:test:p:monthly" });
  assert.equal(Object.hasOwn(seen[0].body, "externalReference"), false);
  assert.equal(seen[1].body.externalReference, "cdd:p:bt:test");
  assert.equal(seen[2].body.externalReference, "cdd:s:g:test:p:monthly");
  const beforeInvalid = seen.length;
  await assert.rejects(() => createAsaasCharge({ customerId: "cus_1", value: 10, dueDate: "2030-01-01", description: "Test", billingType: "PIX", externalReference: "bad ref" }), /whitespace/);
  assert.equal(seen.length, beforeInvalid);
});

test("consulta de clientes por CPF/CNPJ usa somente query normalizada e pagina", async (t) => {
  const seen = [];
  const baseUrl = await startServer(t, (req, res) => {
    const url = new URL(req.url, "http://local");
    seen.push(url);
    assert.equal(url.pathname, "/customers");
    assert.equal(url.searchParams.get("externalReference"), null);
    assert.equal(url.searchParams.get("cpfCnpj"), "00000000000");
    const offset = Number(url.searchParams.get("offset"));
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify(offset === 0
      ? { data: [{ id: "cus_doc_1" }], hasMore: true }
      : { data: [{ id: "cus_doc_2" }], hasMore: false }));
  });
  t.after(() => setAsaasBaseUrlForTests(undefined));
  setAsaasConfig("test-key", "sandbox");
  setAsaasBaseUrlForTests(baseUrl);
  assert.deepEqual(await listAsaasCustomersByCpfCnpj("000.000.000-00", { limit: 1 }), { ok: true, data: [{ id: "cus_doc_1" }, { id: "cus_doc_2" }] });
  assert.equal(seen.length, 2);
});

test("POST detalhado classifica resposta sem retornar payload do provedor", async (t) => {
  const baseUrl = await startServer(t, async (req, res) => {
    await readBody(req);
    res.writeHead(400, { "content-type": "application/json" });
    res.end(JSON.stringify({ issues: [{ description: "dado privado" }] }));
  });
  t.after(() => setAsaasBaseUrlForTests(undefined));
  setAsaasConfig("test-key", "sandbox");
  setAsaasBaseUrlForTests(baseUrl);
  assert.deepEqual(await createAsaasCustomerDetailed({ name: "Teste", email: "test@example.test", phone: "11999999999", cpfCnpj: "00000000000", externalReference: "cdd:c:d:test-id" }), { ok: false, errorType: "http", statusCode: 400, errorCode: "ASAAS_CUSTOMER_VALIDATION" });
});
