import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import jwt from "jsonwebtoken";
import Database from "better-sqlite3";

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

async function startServer(databasePath, uploadsDir) {
  const port = await freePort();
  const serverProcess = spawn(process.execPath, ["--enable-source-maps", "./dist/index.mjs"], {
    cwd: apiDir,
    env: {
      ...process.env,
      NODE_ENV: "test",
      PORT: String(port),
      JWT_SECRET: jwtSecret,
      DATABASE_PATH: databasePath,
      UPLOADS_DIR: uploadsDir,
      // Explicitly clear inherited credentials: these restart tests never contact Asaas.
      ASAAS_API_KEY: "",
      ASAAS_BASE_URL_FOR_TESTS: "",
    },
    stdio: "ignore",
  });
  const exited = new Promise((resolve) => {
    serverProcess.once("exit", (code, signal) => resolve({ code, signal }));
    serverProcess.once("error", () => resolve({ code: serverProcess.exitCode, signal: serverProcess.signalCode }));
  });
  const endpoint = `http://127.0.0.1:${port}`;
  const deadline = Date.now() + 14_000;

  while (Date.now() < deadline) {
    if (serverProcess.exitCode !== null || serverProcess.signalCode !== null) {
      const result = await exited;
      throw new Error(`test server exited before /healthz responded: ${JSON.stringify(result)}`);
    }
    const healthy = await fetch(`${endpoint}/healthz`, { signal: AbortSignal.timeout(1_000) })
      .then((response) => response.ok)
      .catch(() => false);
    if (healthy) return { endpoint, serverProcess, exited };
    await delay(50);
  }

  serverProcess.kill();
  await exited;
  throw new Error("test server did not respond to /healthz within 14 seconds");
}

async function stopServer(server) {
  if (server.serverProcess.exitCode === null && server.serverProcess.signalCode === null) {
    server.serverProcess.kill();
  }
  await server.exited;
}

function prepareDatabase(filename, desmancheIds) {
  const sqlite = new Database(filename);
  sqlite.exec(`
    CREATE TABLE desmanches (
      id TEXT PRIMARY KEY,
      company_name TEXT NOT NULL,
      trading_name TEXT NOT NULL,
      cnpj TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL UNIQUE,
      phone TEXT NOT NULL,
      password TEXT NOT NULL,
      logo TEXT,
      plan TEXT NOT NULL DEFAULT 'percentage',
      status TEXT NOT NULL DEFAULT 'pending',
      rating REAL NOT NULL DEFAULT 0,
      sales_count INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE desmanche_billing (
      id TEXT PRIMARY KEY,
      desmanche_id TEXT NOT NULL UNIQUE,
      billing_model TEXT NOT NULL DEFAULT 'monthly_cycle',
      plan_id TEXT,
      monthly_transaction_count INTEGER NOT NULL DEFAULT 0,
      monthly_amount_paid REAL NOT NULL DEFAULT 0,
      current_period_start INTEGER NOT NULL DEFAULT 0,
      asaas_customer_id TEXT,
      created_at INTEGER NOT NULL DEFAULT 1
    );
  `);
  const insert = sqlite.prepare(`
    INSERT INTO desmanches (id, company_name, trading_name, cnpj, email, phone, password)
    VALUES (?, 'Desmanche', 'Desmanche', ?, ?, '11999999999', 'hash')
  `);
  for (const id of desmancheIds) {
    insert.run(id, `${id.replace(/[^a-z]/g, "").slice(0, 12).padEnd(12, "0")}01`, `${id}@example.test`);
  }
  sqlite.close();
}

function billingSnapshot(filename) {
  const sqlite = new Database(filename, { readonly: true });
  try {
    return sqlite.prepare(`
      SELECT desmanche_id, billing_model, monthly_transaction_count, monthly_amount_paid, current_period_start
      FROM desmanche_billing
      ORDER BY desmanche_id
    `).all();
  } finally {
    sqlite.close();
  }
}

function hasPerTransactionIndex(filename) {
  const sqlite = new Database(filename, { readonly: true });
  try {
    return Boolean(sqlite.prepare(`
      SELECT 1 FROM sqlite_master
      WHERE type = 'index' AND name = 'ux_billing_transactions_per_transaction_negotiation'
    `).get());
  } finally {
    sqlite.close();
  }
}

test("bootstrap preserva os três modelos em dois reinícios e normaliza somente monthly_cycle", async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "api-server-billing-restart-"));
  const filename = path.join(directory, "database.sqlite");
  const servers = [];
  t.after(async () => {
    await Promise.allSettled(servers.map(stopServer));
    await rm(directory, { recursive: true, force: true });
  });
  prepareDatabase(filename, ["per-transaction", "subscription", "monthly-cycle"]);

  const sqlite = new Database(filename);
  sqlite.prepare(`
    INSERT INTO desmanche_billing (
      id, desmanche_id, billing_model, monthly_transaction_count, monthly_amount_paid, current_period_start
    ) VALUES (?, ?, ?, ?, ?, ?)
  `).run("billing-per", "per-transaction", "per_transaction", 0, 137.5, 1_700_000_001);
  sqlite.prepare(`
    INSERT INTO desmanche_billing (
      id, desmanche_id, billing_model, monthly_transaction_count, monthly_amount_paid, current_period_start
    ) VALUES (?, ?, ?, ?, ?, ?)
  `).run("billing-subscription", "subscription", "subscription", 4, 80, 1_700_000_002);
  sqlite.prepare(`
    INSERT INTO desmanche_billing (
      id, desmanche_id, billing_model, monthly_transaction_count, monthly_amount_paid, current_period_start
    ) VALUES (?, ?, ?, ?, ?, ?)
  `).run("billing-monthly", "monthly-cycle", "monthly_cycle", 0, 45, 1_700_000_003);
  sqlite.close();

  const expectedAfterFirstStart = [
    { desmanche_id: "monthly-cycle", billing_model: "monthly_cycle", monthly_transaction_count: 0, monthly_amount_paid: 45, current_period_start: 0 },
    { desmanche_id: "per-transaction", billing_model: "per_transaction", monthly_transaction_count: 0, monthly_amount_paid: 137.5, current_period_start: 1_700_000_001 },
    { desmanche_id: "subscription", billing_model: "subscription", monthly_transaction_count: 4, monthly_amount_paid: 80, current_period_start: 1_700_000_002 },
  ];

  const first = await startServer(filename, path.join(directory, "uploads"));
  servers.push(first);
  await stopServer(first);
  assert.deepEqual(billingSnapshot(filename), expectedAfterFirstStart);
  assert.equal(hasPerTransactionIndex(filename), true);

  const second = await startServer(filename, path.join(directory, "uploads"));
  servers.push(second);
  await stopServer(second);
  assert.deepEqual(billingSnapshot(filename), expectedAfterFirstStart);
  assert.equal(hasPerTransactionIndex(filename), true);
});

test("billing/setup mantém per_transaction após reiniciar sem configurar Asaas", async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "api-server-billing-setup-restart-"));
  const filename = path.join(directory, "database.sqlite");
  const servers = [];
  t.after(async () => {
    await Promise.allSettled(servers.map(stopServer));
    await rm(directory, { recursive: true, force: true });
  });
  prepareDatabase(filename, ["setup-per-transaction"]);

  const first = await startServer(filename, path.join(directory, "uploads"));
  servers.push(first);
  const token = jwt.sign({ id: "setup-per-transaction", type: "desmanche" }, jwtSecret, { expiresIn: "5m" });
  const setup = await fetch(`${first.endpoint}/api/billing/setup`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify({ billingModel: "per_transaction" }),
  });
  assert.equal(setup.status, 200);
  assert.equal((await setup.json()).billingModel, "per_transaction");
  await stopServer(first);

  const second = await startServer(filename, path.join(directory, "uploads"));
  servers.push(second);
  const billing = await fetch(`${second.endpoint}/api/billing/my`, {
    headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(billing.status, 200);
  assert.equal((await billing.json()).billing.billingModel, "per_transaction");
  await stopServer(second);

  assert.deepEqual(billingSnapshot(filename), [{
    desmanche_id: "setup-per-transaction",
    billing_model: "per_transaction",
    monthly_transaction_count: 0,
    monthly_amount_paid: 0,
    current_period_start: 0,
  }]);
  assert.equal(hasPerTransactionIndex(filename), true);
});
