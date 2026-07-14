import type Database from "better-sqlite3";

export type BillingTransactionForAsaasPayment = {
  id: string;
  desmancheId: string;
  amount: number;
  status: string;
  type: string;
  description: string | null;
  asaasChargeId: string | null;
  asaasCreationIntentId: string | null;
  asaasDueDate: string | null;
  paymentLink: string | null;
};

export type CompleteAsaasPaymentLinkResult =
  | { outcome: "linked"; paymentId: string; paymentLink?: string }
  | { outcome: "conflict" }
  | { outcome: "not_found" };

/** A due date in durable state cannot safely be reconciled with Asaas. */
export class AsaasPaymentDueDateInvalidError extends Error {
  constructor() {
    super("Asaas payment due date must be a real YYYY-MM-DD date");
    this.name = "AsaasPaymentDueDateInvalidError";
  }
}

type IntentRow = {
  resource_type: string;
  entity_type: string;
  entity_id: string;
  status: string;
  asaas_resource_id: string | null;
  lease_owner: string | null;
};

function toBillingTransaction(row: Record<string, unknown>): BillingTransactionForAsaasPayment {
  return {
    id: row.id as string,
    desmancheId: row.desmanche_id as string,
    amount: row.amount as number,
    status: row.status as string,
    type: row.type as string,
    description: row.description as string | null,
    asaasChargeId: row.asaas_charge_id as string | null,
    asaasCreationIntentId: row.asaas_creation_intent_id as string | null,
    asaasDueDate: row.asaas_due_date as string | null,
    paymentLink: row.payment_link as string | null,
  };
}

function assertStrictDueDate(value: unknown): asserts value is string {
  if (typeof value !== "string") throw new AsaasPaymentDueDateInvalidError();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new AsaasPaymentDueDateInvalidError();

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1 || month < 1 || month > 12) throw new AsaasPaymentDueDateInvalidError();
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
  if (day < 1 || day > daysInMonth) throw new AsaasPaymentDueDateInvalidError();
}

/** SQLite-only payment operations. They never perform HTTP work. */
export function createAsaasPaymentLinkStore(sqlite: Database.Database) {
  const selectBillingTransaction = sqlite.prepare(`
    SELECT id, desmanche_id, amount, status, type, description,
           asaas_charge_id, asaas_creation_intent_id, asaas_due_date, payment_link
    FROM billing_transactions WHERE id = ?
  `);
  const selectIntent = sqlite.prepare(`
    SELECT resource_type, entity_type, entity_id, status, asaas_resource_id, lease_owner
    FROM asaas_creation_intents WHERE intent_id = ?
  `);

  const getBillingTransactionForAsaasPayment = (id: string): BillingTransactionForAsaasPayment | null => {
    const row = selectBillingTransaction.get(id) as Record<string, unknown> | undefined;
    return row ? toBillingTransaction(row) : null;
  };

  const persistOrReuseAsaasDueDate = sqlite.transaction((input: { billingTransactionId: string; dueDate: string }): string | null => {
    assertStrictDueDate(input.dueDate);
    const current = selectBillingTransaction.get(input.billingTransactionId) as Record<string, unknown> | undefined;
    if (!current) return null;
    if (current.asaas_due_date !== null) {
      assertStrictDueDate(current.asaas_due_date);
      return current.asaas_due_date;
    }
    sqlite.prepare(`
      UPDATE billing_transactions SET asaas_due_date = ?
      WHERE id = ? AND asaas_due_date IS NULL
    `).run(input.dueDate, input.billingTransactionId);
    const reloaded = selectBillingTransaction.get(input.billingTransactionId) as Record<string, unknown> | undefined;
    if (!reloaded) {
      throw new Error("Asaas payment due date was not persisted");
    }
    assertStrictDueDate(reloaded.asaas_due_date);
    return reloaded.asaas_due_date;
  });

  const associateAsaasCreationIntent = sqlite.transaction((input: { billingTransactionId: string; intentId: string }): "associated" | "conflict" | "not_found" => {
    const tx = selectBillingTransaction.get(input.billingTransactionId) as Record<string, unknown> | undefined;
    if (!tx) return "not_found";
    if (tx.asaas_creation_intent_id && tx.asaas_creation_intent_id !== input.intentId) return "conflict";
    if (tx.asaas_creation_intent_id === input.intentId) return "associated";
    const update = sqlite.prepare(`
      UPDATE billing_transactions SET asaas_creation_intent_id = ?
      WHERE id = ? AND asaas_creation_intent_id IS NULL
    `).run(input.intentId, input.billingTransactionId);
    if (update.changes !== 1) return "conflict";
    return "associated";
  });

  const completeAsaasPayment = sqlite.transaction((input: {
    intentId: string;
    billingTransactionId: string;
    leaseOwner?: string;
    paymentId?: string;
    paymentLink?: string;
  }): CompleteAsaasPaymentLinkResult => {
    const intent = selectIntent.get(input.intentId) as IntentRow | undefined;
    if (!intent) return { outcome: "not_found" };
    const txRow = selectBillingTransaction.get(input.billingTransactionId) as Record<string, unknown> | undefined;
    if (!txRow) return { outcome: "not_found" };
    const tx = toBillingTransaction(txRow);
    if (intent.resource_type !== "payment" || intent.entity_type !== "billing_transaction" || intent.entity_id !== tx.id) return { outcome: "conflict" };
    if (tx.asaasCreationIntentId !== input.intentId) return { outcome: "conflict" };
    if (intent.status !== "creating" && intent.status !== "created") return { outcome: "conflict" };
    if (intent.status === "creating" && intent.lease_owner !== input.leaseOwner) return { outcome: "conflict" };

    const paymentId = intent.status === "created" ? intent.asaas_resource_id : input.paymentId;
    if (!paymentId) return { outcome: "conflict" };
    if (tx.asaasChargeId && tx.asaasChargeId !== paymentId) return { outcome: "conflict" };

    if (!tx.asaasChargeId) {
      const link = sqlite.prepare(`
        UPDATE billing_transactions SET asaas_charge_id = ?
        WHERE id = ? AND asaas_charge_id IS NULL
      `).run(paymentId, tx.id);
      if (link.changes !== 1) throw new Error("Asaas payment link did not update exactly one row");
    }
    if (!tx.paymentLink && input.paymentLink) {
      const link = sqlite.prepare(`
        UPDATE billing_transactions SET payment_link = ?
        WHERE id = ? AND payment_link IS NULL
      `).run(input.paymentLink, tx.id);
      if (link.changes !== 1) throw new Error("Asaas payment URL did not update exactly one row");
    }
    if (intent.status === "creating") {
      const finalize = sqlite.prepare(`
        UPDATE asaas_creation_intents
        SET status = 'created', asaas_resource_id = ?, lease_owner = NULL, lease_expires_at = NULL,
            last_error_code = NULL, updated_at = strftime('%s', 'now')
        WHERE intent_id = ? AND status = 'creating' AND lease_owner = ?
      `).run(paymentId, input.intentId, input.leaseOwner);
      if (finalize.changes !== 1) throw new Error("Asaas payment intent finalization did not update exactly one row");
    }
    return { outcome: "linked", paymentId, ...(input.paymentLink || tx.paymentLink ? { paymentLink: input.paymentLink || tx.paymentLink! } : {}) };
  });

  return {
    getBillingTransactionForAsaasPayment,
    persistOrReuseAsaasDueDate,
    associateAsaasCreationIntent,
    completeAsaasPayment,
  };
}
