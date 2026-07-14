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

async function startServer(t, handler) {
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
      ASAAS_API_KEY: "temporary-test-key",
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
    if (result) return { endpoint, filename: path.join(directory, "database.sqlite") };
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

let desmancheSequence = 0;
function insertDesmanche(sqlite, id) {
  sqlite.prepare("INSERT INTO desmanches (id, company_name, trading_name, cnpj, email, phone, password) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .run(id, "Desmanche", "Desmanche", String(++desmancheSequence).padStart(14, "0"), `${id}@example.test`, "11999999999", "hash");
}

function insertCustomerIntent(sqlite, { entityType = "desmanche", entityId, externalReference, status = "creating", parameterHash, leaseOwner = "other" }) {
  sqlite.prepare(`INSERT INTO asaas_creation_intents (
    intent_id, resource_type, entity_type, entity_id, operation_key, external_reference, status,
    asaas_resource_id, parameter_hash, lease_owner, lease_expires_at, last_error_code, created_at, updated_at
  ) VALUES (?, 'customer', ?, ?, 'customer', ?, ?, NULL, ?, ?, ?, NULL, 1, 1)`).run(
    `intent-${entityId}`, entityType, entityId, externalReference, status, parameterHash, leaseOwner, status === "creating" ? 4_000_000_000 : null,
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
