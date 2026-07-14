import assert from "node:assert/strict";
import test from "node:test";
import Database from "better-sqlite3";
import { createAsaasCreationIntentStore, initializeAsaasCreationIntentSchema } from "../dist/asaas-intents.mjs";
import { createAsaasCustomerLinkStore } from "../dist/asaas-customer-links.mjs";
import { ensureAsaasCustomerForDesmanche, ensureAsaasCustomerForGuincho } from "../dist/asaas-customer-service.mjs";
import { hashAsaasCreationParameters } from "../dist/asaas-idempotency.mjs";

const desmancheId = "123e4567-e89b-12d3-a456-426614174000";
const guinchoId = "123e4567-e89b-12d3-a456-426614174001";
const customerIntentHash = hashAsaasCreationParameters({ resourceType: "customer", entityType: "desmanche", entityId: desmancheId, operationKey: "customer", externalReference: `cdd:c:d:${desmancheId}` });

function fixture({ type = "desmanche", localCustomerId = null, reference = { ok: true, data: [] }, document = { ok: true, data: [] }, created = { ok: true, customer: { id: "cus_created" } } } = {}) {
  const sqlite = new Database(":memory:");
  sqlite.exec(`
    CREATE TABLE desmanche_billing (id TEXT PRIMARY KEY, desmanche_id TEXT UNIQUE, billing_model TEXT, plan_id TEXT, monthly_transaction_count INTEGER DEFAULT 0, monthly_amount_paid REAL DEFAULT 0, current_period_start INTEGER, asaas_customer_id TEXT);
    CREATE TABLE guinchos (id TEXT PRIMARY KEY, asaas_customer_id TEXT, asaas_payment_id TEXT, asaas_subscription_id TEXT, plan TEXT, status TEXT);
  `);
  initializeAsaasCreationIntentSchema(sqlite);
  if (type === "desmanche") sqlite.prepare("INSERT INTO desmanche_billing VALUES ('billing', ?, 'subscription', 'plan_existing', 7, 99.5, 123, ?)").run(desmancheId, localCustomerId);
  if (type === "guincho") sqlite.prepare("INSERT INTO guinchos VALUES (?, ?, 'pay_existing', 'sub_existing', 'monthly', 'active')").run(guinchoId, localCustomerId);
  const intents = createAsaasCreationIntentStore(sqlite);
  const links = createAsaasCustomerLinkStore(sqlite);
  const calls = { reference: 0, document: 0, post: 0 };
  const deps = {
    async getDesmanche(id) { return id === desmancheId ? { id, name: "Empresa", email: "no-log@example.test", phone: "11999999999", cpfCnpj: "00.000.000/0001-00" } : null; },
    async getGuincho(id) { return id === guinchoId ? { id, name: "Guincho", email: "no-log@example.test", phone: "11999999999", cpfCnpj: "000.000.000-00", asaasCustomerId: localCustomerId } : null; },
    async getDesmancheCustomerId(id) { return (sqlite.prepare("SELECT asaas_customer_id AS id FROM desmanche_billing WHERE desmanche_id = ?").get(id)?.id) ?? null; },
    createOrGetIntent: intents.createOrGetAsaasCreationIntent,
    claimIntent: intents.claimAsaasCreationIntent,
    markAmbiguous: intents.markAsaasCreationIntentAmbiguous,
    markFailed: intents.markAsaasCreationIntentFailed,
    completeDesmanche: links.completeDesmanche,
    completeGuincho: links.completeGuincho,
    async listByExternalReference() { calls.reference++; return typeof reference === "function" ? reference() : reference; },
    async listByCpfCnpj() { calls.document++; return typeof document === "function" ? document() : document; },
    async createCustomer() { calls.post++; return typeof created === "function" ? created() : created; },
  };
  return { sqlite, intents, links, deps, calls, run: () => type === "desmanche" ? ensureAsaasCustomerForDesmanche(desmancheId, deps) : ensureAsaasCustomerForGuincho(guinchoId, deps) };
}

test("serviço reutiliza ID local sem rede e preserva campos Asaas do guincho", async (t) => {
  const d = fixture({ localCustomerId: "cus_local" }); t.after(() => d.sqlite.close());
  assert.deepEqual(await d.run(), { outcome: "ready", customerId: "cus_local" });
  assert.deepEqual(d.calls, { reference: 0, document: 0, post: 0 });
  const g = fixture({ type: "guincho", reference: { ok: true, data: [{ id: "cus_remote" }] } }); t.after(() => g.sqlite.close());
  assert.deepEqual(await g.run(), { outcome: "ready", customerId: "cus_remote" });
  assert.deepEqual(g.sqlite.prepare("SELECT asaas_customer_id, asaas_payment_id, asaas_subscription_id, plan, status FROM guinchos WHERE id = ?").get(guinchoId), { asaas_customer_id: "cus_remote", asaas_payment_id: "pay_existing", asaas_subscription_id: "sub_existing", plan: "monthly", status: "active" });
});

test("serviço pesquisa referência, documento e só então faz um POST", async (t) => {
  const byRef = fixture({ reference: { ok: true, data: [{ id: "cus_ref" }] } }); t.after(() => byRef.sqlite.close());
  assert.deepEqual(await byRef.run(), { outcome: "ready", customerId: "cus_ref" });
  assert.deepEqual(byRef.calls, { reference: 1, document: 0, post: 0 });
  const byDoc = fixture({ document: { ok: true, data: [{ id: "cus_doc" }] } }); t.after(() => byDoc.sqlite.close());
  assert.deepEqual(await byDoc.run(), { outcome: "ready", customerId: "cus_doc" });
  assert.deepEqual(byDoc.calls, { reference: 1, document: 1, post: 0 });
  const newCustomer = fixture(); t.after(() => newCustomer.sqlite.close());
  assert.deepEqual(await newCustomer.run(), { outcome: "ready", customerId: "cus_created" });
  assert.deepEqual(newCustomer.calls, { reference: 1, document: 1, post: 1 });
  assert.equal(newCustomer.sqlite.prepare("SELECT asaas_customer_id AS id FROM desmanche_billing WHERE desmanche_id = ?").get(desmancheId).id, "cus_created");
  const intent = newCustomer.sqlite.prepare("SELECT parameter_hash, external_reference, status FROM asaas_creation_intents").get();
  assert.equal(intent.status, "created");
  assert.equal(Object.values(intent).join(" ").includes("000000"), false);
  assert.equal(Object.values(intent).join(" ").includes("no-log"), false);
});

test("duplicidades e falhas de GET ficam ambíguas e nunca fazem POST", async (t) => {
  for (const opts of [
    { reference: { ok: true, data: [{ id: "a" }, { id: "b" }] } },
    { document: { ok: true, data: [{ id: "a" }, { id: "b" }] } },
    { reference: { ok: false, errorType: "timeout" } },
    { document: { ok: false, errorType: "network" } },
  ]) {
    const f = fixture(opts); t.after(() => f.sqlite.close());
    assert.equal((await f.run()).outcome, "ambiguous");
    assert.equal(f.calls.post, 0);
  }
});

test("POST ambíguo, HTTP 5xx, 4xx e resposta inválida têm estados seguros", async (t) => {
  for (const [created, outcome] of [
    [{ ok: false, errorType: "timeout" }, "ambiguous"],
    [{ ok: false, errorType: "http", statusCode: 500 }, "ambiguous"],
    [{ ok: false, errorType: "invalid_response" }, "ambiguous"],
    [{ ok: false, errorType: "http", statusCode: 400, errorCode: "ASAAS_CUSTOMER_VALIDATION" }, "failed"],
  ]) {
    const f = fixture({ created }); t.after(() => f.sqlite.close());
    assert.equal((await f.run()).outcome, outcome);
    assert.equal(f.calls.post, 1);
  }
});

test("intenções created são reaplicadas, conflitos não sobrescrevem e lease evita corrida", async (t) => {
  const created = fixture(); t.after(() => created.sqlite.close());
  const intent = created.intents.createOrGetAsaasCreationIntent({ intentId: "123e4567-e89b-12d3-a456-426614174099", resourceType: "customer", entityType: "desmanche", entityId: desmancheId, operationKey: "customer", externalReference: `cdd:c:d:${desmancheId}`, parameterHash: customerIntentHash });
  created.intents.claimAsaasCreationIntent({ intentId: intent.intentId, leaseOwner: "worker", leaseDurationSeconds: 45 });
  created.intents.markAsaasCreationIntentCreated({ intentId: intent.intentId, leaseOwner: "worker", asaasResourceId: "cus_recovered" });
  assert.deepEqual(await created.run(), { outcome: "ready", customerId: "cus_recovered" });
  assert.deepEqual(created.calls, { reference: 0, document: 0, post: 0 });
  assert.equal(created.sqlite.prepare("SELECT asaas_customer_id AS id FROM desmanche_billing WHERE desmanche_id = ?").get(desmancheId).id, "cus_recovered");

  const busy = fixture(); t.after(() => busy.sqlite.close());
  const b = busy.intents.createOrGetAsaasCreationIntent({ intentId: "123e4567-e89b-12d3-a456-426614174098", resourceType: "customer", entityType: "desmanche", entityId: desmancheId, operationKey: "customer", externalReference: `cdd:c:d:${desmancheId}`, parameterHash: customerIntentHash });
  busy.intents.claimAsaasCreationIntent({ intentId: b.intentId, leaseOwner: "other", leaseDurationSeconds: 45 });
  assert.deepEqual(await busy.run(), { outcome: "busy" });
  assert.equal(busy.calls.post, 0);
  busy.sqlite.prepare("UPDATE asaas_creation_intents SET lease_expires_at = 0 WHERE intent_id = ?").run(b.intentId);
  assert.deepEqual(await busy.run(), { outcome: "ready", customerId: "cus_created" });
  assert.equal(busy.calls.post, 1);
});

test("recupera após POST remoto bem-sucedido e falha antes do commit local sem repetir POST", async (t) => {
  let remoteCustomerIsVisible = false;
  const f = fixture({
    reference: () => remoteCustomerIsVisible
      ? { ok: true, data: [{ id: "cus_remote_after_crash" }] }
      : { ok: true, data: [] },
    created: { ok: true, customer: { id: "cus_remote_after_crash" } },
  });
  t.after(() => f.sqlite.close());
  f.sqlite.exec(`CREATE TRIGGER reject_first_local_customer_link
    BEFORE UPDATE OF asaas_customer_id ON desmanche_billing
    BEGIN SELECT RAISE(ABORT, 'simulated local crash'); END;`);

  await assert.rejects(() => f.run(), /simulated local crash/);
  assert.deepEqual(f.calls, { reference: 1, document: 1, post: 1 });
  assert.equal(f.sqlite.prepare("SELECT asaas_customer_id FROM desmanche_billing WHERE desmanche_id = ?").get(desmancheId).asaas_customer_id, null);
  assert.deepEqual(f.sqlite.prepare("SELECT status, asaas_resource_id FROM asaas_creation_intents").get(), {
    status: "creating", asaas_resource_id: null,
  });

  f.sqlite.exec("DROP TRIGGER reject_first_local_customer_link");
  f.sqlite.prepare("UPDATE asaas_creation_intents SET lease_expires_at = 0").run();
  remoteCustomerIsVisible = true;

  assert.deepEqual(await f.run(), { outcome: "ready", customerId: "cus_remote_after_crash" });
  assert.deepEqual(f.calls, { reference: 2, document: 1, post: 1 });
  assert.equal(f.sqlite.prepare("SELECT asaas_customer_id FROM desmanche_billing WHERE desmanche_id = ?").get(desmancheId).asaas_customer_id, "cus_remote_after_crash");
  assert.deepEqual(f.sqlite.prepare("SELECT status, asaas_resource_id FROM asaas_creation_intents").get(), {
    status: "created", asaas_resource_id: "cus_remote_after_crash",
  });
});

test("dois workers concorrentes executam no máximo um POST", async (t) => {
  const f = fixture({ created: async () => { await new Promise((resolve) => setTimeout(resolve, 5)); return { ok: true, customer: { id: "cus_once" } }; } });
  t.after(() => f.sqlite.close());
  const results = await Promise.all([f.run(), f.run()]);
  assert.equal(results.filter((result) => result.outcome === "ready").length, 1);
  assert.equal(results.filter((result) => result.outcome === "busy").length, 1);
  assert.equal(f.calls.post, 1);
});

test("retry de estado ambíguo pesquisa novamente antes de POST e conflito local não sobrescreve", async (t) => {
  let firstLookup = true;
  const retry = fixture({ reference: () => firstLookup ? (firstLookup = false, { ok: false, errorType: "timeout" }) : { ok: true, data: [] } });
  t.after(() => retry.sqlite.close());
  assert.equal((await retry.run()).outcome, "ambiguous");
  assert.equal(retry.calls.post, 0);
  assert.deepEqual(await retry.run(), { outcome: "ready", customerId: "cus_created" });
  assert.equal(retry.calls.reference, 2);
  assert.equal(retry.calls.document, 1);
  assert.equal(retry.calls.post, 1);

  let conflict;
  const f = fixture({ reference: () => {
    f.sqlite.prepare("UPDATE desmanche_billing SET asaas_customer_id = 'cus_other' WHERE desmanche_id = ?").run(desmancheId);
    return { ok: true, data: [{ id: "cus_remote" }] };
  } });
  conflict = await f.run();
  t.after(() => f.sqlite.close());
  assert.deepEqual(conflict, { outcome: "conflict" });
  assert.equal(f.sqlite.prepare("SELECT asaas_customer_id AS id FROM desmanche_billing WHERE desmanche_id = ?").get(desmancheId).id, "cus_other");
  assert.equal(f.calls.post, 0);
});

test("conflito de chave da intenção retorna conflict sem consulta ou POST Asaas", async (t) => {
  for (const kind of ["composite", "externalReference"]) {
    const f = fixture();
    t.after(() => f.sqlite.close());
    if (kind === "composite") {
      f.intents.createOrGetAsaasCreationIntent({
        intentId: "123e4567-e89b-12d3-a456-426614174010",
        resourceType: "customer", entityType: "desmanche", entityId: desmancheId, operationKey: "customer",
        externalReference: "cdd:c:d:other-reference",
        parameterHash: "a".repeat(64),
      });
    } else {
      f.intents.createOrGetAsaasCreationIntent({
        intentId: "123e4567-e89b-12d3-a456-426614174011",
        resourceType: "customer", entityType: "guincho", entityId: "other-guincho", operationKey: "customer",
        externalReference: `cdd:c:d:${desmancheId}`,
        parameterHash: "b".repeat(64),
      });
    }
    assert.deepEqual(await f.run(), { outcome: "conflict" });
    assert.deepEqual(f.calls, { reference: 0, document: 0, post: 0 });
  }
});

test("erros inesperados da criação de intenção não são convertidos em conflict", async (t) => {
  const f = fixture();
  t.after(() => f.sqlite.close());
  f.deps.createOrGetIntent = () => { throw new Error("unexpected store failure"); };
  await assert.rejects(() => f.run(), /unexpected store failure/);
  assert.deepEqual(f.calls, { reference: 0, document: 0, post: 0 });
});

test("finalizador desmanche exige billing existente e só vincula customerId", (t) => {
  const f = fixture();
  t.after(() => f.sqlite.close());
  const intent = f.intents.createOrGetAsaasCreationIntent({
    intentId: "123e4567-e89b-12d3-a456-426614174012", resourceType: "customer", entityType: "desmanche", entityId: desmancheId,
    operationKey: "customer", externalReference: `cdd:c:d:${desmancheId}`, parameterHash: customerIntentHash,
  });
  f.intents.claimAsaasCreationIntent({ intentId: intent.intentId, leaseOwner: "worker", leaseDurationSeconds: 45 });
  f.sqlite.prepare("DELETE FROM desmanche_billing WHERE desmanche_id = ?").run(desmancheId);
  assert.deepEqual(f.links.completeDesmanche({ intentId: intent.intentId, desmancheId, leaseOwner: "worker", customerId: "cus_missing" }), { outcome: "not_found" });
  assert.equal(f.sqlite.prepare("SELECT status FROM asaas_creation_intents WHERE intent_id = ?").get(intent.intentId).status, "creating");

  f.sqlite.prepare("INSERT INTO desmanche_billing VALUES ('restored', ?, 'per_transaction', 'plan_keep', 8, 123.45, 456, NULL)").run(desmancheId);
  assert.deepEqual(f.links.completeDesmanche({ intentId: intent.intentId, desmancheId, leaseOwner: "worker", customerId: "cus_linked" }), { outcome: "linked", customerId: "cus_linked" });
  assert.deepEqual(f.sqlite.prepare("SELECT billing_model, plan_id, monthly_transaction_count, monthly_amount_paid, current_period_start, asaas_customer_id FROM desmanche_billing WHERE desmanche_id = ?").get(desmancheId), {
    billing_model: "per_transaction", plan_id: "plan_keep", monthly_transaction_count: 8, monthly_amount_paid: 123.45, current_period_start: 456, asaas_customer_id: "cus_linked",
  });
  assert.deepEqual(f.sqlite.prepare("SELECT status, asaas_resource_id, lease_owner FROM asaas_creation_intents WHERE intent_id = ?").get(intent.intentId), {
    status: "created", asaas_resource_id: "cus_linked", lease_owner: null,
  });
});

test("falha no vínculo desfaz também a finalização da intenção", (t) => {
  const f = fixture();
  t.after(() => f.sqlite.close());
  const intent = f.intents.createOrGetAsaasCreationIntent({
    intentId: "123e4567-e89b-12d3-a456-426614174013", resourceType: "customer", entityType: "desmanche", entityId: desmancheId,
    operationKey: "customer", externalReference: `cdd:c:d:${desmancheId}`, parameterHash: customerIntentHash,
  });
  f.intents.claimAsaasCreationIntent({ intentId: intent.intentId, leaseOwner: "worker", leaseDurationSeconds: 45 });
  f.sqlite.exec(`CREATE TRIGGER reject_customer_link BEFORE UPDATE OF asaas_customer_id ON desmanche_billing
    BEGIN SELECT RAISE(ABORT, 'link rejected'); END;`);
  assert.throws(() => f.links.completeDesmanche({ intentId: intent.intentId, desmancheId, leaseOwner: "worker", customerId: "cus_rejected" }), /link rejected/);
  assert.deepEqual(f.sqlite.prepare("SELECT status, asaas_resource_id FROM asaas_creation_intents WHERE intent_id = ?").get(intent.intentId), {
    status: "creating", asaas_resource_id: null,
  });
  assert.equal(f.sqlite.prepare("SELECT asaas_customer_id FROM desmanche_billing WHERE desmanche_id = ?").get(desmancheId).asaas_customer_id, null);
});

test("finalizadores não retornam linked quando UPDATE do vínculo ou da intenção altera zero linhas", (t) => {
  for (const type of ["desmanche", "guincho"]) {
    const entityId = type === "desmanche" ? desmancheId : guinchoId;
    const externalReference = type === "desmanche" ? `cdd:c:d:${entityId}` : `cdd:c:g:${entityId}`;
    const parameterHash = hashAsaasCreationParameters({ resourceType: "customer", entityType: type, entityId, operationKey: "customer", externalReference });
    const complete = (f, intentId, customerId) => type === "desmanche"
      ? f.links.completeDesmanche({ intentId, desmancheId: entityId, leaseOwner: "worker", customerId })
      : f.links.completeGuincho({ intentId, guinchoId: entityId, leaseOwner: "worker", customerId });
    const table = type === "desmanche" ? "desmanche_billing" : "guinchos";
    const idColumn = type === "desmanche" ? "desmanche_id" : "id";

    const linkSkipped = fixture({ type });
    t.after(() => linkSkipped.sqlite.close());
    const linkIntent = linkSkipped.intents.createOrGetAsaasCreationIntent({
      intentId: `123e4567-e89b-12d3-a456-42661417402${type === "desmanche" ? "0" : "1"}`,
      resourceType: "customer", entityType: type, entityId, operationKey: "customer", externalReference, parameterHash,
    });
    linkSkipped.intents.claimAsaasCreationIntent({ intentId: linkIntent.intentId, leaseOwner: "worker", leaseDurationSeconds: 45 });
    linkSkipped.sqlite.exec(`CREATE TRIGGER skip_customer_link BEFORE UPDATE OF asaas_customer_id ON ${table} BEGIN SELECT RAISE(IGNORE); END;`);
    assert.deepEqual(complete(linkSkipped, linkIntent.intentId, "cus_no_link"), { outcome: "conflict" });
    assert.deepEqual(linkSkipped.sqlite.prepare("SELECT status, asaas_resource_id FROM asaas_creation_intents WHERE intent_id = ?").get(linkIntent.intentId), {
      status: "creating", asaas_resource_id: null,
    });
    assert.equal(linkSkipped.sqlite.prepare(`SELECT asaas_customer_id FROM ${table} WHERE ${idColumn} = ?`).get(entityId).asaas_customer_id, null);

    const finalizationSkipped = fixture({ type });
    t.after(() => finalizationSkipped.sqlite.close());
    const finalizationIntent = finalizationSkipped.intents.createOrGetAsaasCreationIntent({
      intentId: `123e4567-e89b-12d3-a456-42661417402${type === "desmanche" ? "2" : "3"}`,
      resourceType: "customer", entityType: type, entityId, operationKey: "customer", externalReference, parameterHash,
    });
    finalizationSkipped.intents.claimAsaasCreationIntent({ intentId: finalizationIntent.intentId, leaseOwner: "worker", leaseDurationSeconds: 45 });
    finalizationSkipped.sqlite.exec(`CREATE TRIGGER skip_intent_finalization
      BEFORE UPDATE OF status ON asaas_creation_intents WHEN NEW.status = 'created'
      BEGIN SELECT RAISE(IGNORE); END;`);
    assert.throws(() => complete(finalizationSkipped, finalizationIntent.intentId, "cus_no_finalization"), /did not update exactly one row/);
    assert.deepEqual(finalizationSkipped.sqlite.prepare("SELECT status, asaas_resource_id FROM asaas_creation_intents WHERE intent_id = ?").get(finalizationIntent.intentId), {
      status: "creating", asaas_resource_id: null,
    });
    assert.equal(finalizationSkipped.sqlite.prepare(`SELECT asaas_customer_id FROM ${table} WHERE ${idColumn} = ?`).get(entityId).asaas_customer_id, null);
  }
});
