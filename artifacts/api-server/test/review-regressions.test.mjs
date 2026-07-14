import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import net from "node:net";
import test from "node:test";
import Database from "better-sqlite3";
import { guinchoColumns, migrateGuinchos, rebuildLegacyGuinchos } from "../dist/migrations/guinchos.mjs";

const apiDir = path.resolve(import.meta.dirname, "..");
const legacyColumns = `
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  trading_name TEXT NOT NULL,
  document_type TEXT NOT NULL DEFAULT 'cnpj',
  cnpj TEXT NOT NULL UNIQUE,
  cpf TEXT UNIQUE,
  antt TEXT,
  email TEXT NOT NULL UNIQUE,
  phone TEXT NOT NULL,
  whatsapp TEXT NOT NULL,
  password TEXT NOT NULL,
  description TEXT,
  zip_code TEXT NOT NULL,
  street TEXT NOT NULL,
  number TEXT,
  neighborhood TEXT,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  service_radius INTEGER NOT NULL DEFAULT 50,
  photo_url TEXT,
  latitude REAL,
  longitude REAL,
  status TEXT NOT NULL DEFAULT 'pending',
  rejection_reason TEXT,
  asaas_customer_id TEXT,
  asaas_payment_id TEXT,
  asaas_subscription_id TEXT,
  plan TEXT NOT NULL DEFAULT 'annual',
  created_at INTEGER NOT NULL
`;

async function temporaryDatabase() {
  const directory = await mkdtemp(path.join(tmpdir(), "api-server-review-"));
  return { directory, filename: path.join(directory, "database.sqlite") };
}

function insertLegacyGuincho(sqlite, { id = "legacy-1", cnpj = "12345678000199", email = "legacy@example.com" } = {}) {
  sqlite.prepare(`
    INSERT INTO guinchos (${guinchoColumns.join(", ")})
    VALUES (${guinchoColumns.map(() => "?").join(", ")})
  `).run(
    id, "Nome", "Nome fantasia", "cnpj", cnpj, null, "ANTT", email,
    "11999999999", "11999999999", "hash", "Descrição", "01001000", "Rua A",
    "1", "Centro", "São Paulo", "SP", 50, "foto.png", -23.5, -46.6,
    "pending", null, "customer-1", "payment-1", "subscription-1", "annual", 123,
  );
}

function createLegacyDatabase(filename) {
  const sqlite = new Database(filename);
  sqlite.exec(`CREATE TABLE guinchos (${legacyColumns})`);
  return sqlite;
}

function tableExists(sqlite, table) {
  return Boolean(sqlite.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").get(table));
}

test("rebuild legado é atômico, preserva 29 colunas, índice e foreign_keys", async (t) => {
  const temporary = await temporaryDatabase();
  t.after(() => rm(temporary.directory, { recursive: true, force: true }));
  const sqlite = createLegacyDatabase(temporary.filename);
  t.after(() => sqlite.close());
  sqlite.pragma("foreign_keys = ON");
  insertLegacyGuincho(sqlite);
  const foreignKeysBefore = sqlite.pragma("foreign_keys", { simple: true });

  migrateGuinchos(sqlite);

  assert.deepEqual(
    sqlite.prepare("PRAGMA table_info(guinchos)").all().map((column) => column.name),
    guinchoColumns,
  );
  assert.equal(sqlite.prepare("PRAGMA table_info(guinchos)").all().find((column) => column.name === "cnpj").notnull, 0);
  assert.equal(sqlite.prepare("SELECT id FROM guinchos").get().id, "legacy-1");
  assert.equal(tableExists(sqlite, "guinchos_new"), false);
  assert.equal(sqlite.prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'idx_guinchos_asaas_payment_id'").get().name, "idx_guinchos_asaas_payment_id");
  assert.equal(sqlite.pragma("foreign_keys", { simple: true }), foreignKeysBefore);

  migrateGuinchos(sqlite);
  assert.equal(sqlite.prepare("SELECT COUNT(*) AS count FROM guinchos").get().count, 1);
  assert.equal(sqlite.prepare("SELECT id FROM guinchos").get().id, "legacy-1");
});

test("falha durante INSERT faz rollback integral e permite nova tentativa", async (t) => {
  const temporary = await temporaryDatabase();
  t.after(() => rm(temporary.directory, { recursive: true, force: true }));
  const sqlite = createLegacyDatabase(temporary.filename);
  t.after(() => sqlite.close());
  insertLegacyGuincho(sqlite);

  assert.throws(() => rebuildLegacyGuinchos(sqlite, {
    beforeCopy(database) {
      database.exec(`
        CREATE TRIGGER force_guinchos_insert_failure
        BEFORE INSERT ON guinchos_new
        BEGIN
          SELECT RAISE(FAIL, 'forced INSERT failure');
        END;
      `);
    },
  }), /forced INSERT failure/);

  assert.equal(tableExists(sqlite, "guinchos"), true);
  assert.equal(tableExists(sqlite, "guinchos_new"), false);
  assert.equal(sqlite.prepare("SELECT id FROM guinchos").get().id, "legacy-1");
  assert.equal(sqlite.prepare("PRAGMA table_info(guinchos)").all().find((column) => column.name === "cnpj").notnull, 1);

  migrateGuinchos(sqlite);
  assert.equal(sqlite.prepare("SELECT id FROM guinchos").get().id, "legacy-1");
});

test("guinchos_new residual é descartada e guinchos original prevalece", async (t) => {
  const temporary = await temporaryDatabase();
  t.after(() => rm(temporary.directory, { recursive: true, force: true }));
  const sqlite = createLegacyDatabase(temporary.filename);
  t.after(() => sqlite.close());
  insertLegacyGuincho(sqlite, { id: "original" });
  sqlite.exec("CREATE TABLE guinchos_new (id TEXT PRIMARY KEY, note TEXT)");
  sqlite.prepare("INSERT INTO guinchos_new (id, note) VALUES (?, ?)").run("residual", "stale");

  migrateGuinchos(sqlite);

  assert.equal(tableExists(sqlite, "guinchos_new"), false);
  assert.deepEqual(sqlite.prepare("SELECT id FROM guinchos").all(), [{ id: "original" }]);
});

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

async function startServer(t) {
  const temporary = await temporaryDatabase();
  const port = await freePort();
  const serverProcess = spawn(process.execPath, ["--enable-source-maps", "./dist/index.mjs"], {
    cwd: apiDir,
    env: {
      ...process.env,
      NODE_ENV: "production",
      PORT: String(port),
      JWT_SECRET: "12345678901234567890123456789012",
      ASAAS_WEBHOOK_TOKEN: "a".repeat(32),
      DATABASE_PATH: temporary.filename,
      UPLOADS_DIR: path.join(temporary.directory, "uploads"),
    },
    stdio: "ignore",
  });
  t.after(async () => {
    serverProcess.kill();
    await rm(temporary.directory, { recursive: true, force: true });
  });
  const endpoint = `http://127.0.0.1:${port}`;
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      if ((await fetch(`${endpoint}/healthz`)).ok) return { endpoint, filename: temporary.filename };
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error("server did not start");
}

async function webhook(endpoint, body) {
  return fetch(`${endpoint}/api/billing/webhook`, {
    method: "POST",
    headers: { "content-type": "application/json", "asaas-access-token": "a".repeat(32) },
    body: JSON.stringify(body),
  });
}

test("webhook rejeita espaços e mantém identificadores válidos sem normalizar", async (t) => {
  const { endpoint, filename } = await startServer(t);
  assert.equal((await webhook(endpoint, { id: "   ", event: "OTHER" })).status, 400);
  assert.equal((await webhook(endpoint, { id: "event-2", event: "   " })).status, 400);
  assert.equal((await webhook(endpoint, {
    id: "event-3", event: "PAYMENT_RECEIVED", payment: { id: "   " },
  })).status, 400);

  const body = {
    id: " event-id exactly ",
    event: "PAYMENT_RECEIVED",
    payment: { id: " payment-id exactly ", status: "   " },
  };
  assert.equal((await webhook(endpoint, body)).status, 200);
  const sqlite = new Database(filename, { readonly: true });
  t.after(() => sqlite.close());
  const stored = sqlite.prepare("SELECT event_id, event_type, payment_id, payload_hash FROM asaas_webhook_events").get();
  assert.deepEqual(
    { event_id: stored.event_id, event_type: stored.event_type, payment_id: stored.payment_id },
    { event_id: body.id, event_type: body.event, payment_id: body.payment.id },
  );
  assert.equal(stored.payload_hash, createHash("sha256")
    .update(JSON.stringify({ id: body.id, event: body.event, payment: { id: body.payment.id } }))
    .digest("hex"));
});
