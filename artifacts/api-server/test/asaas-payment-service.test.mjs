import assert from "node:assert/strict";
import Database from "better-sqlite3";
import test from "node:test";
import {
  createAsaasCreationIntentStore,
  initializeAsaasCreationIntentSchema,
} from "../dist/asaas-intents.mjs";
import { createAsaasPaymentLinkStore } from "../dist/asaas-payment-links.mjs";
import { ensureAsaasPaymentForBillingTransaction } from "../dist/asaas-payment-service.mjs";
import { hashAsaasCreationParameters } from "../dist/asaas-idempotency.mjs";

const txId = "123e4567-e89b-12d3-a456-426614174000";
const desmancheId = "desmanche-1";
const reference = `cdd:p:bt:${txId}`;

function fixture(overrides = {}) {
  const sqlite = new Database(":memory:");
  sqlite.exec(`CREATE TABLE billing_transactions (
    id TEXT PRIMARY KEY, desmanche_id TEXT NOT NULL, amount REAL NOT NULL, status TEXT NOT NULL,
    type TEXT NOT NULL, description TEXT, asaas_charge_id TEXT, asaas_creation_intent_id TEXT,
    asaas_due_date TEXT, payment_link TEXT
  )`);
  sqlite.prepare("INSERT INTO billing_transactions VALUES (?, ?, ?, 'pending', 'per_transaction', 'private description', NULL, NULL, NULL, NULL)").run(txId, desmancheId, 25);
  initializeAsaasCreationIntentSchema(sqlite);
  const intents = createAsaasCreationIntentStore(sqlite);
  const links = createAsaasPaymentLinkStore(sqlite);
  const calls = { get: 0, post: 0, intent: [] };
  const remote = [];
  const deps = {
    getBillingTransaction: links.getBillingTransactionForAsaasPayment,
    persistOrReuseDueDate: links.persistOrReuseAsaasDueDate,
    associateIntent: links.associateAsaasCreationIntent,
    completePayment: links.completeAsaasPayment,
    async ensureCustomer() { return { outcome: "ready", customerId: "cus_1" }; },
    createOrGetIntent(input) { calls.intent.push(input); return intents.createOrGetAsaasCreationIntent(input); },
    claimIntent: intents.claimAsaasCreationIntent,
    markAmbiguous: intents.markAsaasCreationIntentAmbiguous,
    markFailed: intents.markAsaasCreationIntentFailed,
    async listPaymentsByExternalReference() { calls.get++; return { ok: true, data: remote }; },
    async createCharge(data) {
      calls.post++;
      const payment = { id: `pay_${calls.post}`, customer: data.customerId, value: data.value, dueDate: data.dueDate, billingType: data.billingType, externalReference: data.externalReference, invoiceUrl: "https://pay.test/link" };
      remote.push(payment);
      return { ok: true, payment };
    },
    getDueDateString() { return "2030-01-03"; },
    ...overrides,
  };
  return { sqlite, intents, links, calls, remote, deps };
}

async function run(f, id = txId, owner = desmancheId) {
  return ensureAsaasPaymentForBillingTransaction({ billingTransactionId: id, desmancheId: owner }, f.deps);
}

test("pagamento local existente retorna ready sem rede", async (t) => {
  const f = fixture(); t.after(() => f.sqlite.close());
  f.sqlite.prepare("UPDATE billing_transactions SET asaas_charge_id = 'pay_local', payment_link = 'link_local' WHERE id = ?").run(txId);
  assert.deepEqual(await run(f), { outcome: "ready", paymentId: "pay_local", paymentLink: "link_local" });
  assert.deepEqual(f.calls, { get: 0, post: 0, intent: [] });
});

test("reconcilia referência exata sem POST e cria um POST somente quando zero", async (t) => {
  const found = fixture(); t.after(() => found.sqlite.close());
  found.remote.push({ id: "pay_remote", customer: "cus_1", value: 25, dueDate: "2030-01-03", billingType: "UNDEFINED", externalReference: reference, bankSlipUrl: "slip" });
  assert.deepEqual(await run(found), { outcome: "ready", paymentId: "pay_remote", paymentLink: "slip" });
  assert.equal(found.calls.post, 0);

  const empty = fixture(); t.after(() => empty.sqlite.close());
  assert.deepEqual(await run(empty), { outcome: "ready", paymentId: "pay_1", paymentLink: "https://pay.test/link" });
  assert.equal(empty.calls.get, 1); assert.equal(empty.calls.post, 1);
});

test("respostas remotas com referência inconsistente são ambiguous sem POST nem vínculo", async (t) => {
  for (const remote of [
    [
      { id: "pay_1", customer: "cus_1", value: 25, dueDate: "2030-01-03", billingType: "UNDEFINED", externalReference: reference },
      { id: "pay_2", customer: "cus_1", value: 25, dueDate: "2030-01-03", billingType: "UNDEFINED", externalReference: reference },
    ],
    [{ id: "pay_other", customer: "cus_1", value: 25, dueDate: "2030-01-03", billingType: "UNDEFINED", externalReference: "cdd:p:bt:other" }],
    [{ id: "pay_missing", customer: "cus_1", value: 25, dueDate: "2030-01-03", billingType: "UNDEFINED" }],
    [
      { id: "pay_exact", customer: "cus_1", value: 25, dueDate: "2030-01-03", billingType: "UNDEFINED", externalReference: reference },
      { id: "pay_other", customer: "cus_1", value: 25, dueDate: "2030-01-03", billingType: "UNDEFINED", externalReference: "cdd:p:bt:other" },
    ],
    [{ id: "pay_bad", customer: "cus_other", value: 25, dueDate: "2030-01-03", billingType: "UNDEFINED", externalReference: reference }],
    [{ id: "pay_bad", customer: "cus_1", value: 26, dueDate: "2030-01-03", billingType: "UNDEFINED", externalReference: reference }],
    [{ id: "pay_bad", customer: "cus_1", value: 25, dueDate: "2030-01-04", billingType: "UNDEFINED", externalReference: reference }],
    [{ id: "pay_bad", customer: "cus_1", value: 25, dueDate: "2030-01-03", billingType: "PIX", externalReference: reference }],
  ]) {
    const f = fixture(); t.after(() => f.sqlite.close()); f.remote.push(...remote);
    const result = await run(f);
    assert.equal(result.outcome, "ambiguous");
    assert.equal(f.calls.post, 0);
    assert.equal(f.sqlite.prepare("SELECT asaas_charge_id FROM billing_transactions WHERE id = ?").get(txId).asaas_charge_id, null);
    const errorCode = f.sqlite.prepare("SELECT last_error_code FROM asaas_creation_intents WHERE entity_id = ?").get(txId).last_error_code;
    if (remote.some((payment) => payment.externalReference !== reference)) {
      assert.equal(errorCode, "REMOTE_PAYMENT_REFERENCE_INCONSISTENT");
    }
  }
});

test("falhas de GET não fazem POST; falhas de POST têm estados seguros", async (t) => {
  for (const failure of ["timeout", "network", "http", "invalid_response"]) {
    const f = fixture({ async listPaymentsByExternalReference() { f.calls.get++; return { ok: false, errorType: failure, ...(failure === "http" ? { statusCode: 500 } : {}) }; } }); t.after(() => f.sqlite.close());
    assert.equal((await run(f)).outcome, "ambiguous"); assert.equal(f.calls.post, 0);
  }
  for (const result of [
    { ok: false, errorType: "timeout" }, { ok: false, errorType: "network" }, { ok: false, errorType: "http", statusCode: 500 }, { ok: false, errorType: "invalid_response" },
  ]) {
    const f = fixture({ async createCharge() { f.calls.post++; return result; } }); t.after(() => f.sqlite.close());
    assert.equal((await run(f)).outcome, "ambiguous"); assert.equal(f.calls.post, 1);
  }
  const badRequest = fixture({ async createCharge() { badRequest.calls.post++; return { ok: false, errorType: "http", statusCode: 400, errorCode: "ASAAS_PAYMENT_VALIDATION" }; } }); t.after(() => badRequest.sqlite.close());
  assert.deepEqual(await run(badRequest), { outcome: "failed", errorCode: "ASAAS_PAYMENT_VALIDATION" });
});

test("dois workers fazem no máximo um POST, lease expirado reconcilia antes e created reaplica vínculo", async (t) => {
  const f = fixture(); t.after(() => f.sqlite.close());
  const [a, b] = await Promise.all([run(f), run(f)]);
  assert.equal(f.calls.post, 1); assert.ok([a.outcome, b.outcome].includes("ready"));

  const recovered = fixture(); t.after(() => recovered.sqlite.close());
  let failOnce = true;
  const originalComplete = recovered.deps.completePayment;
  recovered.deps.completePayment = (input) => { if (failOnce) { failOnce = false; throw new Error("simulated crash"); } return originalComplete(input); };
  await assert.rejects(() => run(recovered), /simulated crash/);
  assert.equal(recovered.calls.post, 1);
  recovered.sqlite.prepare("UPDATE asaas_creation_intents SET lease_expires_at = 0 WHERE entity_id = ?").run(txId);
  assert.equal((await run(recovered)).outcome, "ready"); assert.equal(recovered.calls.post, 1);
  recovered.sqlite.prepare("UPDATE billing_transactions SET asaas_charge_id = NULL WHERE id = ?").run(txId);
  assert.equal((await run(recovered)).outcome, "ready"); assert.equal(recovered.calls.post, 1);
});

test("vencimento persistido válido é estrito, estável e não altera o hash", async (t) => {
  const f = fixture(); t.after(() => f.sqlite.close());
  assert.equal(f.links.persistOrReuseAsaasDueDate({ billingTransactionId: txId, dueDate: "2030-01-03" }), "2030-01-03");
  assert.equal(f.links.persistOrReuseAsaasDueDate({ billingTransactionId: txId, dueDate: "2040-01-03" }), "2030-01-03");
  assert.deepEqual(await run(f), { outcome: "ready", paymentId: "pay_1", paymentLink: "https://pay.test/link" });
  assert.deepEqual(await run(f), { outcome: "ready", paymentId: "pay_1", paymentLink: "https://pay.test/link" });
  assert.equal(f.calls.post, 1);
  const input = f.calls.intent[0];
  assert.equal(input.parameterHash, hashAsaasCreationParameters({ resourceType: "payment", entityType: "billing_transaction", entityId: txId, operationKey: "charge", externalReference: reference, customerId: "cus_1", amountCents: 2500, dueDate: "2030-01-03", billingType: "UNDEFINED" }));
  assert.equal(JSON.stringify(input).includes("private description"), false);
});

test("vencimento recebido ou persistido inválido resulta conflict antes de intenção e rede", async (t) => {
  const invalidDueDates = ["", "2030-1-03", "2030-02-30", "texto arbitrário"];
  for (const invalid of invalidDueDates) {
    const direct = fixture(); t.after(() => direct.sqlite.close());
    assert.throws(() => direct.links.persistOrReuseAsaasDueDate({ billingTransactionId: txId, dueDate: invalid }), { name: "AsaasPaymentDueDateInvalidError" });
  }

  for (const invalid of invalidDueDates) {
    const persisted = fixture(); t.after(() => persisted.sqlite.close());
    persisted.sqlite.prepare("UPDATE billing_transactions SET asaas_due_date = ? WHERE id = ?").run(invalid, txId);
    assert.deepEqual(await run(persisted), { outcome: "conflict" });
    assert.deepEqual(persisted.calls, { get: 0, post: 0, intent: [] });
    assert.equal(persisted.sqlite.prepare("SELECT asaas_charge_id FROM billing_transactions WHERE id = ?").get(txId).asaas_charge_id, null);
  }

  const received = fixture({ getDueDateString() { return "2030-1-03"; } }); t.after(() => received.sqlite.close());
  assert.deepEqual(await run(received), { outcome: "conflict" });
  assert.deepEqual(received.calls, { get: 0, post: 0, intent: [] });
});

test("associação divergente conflita", async (t) => {
  const conflict = fixture(); t.after(() => conflict.sqlite.close());
  conflict.sqlite.prepare("UPDATE billing_transactions SET asaas_creation_intent_id = 'other' WHERE id = ?").run(txId);
  assert.equal((await run(conflict)).outcome, "conflict");
});
