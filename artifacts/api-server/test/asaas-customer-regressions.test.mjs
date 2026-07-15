import assert from "node:assert/strict";
import http from "node:http";
import net from "node:net";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import jwt from "jsonwebtoken";
import Database from "better-sqlite3";
import test from "node:test";
import { hashAsaasCreationParameters } from "../dist/asaas-idempotency.mjs";

const apiDir = path.resolve(import.meta.dirname, "..");
const jwtSecret = "12345678901234567890123456789012";

function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close((error) => error ? reject(error) : resolve(port));
    });
  });
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function startServer(t, handler, { asaasConfigured = true } = {}) {
  const directory = await mkdtemp(path.join(tmpdir(), "api-server-asaas-regression-"));
  const asaasServer = http.createServer(handler);
  await new Promise((resolve, reject) => {
    asaasServer.once("error", reject);
    asaasServer.listen(0, "127.0.0.1", resolve);
  });
  const asaasPort = asaasServer.address().port;
  const port = await freePort();
  const serverProcess = spawn(process.execPath, ["--enable-source-maps", "./dist/index.mjs"], {
    cwd: apiDir,
    env: {
      ...process.env,
      NODE_ENV: "test",
      PORT: String(port),
      JWT_SECRET: jwtSecret,
      DATABASE_PATH: path.join(directory, "database.sqlite"),
      UPLOADS_DIR: path.join(directory, "uploads"),
      ...(asaasConfigured ? { ASAAS_API_KEY: "temporary-test-key" } : {}),
      ASAAS_BASE_URL_FOR_TESTS: `http://127.0.0.1:${asaasPort}`,
    },
    stdio: "ignore",
  });
  let processExit;
  const processExited = new Promise((resolve) => {
    serverProcess.once("exit", (code, signal) => {
      processExit = { code, signal };
      resolve(processExit);
    });
    serverProcess.once("error", () => {
      processExit = { code: serverProcess.exitCode, signal: serverProcess.signalCode };
      resolve(processExit);
    });
  });
  const processHasExited = () => processExit || serverProcess.exitCode !== null || serverProcess.signalCode !== null;
  const processExitError = () => {
    const { code, signal } = processExit ?? { code: serverProcess.exitCode, signal: serverProcess.signalCode };
    return new Error(`test server process exited before /healthz responded (exit code: ${code ?? "null"}, signal: ${signal ?? "none"})`);
  };
  t.after(async () => {
    try {
      if (!processHasExited()) {
        try {
          serverProcess.kill();
        } catch (error) {
          if (error?.code !== "ESRCH") throw error;
        }
        await processExited;
      }
    } finally {
      try {
        await new Promise((resolve, reject) => asaasServer.close((error) => error ? reject(error) : resolve()));
      } finally {
        await rm(directory, { recursive: true, force: true });
      }
    }
  });
  const endpoint = `http://127.0.0.1:${port}`;
  const startupDeadline = Date.now() + 14_000;
  while (Date.now() < startupDeadline) {
    if (processHasExited()) throw processExitError();
    const remaining = startupDeadline - Date.now();
    const result = await Promise.race([
      fetch(`${endpoint}/healthz`, { signal: AbortSignal.timeout(Math.min(1_000, remaining)) })
        .then((response) => response.ok)
        .catch(() => false),
      processExited.then(() => "process-exited"),
    ]);
    if (result === "process-exited" || processHasExited()) throw processExitError();
    if (result) {
      return {
        endpoint,
        filename: path.join(directory, "database.sqlite"),
        directory,
        asaasBaseUrl: `http://127.0.0.1:${asaasPort}`,
        serverProcess,
        processExited,
      };
    }
    const retryDelay = Math.min(50, startupDeadline - Date.now());
    if (retryDelay > 0) {
      const retryResult = await Promise.race([delay(retryDelay), processExited.then(() => "process-exited")]);
      if (retryResult === "process-exited" || processHasExited()) throw processExitError();
    }
  }
  if (processHasExited()) throw processExitError();
  throw new Error("test server did not respond to /healthz within 14 seconds");
}

function token(id, type) {
  return jwt.sign({ id, type }, jwtSecret, { expiresIn: "5m" });
}

function customerHash(entityType, entityId, externalReference) {
  return hashAsaasCreationParameters({ resourceType: "customer", entityType, entityId, operationKey: "customer", externalReference });
}

function paymentReference(transactionId) {
  return `cdd:p:bt:${transactionId}`;
}

function paymentHash(transactionId, dueDate = "2030-01-03") {
  const externalReference = paymentReference(transactionId);
  return hashAsaasCreationParameters({
    resourceType: "payment", entityType: "billing_transaction", entityId: transactionId,
    operationKey: "charge", externalReference, customerId: "cus_manual", amountCents: 2500,
    dueDate, billingType: "UNDEFINED",
  });
}

let desmancheSequence = 0;
function insertDesmanche(sqlite, id) {
  sqlite.prepare("INSERT INTO desmanches (id, company_name, trading_name, cnpj, email, phone, password) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .run(id, "Desmanche", "Desmanche", String(++desmancheSequence).padStart(14, "0"), `${id}@example.test`, "11999999999", "hash");
}

function insertReviewNegotiation(sqlite, { desmancheId, clientId, negotiationId, status = "negotiating", deadline = null }) {
  sqlite.prepare("INSERT INTO users (id, name, email, phone, password, type) VALUES (?, 'Client', ?, '11999999999', 'hash', 'client')")
    .run(clientId, `${clientId}@example.test`);
  sqlite.prepare("INSERT INTO orders (id, title, description, vehicle_brand, vehicle_model, vehicle_year, location, client_id) VALUES (?, 'Order', 'Description', 'Brand', 'Model', 2020, 'São Paulo', ?)")
    .run(`order-${negotiationId}`, clientId);
  sqlite.prepare("INSERT INTO proposals (id, order_id, desmanche_id, price, message) VALUES (?, ?, ?, 100, 'Proposal')")
    .run(`proposal-${negotiationId}`, `order-${negotiationId}`, desmancheId);
  sqlite.prepare(`INSERT INTO negotiations (id, order_id, proposal_id, client_id, desmanche_id, price, status, review_deadline_at)
    VALUES (?, ?, ?, ?, ?, 100, ?, ?)`)
    .run(negotiationId, `order-${negotiationId}`, `proposal-${negotiationId}`, clientId, desmancheId, status, deadline);
}

function insertCustomerIntent(sqlite, { entityType = "desmanche", entityId, externalReference, status = "creating", parameterHash, leaseOwner = "other" }) {
  sqlite.prepare(`INSERT INTO asaas_creation_intents (
    intent_id, resource_type, entity_type, entity_id, operation_key, external_reference, status,
    asaas_resource_id, parameter_hash, lease_owner, lease_expires_at, last_error_code, created_at, updated_at
  ) VALUES (?, 'customer', ?, ?, 'customer', ?, ?, NULL, ?, ?, ?, NULL, 1, 1)`).run(
    `intent-${entityId}`, entityType, entityId, externalReference, status, parameterHash, leaseOwner, status === "creating" ? 4_000_000_000 : null,
  );
}

function insertPaymentIntent(sqlite, { transactionId, status, leaseOwner = "other" }) {
  const intentId = `intent-payment-${transactionId}`;
  const hasLease = status === "creating";
  sqlite.prepare("UPDATE billing_transactions SET asaas_due_date = '2030-01-03', asaas_creation_intent_id = ? WHERE id = ?").run(intentId, transactionId);
  sqlite.prepare(`INSERT INTO asaas_creation_intents (
    intent_id, resource_type, entity_type, entity_id, operation_key, external_reference, status,
    asaas_resource_id, parameter_hash, lease_owner, lease_expires_at, last_error_code, created_at, updated_at
  ) VALUES (?, 'payment', 'billing_transaction', ?, 'charge', ?, ?, NULL, ?, ?, ?, NULL, 1, 1)`).run(
    intentId, transactionId, paymentReference(transactionId), status, paymentHash(transactionId),
    hasLease ? leaseOwner : null, hasLease ? 4_000_000_000 : null,
  );
}

test("billing/setup grava o modelo escolhido antes do cliente e preserva customer existente", async (t) => {
  const calls = { customers: 0, payments: 0 };
  const { endpoint, filename } = await startServer(t, (req, res) => {
    const url = new URL(req.url, "http://local");
    if (url.pathname === "/customers" && req.method === "GET") {
      calls.customers++;
      const ref = url.searchParams.get("externalReference");
      if (ref?.includes("ambiguous")) { res.writeHead(500); return res.end(); }
      res.setHeader("content-type", "application/json");
      return res.end(JSON.stringify({ data: [], hasMore: false }));
    }
    if (url.pathname === "/customers" && req.method === "POST") {
      calls.customers++;
      let body = "";
      req.on("data", (chunk) => { body += chunk; });
      return req.on("end", () => {
        if (body.includes("failed")) { res.writeHead(400); return res.end("{}"); }
        res.setHeader("content-type", "application/json");
        res.end(JSON.stringify({ id: "cus_created" }));
      });
    }
    if (url.pathname === "/payments") calls.payments++;
    res.writeHead(404); res.end();
  });
  const sqlite = new Database(filename);
  t.after(() => sqlite.close());
  sqlite.prepare("INSERT INTO subscription_plans (id, name, price) VALUES ('plan-1', 'Plano teste', 10)").run();
  const readyModels = ["subscription", "per_transaction", "monthly_cycle"];
  for (const model of readyModels) {
    const id = `ready-${model}`;
    insertDesmanche(sqlite, id);
    const response = await fetch(`${endpoint}/api/billing/setup`, {
      method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${token(id, "desmanche")}` },
      body: JSON.stringify({ billingModel: model, planId: model === "subscription" ? "plan-1" : undefined }),
    });
    assert.equal(response.status, 200);
    const billing = sqlite.prepare("SELECT billing_model, plan_id, asaas_customer_id FROM desmanche_billing WHERE desmanche_id = ?").get(id);
    assert.equal(billing.billing_model, model);
    assert.equal(billing.asaas_customer_id, "cus_created");
  }

  const existingId = "ready-existing";
  insertDesmanche(sqlite, existingId);
  sqlite.prepare("INSERT INTO desmanche_billing (id, desmanche_id, billing_model, plan_id, monthly_transaction_count, monthly_amount_paid, current_period_start, asaas_customer_id) VALUES ('existing', ?, 'monthly_cycle', 'plan-1', 4, 50, 123, 'cus_existing')").run(existingId);
  const repeated = await fetch(`${endpoint}/api/billing/setup`, {
    method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${token(existingId, "desmanche")}` },
    body: JSON.stringify({ billingModel: "per_transaction" }),
  });
  assert.equal(repeated.status, 200);
  assert.deepEqual(sqlite.prepare("SELECT billing_model, plan_id, monthly_transaction_count, monthly_amount_paid, current_period_start, asaas_customer_id FROM desmanche_billing WHERE desmanche_id = ?").get(existingId), {
    billing_model: "per_transaction", plan_id: null, monthly_transaction_count: 4, monthly_amount_paid: 50, current_period_start: 123, asaas_customer_id: "cus_existing",
  });

  for (const outcome of ["busy", "ambiguous", "failed", "conflict"]) {
    const id = `setup-${outcome}`;
    const ref = `cdd:c:d:${id}`;
    insertDesmanche(sqlite, id);
    if (outcome === "busy") insertCustomerIntent(sqlite, { entityId: id, externalReference: ref, parameterHash: customerHash("desmanche", id, ref) });
    if (outcome === "conflict") insertCustomerIntent(sqlite, { entityType: "guincho", entityId: `other-${id}`, externalReference: ref, parameterHash: "f".repeat(64) });
    const response = await fetch(`${endpoint}/api/billing/setup`, {
      method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${token(id, "desmanche")}` },
      body: JSON.stringify({ billingModel: "per_transaction" }),
    });
    assert.equal(response.status, outcome === "ambiguous" ? 503 : outcome === "failed" ? 422 : 409);
    const billing = sqlite.prepare("SELECT billing_model, asaas_customer_id FROM desmanche_billing WHERE desmanche_id = ?").get(id);
    assert.deepEqual(billing, { billing_model: "per_transaction", asaas_customer_id: null });
  }
  assert.equal(calls.payments, 0);
});

test("per_transaction registra pendência local uma vez quando o cliente não está ready", async (t) => {
  const calls = { payments: 0 };
  const { endpoint, filename } = await startServer(t, (req, res) => {
    const url = new URL(req.url, "http://local");
    if (url.pathname === "/customers" && req.method === "GET") {
      if (url.searchParams.get("externalReference")?.includes("ambiguous")) { res.writeHead(500); return res.end(); }
      res.setHeader("content-type", "application/json"); return res.end(JSON.stringify({ data: [], hasMore: false }));
    }
    if (url.pathname === "/customers" && req.method === "POST") { res.writeHead(400); return res.end("{}"); }
    if (url.pathname === "/payments" && req.method === "POST") calls.payments++;
    res.writeHead(404); res.end();
  });
  const sqlite = new Database(filename);
  t.after(() => sqlite.close());
  for (const outcome of ["busy", "ambiguous", "failed", "conflict"]) {
    const desmancheId = `transaction-${outcome}`;
    const clientId = `client-${outcome}`;
    const negotiationId = `negotiation-${outcome}`;
    insertDesmanche(sqlite, desmancheId);
    sqlite.prepare("INSERT INTO desmanche_billing (id, desmanche_id, billing_model) VALUES (?, ?, 'per_transaction')").run(`billing-${outcome}`, desmancheId);
    sqlite.prepare("INSERT INTO users (id, name, email, phone, password, type) VALUES (?, 'Client', ?, '11999999999', 'hash', 'client')").run(clientId, `${clientId}@example.test`);
    sqlite.prepare("INSERT INTO orders (id, title, description, vehicle_brand, vehicle_model, vehicle_year, location, client_id) VALUES (?, 'Order', 'Description', 'Brand', 'Model', 2020, 'São Paulo', ?)").run(`order-${outcome}`, clientId);
    sqlite.prepare("INSERT INTO proposals (id, order_id, desmanche_id, price, message) VALUES (?, ?, ?, 100, 'Proposal')").run(`proposal-${outcome}`, `order-${outcome}`, desmancheId);
    sqlite.prepare("INSERT INTO negotiations (id, order_id, proposal_id, client_id, desmanche_id, price) VALUES (?, ?, ?, ?, ?, 100)").run(negotiationId, `order-${outcome}`, `proposal-${outcome}`, clientId, desmancheId);
    const ref = `cdd:c:d:${desmancheId}`;
    if (outcome === "busy") insertCustomerIntent(sqlite, { entityId: desmancheId, externalReference: ref, parameterHash: customerHash("desmanche", desmancheId, ref) });
    if (outcome === "conflict") insertCustomerIntent(sqlite, { entityType: "guincho", entityId: `other-${outcome}`, externalReference: ref, parameterHash: "e".repeat(64) });
    const body = { negotiationId, clientId, desmancheId, rating: 5, comment: "ok" };
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const response = await fetch(`${endpoint}/api/reviews`, {
        method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${token(clientId, "client")}` }, body: JSON.stringify(body),
      });
      assert.equal(response.status, 201);
    }
    assert.deepEqual(sqlite.prepare("SELECT count(*) AS count, min(status) AS status, min(asaas_charge_id) AS asaas_charge_id, min(payment_link) AS payment_link FROM billing_transactions WHERE negotiation_id = ?").get(negotiationId), {
      count: 1, status: "pending", asaas_charge_id: null, payment_link: null,
    });
    assert.deepEqual(sqlite.prepare("SELECT monthly_transaction_count, monthly_amount_paid FROM desmanche_billing WHERE desmanche_id = ?").get(desmancheId), {
      monthly_transaction_count: 1, monthly_amount_paid: 25,
    });
  }
  assert.equal(calls.payments, 0);
});

test("per_transaction persiste antes de GET/POST, não repete rede e preserva conclusão quando falha", async (t) => {
  const calls = { get: 0, post: 0 };
  let sqlite;
  const { endpoint, filename } = await startServer(t, (req, res) => {
    const url = new URL(req.url, "http://local");
    if (url.pathname === "/payments" && req.method === "GET") {
      calls.get++;
      if (calls.get > 1) { res.writeHead(500); return res.end(); }
      const local = sqlite.prepare("SELECT status, asaas_charge_id FROM billing_transactions WHERE negotiation_id = 'neg-ready'").get();
      assert.deepEqual(local, { status: "pending", asaas_charge_id: null });
      res.setHeader("content-type", "application/json");
      return res.end(JSON.stringify({ data: [], hasMore: false }));
    }
    if (url.pathname === "/payments" && req.method === "POST") {
      calls.post++;
      const local = sqlite.prepare("SELECT status, asaas_creation_intent_id, asaas_due_date FROM billing_transactions WHERE negotiation_id = 'neg-ready'").get();
      assert.equal(local.status, "pending"); assert.ok(local.asaas_creation_intent_id); assert.match(local.asaas_due_date, /^\d{4}-\d{2}-\d{2}$/);
      res.setHeader("content-type", "application/json");
      return res.end(JSON.stringify({ id: "pay-ready" }));
    }
    res.writeHead(404); res.end();
  });
  sqlite = new Database(filename); t.after(() => sqlite.close());
  insertDesmanche(sqlite, "auto-ready");
  sqlite.prepare("INSERT INTO desmanche_billing (id, desmanche_id, billing_model, asaas_customer_id) VALUES ('billing-ready', 'auto-ready', 'per_transaction', 'cus_ready')").run();
  insertReviewNegotiation(sqlite, { desmancheId: "auto-ready", clientId: "client-ready", negotiationId: "neg-ready" });
  const review = () => fetch(`${endpoint}/api/reviews`, {
    method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${token("client-ready", "client")}` },
    body: JSON.stringify({ negotiationId: "neg-ready", clientId: "client-ready", desmancheId: "auto-ready", rating: 5, comment: "ok" }),
  });

  assert.equal((await review()).status, 201);
  assert.deepEqual(calls, { get: 1, post: 1 });
  assert.deepEqual(sqlite.prepare("SELECT monthly_transaction_count, monthly_amount_paid FROM desmanche_billing WHERE desmanche_id = 'auto-ready'").get(), {
    monthly_transaction_count: 1, monthly_amount_paid: 25,
  });
  assert.deepEqual(sqlite.prepare("SELECT status, asaas_charge_id FROM billing_transactions WHERE negotiation_id = 'neg-ready'").get(), {
    status: "pending", asaas_charge_id: "pay-ready",
  });

  // Repeated business events reuse the durable row and never invoke Asaas.
  assert.equal((await review()).status, 201);
  assert.deepEqual(calls, { get: 1, post: 1 });

  // A newly created exempt row must also stop before the first Asaas GET/POST.
  insertDesmanche(sqlite, "auto-exempt-configured");
  sqlite.prepare("INSERT INTO desmanche_billing (id, desmanche_id, billing_model, monthly_amount_paid, asaas_customer_id) VALUES ('billing-exempt-configured', 'auto-exempt-configured', 'per_transaction', 350, 'cus_exempt')").run();
  insertReviewNegotiation(sqlite, { desmancheId: "auto-exempt-configured", clientId: "client-exempt-configured", negotiationId: "neg-exempt-configured" });
  const exemptReview = await fetch(`${endpoint}/api/reviews`, {
    method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${token("client-exempt-configured", "client")}` },
    body: JSON.stringify({ negotiationId: "neg-exempt-configured", clientId: "client-exempt-configured", desmancheId: "auto-exempt-configured", rating: 5, comment: "ok" }),
  });
  assert.equal(exemptReview.status, 201);
  assert.deepEqual(calls, { get: 1, post: 1 });
  assert.deepEqual(sqlite.prepare("SELECT status, amount, asaas_charge_id FROM billing_transactions WHERE negotiation_id = 'neg-exempt-configured'").get(), {
    status: "exempt", amount: 0, asaas_charge_id: null,
  });

  // A GET failure after local creation is non-critical to the principal review.
  insertDesmanche(sqlite, "auto-ambiguous");
  sqlite.prepare("INSERT INTO desmanche_billing (id, desmanche_id, billing_model, asaas_customer_id) VALUES ('billing-ambiguous', 'auto-ambiguous', 'per_transaction', 'cus_ambiguous')").run();
  insertReviewNegotiation(sqlite, { desmancheId: "auto-ambiguous", clientId: "client-ambiguous", negotiationId: "neg-ambiguous" });
  const failingReview = await fetch(`${endpoint}/api/reviews`, {
    method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${token("client-ambiguous", "client")}` },
    body: JSON.stringify({ negotiationId: "neg-ambiguous", clientId: "client-ambiguous", desmancheId: "auto-ambiguous", rating: 5, comment: "ok" }),
  });
  assert.equal(failingReview.status, 201);
});

test("per_transaction isento ou sem Asaas cria somente o estado local", async (t) => {
  const calls = { payments: 0 };
  const { endpoint, filename } = await startServer(t, (req, res) => {
    if (new URL(req.url, "http://local").pathname === "/payments") calls.payments++;
    res.writeHead(404); res.end();
  }, { asaasConfigured: false });
  const sqlite = new Database(filename); t.after(() => sqlite.close());
  insertDesmanche(sqlite, "auto-exempt");
  sqlite.prepare("INSERT INTO desmanche_billing (id, desmanche_id, billing_model, monthly_amount_paid) VALUES ('billing-exempt', 'auto-exempt', 'per_transaction', 350)").run();
  insertReviewNegotiation(sqlite, { desmancheId: "auto-exempt", clientId: "client-exempt", negotiationId: "neg-exempt" });
  const response = await fetch(`${endpoint}/api/reviews`, {
    method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${token("client-exempt", "client")}` },
    body: JSON.stringify({ negotiationId: "neg-exempt", clientId: "client-exempt", desmancheId: "auto-exempt", rating: 5, comment: "ok" }),
  });
  assert.equal(response.status, 201);
  assert.deepEqual(sqlite.prepare("SELECT status, amount, asaas_charge_id FROM billing_transactions WHERE negotiation_id = 'neg-exempt'").get(), {
    status: "exempt", amount: 0, asaas_charge_id: null,
  });
  assert.deepEqual(sqlite.prepare("SELECT monthly_transaction_count, monthly_amount_paid FROM desmanche_billing WHERE desmanche_id = 'auto-exempt'").get(), {
    monthly_transaction_count: 0, monthly_amount_paid: 350,
  });
  assert.equal(calls.payments, 0);

  insertDesmanche(sqlite, "auto-unconfigured");
  sqlite.prepare("INSERT INTO desmanche_billing (id, desmanche_id, billing_model) VALUES ('billing-unconfigured', 'auto-unconfigured', 'per_transaction')").run();
  insertReviewNegotiation(sqlite, { desmancheId: "auto-unconfigured", clientId: "client-unconfigured", negotiationId: "neg-unconfigured" });
  const unconfigured = await fetch(`${endpoint}/api/reviews`, {
    method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${token("client-unconfigured", "client")}` },
    body: JSON.stringify({ negotiationId: "neg-unconfigured", clientId: "client-unconfigured", desmancheId: "auto-unconfigured", rating: 5, comment: "ok" }),
  });
  assert.equal(unconfigured.status, 201);
  assert.deepEqual(sqlite.prepare("SELECT status, amount, asaas_charge_id FROM billing_transactions WHERE negotiation_id = 'neg-unconfigured'").get(), {
    status: "pending", amount: 25, asaas_charge_id: null,
  });
  assert.equal(calls.payments, 0);
});

test("dois gatilhos automáticos concorrentes criam uma linha e no máximo um POST", async (t) => {
  const calls = { get: 0, post: 0 };
  const { endpoint, filename } = await startServer(t, (req, res) => {
    const url = new URL(req.url, "http://local");
    if (url.pathname === "/payments" && req.method === "GET") {
      calls.get++;
      return setTimeout(() => {
        res.setHeader("content-type", "application/json");
        res.end(JSON.stringify({ data: [], hasMore: false }));
      }, 40);
    }
    if (url.pathname === "/payments" && req.method === "POST") {
      calls.post++;
      res.setHeader("content-type", "application/json");
      return res.end(JSON.stringify({ id: "pay-concurrent" }));
    }
    res.writeHead(404); res.end();
  });
  const sqlite = new Database(filename); t.after(() => sqlite.close());
  insertDesmanche(sqlite, "auto-concurrent");
  sqlite.prepare("INSERT INTO desmanche_billing (id, desmanche_id, billing_model, asaas_customer_id) VALUES ('billing-concurrent', 'auto-concurrent', 'per_transaction', 'cus_concurrent')").run();
  insertReviewNegotiation(sqlite, { desmancheId: "auto-concurrent", clientId: "client-concurrent", negotiationId: "neg-concurrent" });
  const review = () => fetch(`${endpoint}/api/reviews`, {
    method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${token("client-concurrent", "client")}` },
    body: JSON.stringify({ negotiationId: "neg-concurrent", clientId: "client-concurrent", desmancheId: "auto-concurrent", rating: 5, comment: "ok" }),
  });
  const responses = await Promise.all([review(), review()]);
  assert.deepEqual(responses.map((response) => response.status), [201, 201]);
  assert.equal(sqlite.prepare("SELECT count(*) AS count FROM billing_transactions WHERE negotiation_id = 'neg-concurrent'").get().count, 1);
  assert.deepEqual(sqlite.prepare("SELECT monthly_transaction_count, monthly_amount_paid FROM desmanche_billing WHERE desmanche_id = 'auto-concurrent'").get(), {
    monthly_transaction_count: 1, monthly_amount_paid: 25,
  });
  assert.deepEqual(calls, { get: 1, post: 1 });
});

test("resolução de moderação permanece aplicada quando a cobrança automática falha", async (t) => {
  const { endpoint, filename } = await startServer(t, (req, res) => {
    const url = new URL(req.url, "http://local");
    if (url.pathname === "/payments" && req.method === "GET") { res.writeHead(500); return res.end(); }
    res.writeHead(404); res.end();
  });
  const sqlite = new Database(filename); t.after(() => sqlite.close());
  insertDesmanche(sqlite, "moderation-owner");
  sqlite.prepare("INSERT INTO users (id, name, email, phone, password, type) VALUES ('admin-1', 'Admin', 'admin-1@example.test', '11999999999', 'hash', 'admin')").run();
  sqlite.prepare("INSERT INTO desmanche_billing (id, desmanche_id, billing_model, asaas_customer_id) VALUES ('billing-moderation', 'moderation-owner', 'per_transaction', 'cus_moderation')").run();
  insertReviewNegotiation(sqlite, {
    desmancheId: "moderation-owner", clientId: "moderation-client", negotiationId: "moderation-negotiation", status: "in_moderation",
  });
  const response = await fetch(`${endpoint}/api/admin/negotiations/moderation/moderation-negotiation/resolve`, {
    method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${token("admin-1", "admin")}` },
    body: JSON.stringify({ resolution: "sold" }),
  });
  assert.equal(response.status, 200);
  assert.equal(sqlite.prepare("SELECT status FROM negotiations WHERE id = 'moderation-negotiation'").get().status, "awaiting_review");
  assert.deepEqual(sqlite.prepare("SELECT status, asaas_charge_id FROM billing_transactions WHERE negotiation_id = 'moderation-negotiation'").get(), {
    status: "pending", asaas_charge_id: null,
  });
});

test("expiração automática conclui a negociação e deixa a cobrança local recuperável", async (t) => {
  const first = await startServer(t, (req, res) => {
    const url = new URL(req.url, "http://local");
    if (url.pathname === "/payments" && req.method === "GET") { res.writeHead(500); return res.end(); }
    res.writeHead(404); res.end();
  });
  const sqlite = new Database(first.filename);
  insertDesmanche(sqlite, "expire-owner");
  sqlite.prepare("INSERT INTO desmanche_billing (id, desmanche_id, billing_model, asaas_customer_id) VALUES ('billing-expire', 'expire-owner', 'per_transaction', 'cus_expire')").run();
  insertReviewNegotiation(sqlite, {
    desmancheId: "expire-owner", clientId: "expire-client", negotiationId: "expire-negotiation",
    status: "awaiting_review", deadline: Math.floor(Date.now() / 1000) - 60,
  });
  sqlite.close();
  first.serverProcess.kill();
  await first.processExited;

  const port = await freePort();
  const recovered = spawn(process.execPath, ["--enable-source-maps", "./dist/index.mjs"], {
    cwd: apiDir,
    env: {
      ...process.env,
      NODE_ENV: "test",
      PORT: String(port),
      JWT_SECRET: jwtSecret,
      DATABASE_PATH: first.filename,
      UPLOADS_DIR: path.join(first.directory, "uploads"),
      ASAAS_API_KEY: "temporary-test-key",
      ASAAS_BASE_URL_FOR_TESTS: first.asaasBaseUrl,
    },
    stdio: "ignore",
  });
  t.after(() => {
    if (recovered.exitCode === null) recovered.kill();
  });

  const check = new Database(first.filename, { readonly: true });
  t.after(() => check.close());
  const deadline = Date.now() + 10_000;
  let completed = false;
  while (Date.now() < deadline) {
    const negotiation = check.prepare("SELECT status FROM negotiations WHERE id = 'expire-negotiation'").get();
    const transaction = check.prepare("SELECT status FROM billing_transactions WHERE negotiation_id = 'expire-negotiation'").get();
    if (negotiation?.status === "completed" && transaction?.status === "pending") {
      completed = true;
      break;
    }
    await delay(50);
  }
  assert.equal(completed, true);
});

test("cadastro de guincho persiste planos anual e mensal quando o cliente fica ambíguo", async (t) => {
  const calls = { payments: 0, subscriptions: 0 };
  const { endpoint, filename } = await startServer(t, (req, res) => {
    const url = new URL(req.url, "http://local");
    if (url.pathname === "/customers") { res.writeHead(500); return res.end(); }
    if (url.pathname === "/payments") calls.payments++;
    if (url.pathname === "/subscriptions") calls.subscriptions++;
    res.writeHead(404); res.end();
  });
  for (const plan of ["annual", "monthly"]) {
    const response = await fetch(`${endpoint}/api/guinchos/register`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: `Guincho ${plan}`, tradingName: `Guincho ${plan}`, documentType: "cpf", cpf: plan === "annual" ? "12345678901" : "12345678902",
        email: `${plan}@guincho.example.test`, phone: "11999999999", whatsapp: "11999999999", password: "secret1",
        zipCode: "01001000", street: "Rua Teste", city: "São Paulo", state: "SP", plan,
      }),
    });
    assert.equal(response.status, 202);
    assert.equal((await response.json()).billing, "processing");
  }
  const sqlite = new Database(filename, { readonly: true });
  t.after(() => sqlite.close());
  assert.deepEqual(sqlite.prepare("SELECT email, plan, asaas_customer_id, asaas_payment_id, asaas_subscription_id, status FROM guinchos ORDER BY email").all(), [
    { email: "annual@guincho.example.test", plan: "annual", asaas_customer_id: null, asaas_payment_id: null, asaas_subscription_id: null, status: "pending" },
    { email: "monthly@guincho.example.test", plan: "monthly", asaas_customer_id: null, asaas_payment_id: null, asaas_subscription_id: null, status: "pending" },
  ]);
  assert.deepEqual(calls, { payments: 0, subscriptions: 0 });
});

test("cadastro de guincho não compartilha a cota de tentativas entre e-mails no mesmo proxy", async (t) => {
  const { endpoint } = await startServer(t, (_req, res) => {
    res.writeHead(404);
    res.end();
  }, { asaasConfigured: false });

  for (let index = 0; index < 4; index++) {
    const response = await fetch(`${endpoint}/api/guinchos/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: `Guincho ${index}`,
        tradingName: `Guincho ${index}`,
        documentType: "cpf",
        cpf: `1234567890${index}`,
        email: `guincho-${index}@example.test`,
        phone: "11999999999",
        whatsapp: "11999999999",
        password: "secret1",
        zipCode: "01001000",
        street: "Rua Teste",
        city: "São Paulo",
        state: "SP",
        plan: "annual",
      }),
    });
    assert.equal(response.status, 201);
  }
});

test("rota manual de cobrança cria uma vez, repete localmente e mantém seus bloqueios", async (t) => {
  const calls = { payments: 0 };
  const { endpoint, filename } = await startServer(t, (req, res) => {
    const url = new URL(req.url, "http://local");
    if (url.pathname === "/payments" && req.method === "GET") {
      res.setHeader("content-type", "application/json");
      return res.end(JSON.stringify({ data: [], hasMore: false }));
    }
    if (url.pathname === "/payments" && req.method === "POST") {
      calls.payments++;
      res.setHeader("content-type", "application/json");
      return res.end(JSON.stringify({ id: "pay_manual" }));
    }
    res.writeHead(404); res.end();
  });
  const sqlite = new Database(filename); t.after(() => sqlite.close());
  insertDesmanche(sqlite, "manual-owner");
  insertDesmanche(sqlite, "manual-other");
  sqlite.prepare("INSERT INTO desmanche_billing (id, desmanche_id, billing_model, asaas_customer_id) VALUES ('billing-manual', 'manual-owner', 'per_transaction', 'cus_manual')").run();
  sqlite.prepare("INSERT INTO billing_transactions (id, desmanche_id, amount, status, type) VALUES ('manual-tx', 'manual-owner', 25, 'pending', 'per_transaction')").run();
  sqlite.prepare("INSERT INTO billing_transactions (id, desmanche_id, amount, status, type) VALUES ('manual-monthly', 'manual-owner', 25, 'pending', 'monthly_cycle')").run();
  sqlite.prepare("INSERT INTO billing_transactions (id, desmanche_id, amount, status, type) VALUES ('manual-paid', 'manual-owner', 25, 'paid', 'per_transaction')").run();

  const request = (id, owner = "manual-owner") => fetch(`${endpoint}/api/billing/transactions/${id}/charge`, {
    method: "POST", headers: { authorization: `Bearer ${token(owner, "desmanche")}` },
  });
  const first = await request("manual-tx");
  assert.equal(first.status, 200); assert.deepEqual(await first.json(), { asaasChargeId: "pay_manual" });
  const repeated = await request("manual-tx");
  assert.equal(repeated.status, 200); assert.equal(calls.payments, 1);
  assert.equal((await request("manual-tx", "manual-other")).status, 404);
  assert.equal((await request("manual-monthly")).status, 400);
  assert.equal((await request("manual-paid")).status, 400);
  const persisted = sqlite.prepare("SELECT asaas_charge_id, asaas_due_date, asaas_creation_intent_id FROM billing_transactions WHERE id = 'manual-tx'").get();
  assert.equal(persisted.asaas_charge_id, "pay_manual");
  assert.match(persisted.asaas_due_date, /^\d{4}-\d{2}-\d{2}$/); assert.ok(persisted.asaas_creation_intent_id);
});

test("rota manual mapeia estados idempotentes para respostas genéricas sem expor detalhes", async (t) => {
  const calls = { get: 0, post: 0 };
  const { endpoint, filename } = await startServer(t, (req, res) => {
    const url = new URL(req.url, "http://local");
    if (url.pathname === "/payments" && req.method === "GET") {
      calls.get++;
      const reference = url.searchParams.get("externalReference");
      if (reference === paymentReference("route-ambiguous")) { res.writeHead(500); return res.end(); }
      if (reference === paymentReference("route-ready")) {
        res.setHeader("content-type", "application/json");
        return res.end(JSON.stringify({ data: [{
          id: "pay_reconciled", customer: "cus_manual", value: 25, dueDate: "2030-01-03",
          billingType: "UNDEFINED", externalReference: reference,
        }], hasMore: false }));
      }
      res.setHeader("content-type", "application/json");
      return res.end(JSON.stringify({ data: [], hasMore: false }));
    }
    if (url.pathname === "/payments" && req.method === "POST") {
      calls.post++;
      res.writeHead(400, { "content-type": "application/json" });
      return res.end(JSON.stringify({ issues: [{ description: "dados internos do Asaas" }] }));
    }
    res.writeHead(404); res.end();
  });
  const sqlite = new Database(filename); t.after(() => sqlite.close());
  insertDesmanche(sqlite, "manual-owner");
  sqlite.prepare("INSERT INTO desmanche_billing (id, desmanche_id, billing_model, asaas_customer_id) VALUES ('billing-manual', 'manual-owner', 'per_transaction', 'cus_manual')").run();
  for (const id of ["route-busy", "route-ambiguous", "route-failed", "route-conflict", "route-ready"]) {
    sqlite.prepare("INSERT INTO billing_transactions (id, desmanche_id, amount, status, type) VALUES (?, 'manual-owner', 25, 'pending', 'per_transaction')").run(id);
  }
  insertPaymentIntent(sqlite, { transactionId: "route-busy", status: "creating" });
  insertPaymentIntent(sqlite, { transactionId: "route-ambiguous", status: "ambiguous" });
  insertPaymentIntent(sqlite, { transactionId: "route-failed", status: "failed" });
  sqlite.prepare("UPDATE billing_transactions SET asaas_due_date = '2030-01-03', asaas_creation_intent_id = 'foreign-intent' WHERE id = 'route-conflict'").run();
  sqlite.prepare("UPDATE billing_transactions SET asaas_due_date = '2030-01-03' WHERE id = 'route-ready'").run();

  const request = (id) => fetch(`${endpoint}/api/billing/transactions/${id}/charge`, {
    method: "POST", headers: { authorization: `Bearer ${token("manual-owner", "desmanche")}` },
  });
  const assertError = async (response, status) => {
    assert.equal(response.status, status);
    const body = await response.json();
    assert.deepEqual(Object.keys(body), ["message"]);
    assert.equal(typeof body.message, "string");
    assert.doesNotMatch(JSON.stringify(body), /REMOTE_|PAYMENT_|intent|asaas|dados internos/i);
  };

  await assertError(await request("route-busy"), 409);
  assert.equal(calls.post, 0);
  await assertError(await request("route-ambiguous"), 503);
  assert.equal(calls.post, 0);
  await assertError(await request("route-failed"), 422);
  assert.equal(calls.post, 1);
  await assertError(await request("route-conflict"), 409);
  await assertError(await request("route-missing"), 404);

  const reconciled = await request("route-ready");
  assert.equal(reconciled.status, 200);
  assert.deepEqual(await reconciled.json(), { asaasChargeId: "pay_reconciled" });
  assert.equal(calls.post, 1);
  const networkCallsBeforeRetry = { ...calls };
  const repeated = await request("route-ready");
  assert.equal(repeated.status, 200);
  assert.deepEqual(await repeated.json(), { asaasChargeId: "pay_reconciled" });
  assert.deepEqual(calls, networkCallsBeforeRetry);
});
