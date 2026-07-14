import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { Worker } from "node:worker_threads";
import {
  createPerTransactionBillingStore,
  initializePerTransactionBillingIndex,
} from "../dist/per-transaction-billing.mjs";

function fixture({
  withBilling = true,
  billingModel = "per_transaction",
  monthlyAmountPaid = 0,
  negotiationIds = ["neg-1"],
  filename = ":memory:",
  createStore = true,
} = {}) {
  const sqlite = new Database(filename);
  sqlite.exec(`
    CREATE TABLE negotiations (id TEXT PRIMARY KEY, desmanche_id TEXT NOT NULL);
    CREATE TABLE desmanche_billing (
      id TEXT PRIMARY KEY, desmanche_id TEXT NOT NULL UNIQUE,
      billing_model TEXT NOT NULL DEFAULT 'monthly_cycle',
      monthly_transaction_count INTEGER NOT NULL DEFAULT 0,
      monthly_amount_paid REAL NOT NULL DEFAULT 0
    );
    CREATE TABLE billing_transactions (
      id TEXT PRIMARY KEY, desmanche_id TEXT NOT NULL, negotiation_id TEXT,
      amount REAL NOT NULL, status TEXT NOT NULL, type TEXT NOT NULL,
      description TEXT, asaas_charge_id TEXT, asaas_creation_intent_id TEXT,
      asaas_due_date TEXT, payment_link TEXT
    );
  `);
  const insertNegotiation = sqlite.prepare("INSERT INTO negotiations VALUES (?, 'desmanche-1')");
  for (const id of negotiationIds) insertNegotiation.run(id);
  if (withBilling) {
    sqlite.prepare(`INSERT INTO desmanche_billing (
      id, desmanche_id, billing_model, monthly_amount_paid
    ) VALUES ('billing-1', 'desmanche-1', ?, ?)`).run(billingModel, monthlyAmountPaid);
  }
  return createStore ? { sqlite, store: createPerTransactionBillingStore(sqlite) } : { sqlite };
}

function input(overrides = {}) {
  return {
    desmancheId: "desmanche-1",
    negotiationId: "neg-1",
    perTransactionAmount: 25,
    monthlyCapAmount: 350,
    chargeDescription: "Transação de teste",
    exemptDescription: "Isento de teste",
    ...overrides,
  };
}

function insertTransaction(sqlite, overrides = {}) {
  const row = {
    id: "tx-existing",
    desmancheId: "desmanche-1",
    negotiationId: "neg-1",
    amount: 25,
    status: "pending",
    type: "per_transaction",
    description: "descrição original",
    chargeId: null,
    intentId: null,
    dueDate: null,
    paymentLink: null,
    ...overrides,
  };
  sqlite.prepare(`
    INSERT INTO billing_transactions (
      id, desmanche_id, negotiation_id, amount, status, type, description,
      asaas_charge_id, asaas_creation_intent_id, asaas_due_date, payment_link
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    row.id, row.desmancheId, row.negotiationId, row.amount, row.status, row.type,
    row.description, row.chargeId, row.intentId, row.dueDate, row.paymentLink,
  );
}

function counters(sqlite) {
  return sqlite.prepare(`
    SELECT monthly_transaction_count AS count, monthly_amount_paid AS amount
    FROM desmanche_billing WHERE desmanche_id = 'desmanche-1'
  `).get();
}

test("cria cobrança normal com valor completo e incrementa uma vez", (t) => {
  const { sqlite, store } = fixture(); t.after(() => sqlite.close());
  const created = store.createOrGetPerTransactionBilling(input());
  assert.equal(created.outcome, "created");
  assert.deepEqual(created.transaction.status, "pending");
  assert.equal(created.transaction.amount, 25);
  assert.deepEqual(counters(sqlite), { count: 1, amount: 25 });
});

test("cobrança parcial no teto é durável: repetição retorna existing sem novo contador", (t) => {
  const { sqlite, store } = fixture({ monthlyAmountPaid: 340 }); t.after(() => sqlite.close());
  const first = store.createOrGetPerTransactionBilling(input());
  assert.equal(first.outcome, "created");
  assert.deepEqual(first.transaction.status, "pending");
  assert.equal(first.transaction.amount, 10);
  assert.deepEqual(counters(sqlite), { count: 1, amount: 350 });

  const repeated = store.createOrGetPerTransactionBilling(input({
    perTransactionAmount: 99,
    monthlyCapAmount: 351,
    chargeDescription: "não sobrescrever",
  }));
  assert.equal(repeated.outcome, "existing");
  assert.equal(repeated.transaction.id, first.transaction.id);
  assert.equal(repeated.transaction.amount, 10);
  assert.equal(repeated.transaction.description, "Transação de teste");
  assert.deepEqual(counters(sqlite), { count: 1, amount: 350 });
});

test("duas negociações repetidas no mesmo processo próximas ao teto geram uma pending de 10 e uma exempt", async (t) => {
  const { sqlite, store } = fixture({ monthlyAmountPaid: 340, negotiationIds: ["neg-1", "neg-2"] });
  t.after(() => sqlite.close());
  const results = await Promise.all([
    Promise.resolve().then(() => store.createOrGetPerTransactionBilling(input({ negotiationId: "neg-1" }))),
    Promise.resolve().then(() => store.createOrGetPerTransactionBilling(input({ negotiationId: "neg-2" }))),
  ]);
  assert.ok(results.every((result) => result.outcome === "created"));
  assert.deepEqual(results.map((result) => [result.transaction.status, result.transaction.amount]).sort(), [
    ["exempt", 0], ["pending", 10],
  ]);
  assert.deepEqual(counters(sqlite), { count: 1, amount: 350 });
});

test("duas negociações repetidas no mesmo processo abaixo do teto consomem somente o saldo disponível", async (t) => {
  const { sqlite, store } = fixture({ monthlyAmountPaid: 320, negotiationIds: ["neg-1", "neg-2"] });
  t.after(() => sqlite.close());
  const results = await Promise.all([
    Promise.resolve().then(() => store.createOrGetPerTransactionBilling(input({ negotiationId: "neg-1" }))),
    Promise.resolve().then(() => store.createOrGetPerTransactionBilling(input({ negotiationId: "neg-2" }))),
  ]);
  assert.ok(results.every((result) => result.outcome === "created"));
  assert.deepEqual(results.map((result) => result.transaction.amount).sort((a, b) => a - b), [5, 25]);
  assert.deepEqual(counters(sqlite), { count: 2, amount: 350 });
});

test("linhas pending e exempt válidas são reutilizadas sem recalcular configurações ou contador", (t) => {
  const pending = fixture({ monthlyAmountPaid: 349 }); t.after(() => pending.sqlite.close());
  insertTransaction(pending.sqlite, { chargeId: "pay-old", intentId: "intent-old", dueDate: "2030-01-03", paymentLink: "old-link" });
  const pendingResult = pending.store.createOrGetPerTransactionBilling(input({
    perTransactionAmount: 1, monthlyCapAmount: 1, chargeDescription: "nova descrição",
  }));
  assert.equal(pendingResult.outcome, "existing");
  assert.deepEqual(pendingResult.transaction, {
    id: "tx-existing", desmancheId: "desmanche-1", negotiationId: "neg-1", amount: 25,
    status: "pending", type: "per_transaction", description: "descrição original",
    asaasChargeId: "pay-old", asaasCreationIntentId: "intent-old", asaasDueDate: "2030-01-03", paymentLink: "old-link",
  });
  assert.deepEqual(counters(pending.sqlite), { count: 0, amount: 349 });

  const exempt = fixture({ monthlyAmountPaid: 0 }); t.after(() => exempt.sqlite.close());
  insertTransaction(exempt.sqlite, { amount: 0, status: "exempt" });
  const exemptResult = exempt.store.createOrGetPerTransactionBilling(input({
    perTransactionAmount: 100, monthlyCapAmount: 1,
  }));
  assert.equal(exemptResult.outcome, "existing");
  assert.equal(exemptResult.transaction.status, "exempt");
  assert.equal(exemptResult.transaction.amount, 0);
  assert.deepEqual(counters(exempt.sqlite), { count: 0, amount: 0 });
});

test("invariantes de linhas existentes e do billing retornam conflicts/not_found", (t) => {
  const invalidPending = fixture(); t.after(() => invalidPending.sqlite.close());
  insertTransaction(invalidPending.sqlite, { amount: 0 });
  assert.deepEqual(invalidPending.store.createOrGetPerTransactionBilling(input()), { outcome: "conflict", reason: "AMOUNT_MISMATCH" });

  const invalidExempt = fixture(); t.after(() => invalidExempt.sqlite.close());
  insertTransaction(invalidExempt.sqlite, { amount: 0.01, status: "exempt" });
  assert.deepEqual(invalidExempt.store.createOrGetPerTransactionBilling(input()), { outcome: "conflict", reason: "AMOUNT_MISMATCH" });

  const invalidPrecision = fixture(); t.after(() => invalidPrecision.sqlite.close());
  insertTransaction(invalidPrecision.sqlite, { amount: 0.001 });
  assert.deepEqual(invalidPrecision.store.createOrGetPerTransactionBilling(input()), { outcome: "conflict", reason: "AMOUNT_MISMATCH" });

  const wrongModel = fixture({ billingModel: "monthly_cycle" }); t.after(() => wrongModel.sqlite.close());
  assert.deepEqual(wrongModel.store.createOrGetPerTransactionBilling(input()), { outcome: "conflict", reason: "BILLING_MODEL_MISMATCH" });

  const missingBilling = fixture({ withBilling: false }); t.after(() => missingBilling.sqlite.close());
  assert.deepEqual(missingBilling.store.createOrGetPerTransactionBilling(input()), { outcome: "not_found" });

  const wrongType = fixture(); t.after(() => wrongType.sqlite.close());
  insertTransaction(wrongType.sqlite, { type: "monthly_cycle" });
  assert.deepEqual(wrongType.store.createOrGetPerTransactionBilling(input()), { outcome: "conflict", reason: "TRANSACTION_TYPE_MISMATCH" });

  const wrongDesmanche = fixture(); t.after(() => wrongDesmanche.sqlite.close());
  insertTransaction(wrongDesmanche.sqlite, { desmancheId: "other-desmanche" });
  assert.deepEqual(wrongDesmanche.store.createOrGetPerTransactionBilling(input()), { outcome: "conflict", reason: "DESMANCHE_MISMATCH" });

  const wrongStatus = fixture(); t.after(() => wrongStatus.sqlite.close());
  insertTransaction(wrongStatus.sqlite, { status: "paid" });
  assert.deepEqual(wrongStatus.store.createOrGetPerTransactionBilling(input()), { outcome: "conflict", reason: "STATUS_MISMATCH" });

  const wrongOwner = fixture(); t.after(() => wrongOwner.sqlite.close());
  wrongOwner.sqlite.prepare("INSERT INTO negotiations VALUES ('other-negotiation', 'other-desmanche')").run();
  assert.deepEqual(wrongOwner.store.createOrGetPerTransactionBilling(input({ negotiationId: "other-negotiation" })), { outcome: "conflict", reason: "NEGOTIATION_OWNER_MISMATCH" });
});

test("centavos são validados e falha no contador desfaz a inserção", (t) => {
  const cents = fixture({ negotiationIds: ["neg-1", "neg-2"] }); t.after(() => cents.sqlite.close());
  const created = cents.store.createOrGetPerTransactionBilling(input({ perTransactionAmount: 0.1 + 0.2 }));
  assert.equal(created.outcome, "created");
  assert.equal(created.transaction.amount, 0.3);
  assert.throws(() => cents.store.createOrGetPerTransactionBilling(input({ negotiationId: "neg-2", perTransactionAmount: 0.001 })), /at most two decimal places/);

  const counterFailure = fixture(); t.after(() => counterFailure.sqlite.close());
  counterFailure.sqlite.exec(`
    CREATE TRIGGER fail_per_transaction_counter
    BEFORE UPDATE ON desmanche_billing
    BEGIN
      SELECT RAISE(ABORT, 'counter update failure');
    END;
  `);
  assert.throws(() => counterFailure.store.createOrGetPerTransactionBilling(input()), /counter update failure/);
  assert.equal(counterFailure.sqlite.prepare("SELECT count(*) AS count FROM billing_transactions").get().count, 0);
  assert.deepEqual(counters(counterFailure.sqlite), { count: 0, amount: 0 });
});

test("linhas históricas múltiplas continuam em conflict e índice parcial preserva histórico", (t) => {
  const clean = fixture(); t.after(() => clean.sqlite.close());
  initializePerTransactionBillingIndex(clean.sqlite);
  initializePerTransactionBillingIndex(clean.sqlite);
  assert.ok(clean.sqlite.prepare(`SELECT 1 FROM sqlite_master WHERE type = 'index' AND name = 'ux_billing_transactions_per_transaction_negotiation'`).get());
  insertTransaction(clean.sqlite, { id: "tx-1" });
  assert.throws(() => insertTransaction(clean.sqlite, { id: "tx-2" }), /UNIQUE constraint failed/);

  const historic = fixture(); t.after(() => historic.sqlite.close());
  insertTransaction(historic.sqlite, { id: "tx-1" });
  insertTransaction(historic.sqlite, { id: "tx-2" });
  assert.deepEqual(historic.store.createOrGetPerTransactionBilling(input()), { outcome: "conflict", reason: "MULTIPLE_TRANSACTIONS" });
});

async function fileFixture(t, options = {}) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "per-transaction-billing-"));
  const filename = path.join(directory, "billing.sqlite");
  const { sqlite } = fixture({ ...options, filename, createStore: false });

  // Normal serialization is provided by the IMMEDIATE transaction; this index
  // remains SQLite's final guard if another writer ever bypasses that helper.
  initializePerTransactionBillingIndex(sqlite);
  sqlite.exec(`
    CREATE TRIGGER test_hold_per_transaction_billing_insert
    BEFORE INSERT ON billing_transactions
    BEGIN
      SELECT test_hold_after_lock();
    END;
  `);
  sqlite.close();

  t.after(async () => {
    await Promise.all([
      rm(filename, { force: true }),
      rm(`${filename}-wal`, { force: true }),
      rm(`${filename}-shm`, { force: true }),
    ]);
    await rm(directory, { recursive: true, force: true });
  });
  return filename;
}

function runConcurrentWorkers(filename, inputs) {
  const startGate = new Int32Array(new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT));
  const holdGate = new Int32Array(new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT));
  const workers = inputs.map((workerInput, index) => new Worker(
    new URL("./per-transaction-billing-worker.mjs", import.meta.url),
    { workerData: { filename, input: workerInput, worker: index, startGate: startGate.buffer, holdGate: holdGate.buffer } },
  ));

  return new Promise((resolve, reject) => {
    const results = [];
    let ready = 0;
    let starting = 0;
    let locked = false;
    let released = false;
    let completed = 0;
    const timer = setTimeout(() => finish(new Error("Timed out waiting for SQLite workers")), 10_000);

    const terminateWorkers = () => Promise.all(workers.map((worker) => worker.terminate().catch(() => undefined)));
    const finish = (error) => {
      clearTimeout(timer);
      Atomics.store(startGate, 0, 1);
      Atomics.notify(startGate, 0);
      Atomics.store(holdGate, 0, 1);
      Atomics.notify(holdGate, 0);
      terminateWorkers().finally(() => error ? reject(error) : resolve(results));
    };
    const releaseLockAfterBothStarted = () => {
      if (!released && locked && starting === workers.length) {
        released = true;
        setTimeout(() => {
          Atomics.store(holdGate, 0, 1);
          Atomics.notify(holdGate, 0);
        }, 50);
      }
    };

    for (const worker of workers) {
      worker.once("error", finish);
      worker.on("message", (message) => {
        if (message.type === "ready") {
          ready += 1;
          if (ready === workers.length) {
            Atomics.store(startGate, 0, 1);
            Atomics.notify(startGate, 0);
          }
        } else if (message.type === "starting") {
          starting += 1;
          releaseLockAfterBothStarted();
        } else if (message.type === "locked") {
          locked = true;
          releaseLockAfterBothStarted();
        } else if (message.type === "result") {
          results.push(message.result);
          completed += 1;
          if (completed === workers.length) finish();
        } else if (message.type === "error") {
          finish(Object.assign(new Error(message.error.message), { code: message.error.code }));
        }
      });
    }
  });
}

test("duas conexões SQLite reais para a mesma negociação retornam created e existing sem sobrescrever", async (t) => {
  const filename = await fileFixture(t);
  const results = await runConcurrentWorkers(filename, [
    input(),
    input({ chargeDescription: "não sobrescrever" }),
  ]);
  const check = new Database(filename, { readonly: true });
  t.after(() => check.close());

  const created = results.find((result) => result.outcome === "created");
  const existing = results.find((result) => result.outcome === "existing");
  assert.ok(created);
  assert.ok(existing);
  assert.deepEqual(existing.transaction, created.transaction);
  assert.ok(check.prepare("SELECT 1 FROM sqlite_master WHERE type = 'index' AND name = 'ux_billing_transactions_per_transaction_negotiation'").get());
  assert.deepEqual(check.prepare("SELECT count(*) AS count FROM billing_transactions WHERE negotiation_id = 'neg-1'").get(), { count: 1 });
  assert.deepEqual(check.prepare("SELECT amount, status, description FROM billing_transactions WHERE negotiation_id = 'neg-1'").get(), {
    amount: created.transaction.amount, status: created.transaction.status, description: created.transaction.description,
  });
  assert.deepEqual(counters(check), { count: 1, amount: 25 });
});

test("duas conexões SQLite reais próximas ao teto criam uma pending de 10 e uma exempt", async (t) => {
  const filename = await fileFixture(t, { monthlyAmountPaid: 340, negotiationIds: ["neg-1", "neg-2"] });
  const results = await runConcurrentWorkers(filename, [
    input({ negotiationId: "neg-1" }),
    input({ negotiationId: "neg-2" }),
  ]);
  const check = new Database(filename, { readonly: true });
  t.after(() => check.close());

  assert.equal(results.filter((result) => result.outcome === "created").length, 2);
  assert.deepEqual(check.prepare("SELECT status, amount FROM billing_transactions ORDER BY amount, status").all(), [
    { status: "exempt", amount: 0 },
    { status: "pending", amount: 10 },
  ]);
  assert.deepEqual(counters(check), { count: 1, amount: 350 });
});
