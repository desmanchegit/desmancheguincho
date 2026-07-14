import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";

export type BillingTransactionForAutomaticBilling = {
  id: string;
  desmancheId: string;
  negotiationId: string | null;
  amount: number;
  status: string;
  type: string;
  description: string | null;
  asaasChargeId: string | null;
  asaasCreationIntentId: string | null;
  asaasDueDate: string | null;
  paymentLink: string | null;
};

export type CreateOrGetPerTransactionBillingResult =
  | { outcome: "created"; transaction: BillingTransactionForAutomaticBilling }
  | { outcome: "existing"; transaction: BillingTransactionForAutomaticBilling }
  | {
    outcome: "conflict";
    reason: "MULTIPLE_TRANSACTIONS" | "TRANSACTION_TYPE_MISMATCH" | "DESMANCHE_MISMATCH"
      | "NEGOTIATION_MISMATCH" | "AMOUNT_MISMATCH" | "STATUS_MISMATCH"
      | "NEGOTIATION_OWNER_MISMATCH" | "BILLING_MODEL_MISMATCH";
  }
  | { outcome: "not_found" };

export type CreateOrGetPerTransactionBillingInput = {
  desmancheId: string;
  negotiationId: string;
  perTransactionAmount: number;
  monthlyCapAmount: number;
  chargeDescription: string;
  exemptDescription: string;
};

type BillingRow = {
  id: string;
  desmanche_id: string;
  negotiation_id: string | null;
  amount: number;
  status: string;
  type: string;
  description: string | null;
  asaas_charge_id: string | null;
  asaas_creation_intent_id: string | null;
  asaas_due_date: string | null;
  payment_link: string | null;
};

function toTransaction(row: BillingRow): BillingTransactionForAutomaticBilling {
  return {
    id: row.id,
    desmancheId: row.desmanche_id,
    negotiationId: row.negotiation_id,
    amount: row.amount,
    status: row.status,
    type: row.type,
    description: row.description,
    asaasChargeId: row.asaas_charge_id,
    asaasCreationIntentId: row.asaas_creation_intent_id,
    asaasDueDate: row.asaas_due_date,
    paymentLink: row.payment_link,
  };
}

function cents(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new Error("Billing amount must be a non-negative finite monetary value");
  }
  const scaled = value * 100;
  const result = Math.round(scaled);
  if (!Number.isSafeInteger(result) || Math.abs(scaled - result) > 1e-8) {
    throw new Error("Billing amount must have at most two decimal places");
  }
  return result;
}

/**
 * Adds the per-negotiation uniqueness guard only when old data permits it.
 * Existing historical duplicates are intentionally left untouched.
 */
export function initializePerTransactionBillingIndex(sqlite: Database.Database): void {
  const duplicate = sqlite.prepare(`
    SELECT 1
    FROM billing_transactions
    WHERE type = 'per_transaction' AND negotiation_id IS NOT NULL
    GROUP BY negotiation_id
    HAVING COUNT(*) > 1
    LIMIT 1
  `).get();

  if (duplicate) {
    console.warn("[billing] per-transaction uniqueness index skipped because historical duplicates require review");
    return;
  }

  sqlite.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS ux_billing_transactions_per_transaction_negotiation
    ON billing_transactions(negotiation_id)
    WHERE negotiation_id IS NOT NULL
      AND type = 'per_transaction';
  `);
}

/**
 * SQLite-only local claim for the automatic per-transaction path. The caller
 * must perform any HTTP work only after this function has committed.
 */
export function createPerTransactionBillingStore(sqlite: Database.Database) {
  const selectNegotiation = sqlite.prepare(`
    SELECT desmanche_id FROM negotiations WHERE id = ?
  `);
  const selectBilling = sqlite.prepare(`
    SELECT billing_model, monthly_amount_paid
    FROM desmanche_billing
    WHERE desmanche_id = ?
  `);
  const selectTransactions = sqlite.prepare(`
    SELECT id, desmanche_id, negotiation_id, amount, status, type, description,
           asaas_charge_id, asaas_creation_intent_id, asaas_due_date, payment_link
    FROM billing_transactions
    WHERE negotiation_id = ?
    ORDER BY id
  `);
  const selectTransactionById = sqlite.prepare(`
    SELECT id, desmanche_id, negotiation_id, amount, status, type, description,
           asaas_charge_id, asaas_creation_intent_id, asaas_due_date, payment_link
    FROM billing_transactions
    WHERE id = ?
  `);
  const insertTransaction = sqlite.prepare(`
    INSERT INTO billing_transactions (
      id, desmanche_id, negotiation_id, amount, status, type, description,
      asaas_charge_id, asaas_creation_intent_id, asaas_due_date, payment_link
    ) VALUES (?, ?, ?, ?, ?, 'per_transaction', ?, NULL, NULL, NULL, NULL)
  `);
  const incrementCounters = sqlite.prepare(`
    UPDATE desmanche_billing
    SET monthly_transaction_count = monthly_transaction_count + 1,
        monthly_amount_paid = ?
    WHERE desmanche_id = ?
      AND billing_model = 'per_transaction'
  `);

  const transaction = sqlite.transaction((input: CreateOrGetPerTransactionBillingInput): CreateOrGetPerTransactionBillingResult => {
    const negotiation = selectNegotiation.get(input.negotiationId) as { desmanche_id: string } | undefined;
    if (!negotiation) return { outcome: "not_found" };
    if (negotiation.desmanche_id !== input.desmancheId) {
      return { outcome: "conflict", reason: "NEGOTIATION_OWNER_MISMATCH" };
    }

    const billing = selectBilling.get(input.desmancheId) as {
      billing_model: string;
      monthly_amount_paid: unknown;
    } | undefined;
    if (!billing) return { outcome: "not_found" };
    if (billing.billing_model !== "per_transaction") {
      return { outcome: "conflict", reason: "BILLING_MODEL_MISMATCH" };
    }

    const existingRows = selectTransactions.all(input.negotiationId) as BillingRow[];
    if (existingRows.length > 1) return { outcome: "conflict", reason: "MULTIPLE_TRANSACTIONS" };
    if (existingRows.length === 1) {
      const existing = existingRows[0];
      if (existing.type !== "per_transaction") return { outcome: "conflict", reason: "TRANSACTION_TYPE_MISMATCH" };
      if (existing.desmanche_id !== input.desmancheId) return { outcome: "conflict", reason: "DESMANCHE_MISMATCH" };
      if (existing.negotiation_id !== input.negotiationId) return { outcome: "conflict", reason: "NEGOTIATION_MISMATCH" };
      if (existing.status !== "pending" && existing.status !== "exempt") return { outcome: "conflict", reason: "STATUS_MISMATCH" };
      try {
        const existingAmountCents = cents(existing.amount);
        if ((existing.status === "pending" && existingAmountCents <= 0)
          || (existing.status === "exempt" && existingAmountCents !== 0)) {
          return { outcome: "conflict", reason: "AMOUNT_MISMATCH" };
        }
      } catch {
        return { outcome: "conflict", reason: "AMOUNT_MISMATCH" };
      }
      return { outcome: "existing", transaction: toTransaction(existing) };
    }

    // All values involved in the cap calculation are read or converted while
    // the IMMEDIATE transaction owns the SQLite write lock for this database.
    const currentCents = cents(billing.monthly_amount_paid);
    const capCents = cents(input.monthlyCapAmount);
    const perTransactionCents = cents(input.perTransactionAmount);
    const chargeCents = currentCents >= capCents
      ? 0
      : Math.min(perTransactionCents, capCents - currentCents);
    const exempt = chargeCents <= 0;
    const amount = chargeCents / 100;
    const description = exempt ? input.exemptDescription : input.chargeDescription;

    const id = randomUUID();
    const status = exempt ? "exempt" : "pending";
    const inserted = insertTransaction.run(id, input.desmancheId, input.negotiationId, amount, status, description);
    if (inserted.changes !== 1) throw new Error("Per-transaction billing insert must affect exactly one row");

    if (!exempt) {
      const counterUpdate = incrementCounters.run((currentCents + chargeCents) / 100, input.desmancheId);
      if (counterUpdate.changes !== 1) {
        throw new Error("Per-transaction billing counter update must affect exactly one row");
      }
    }

    const created = selectTransactionById.get(id) as BillingRow | undefined;
    if (!created) throw new Error("Per-transaction billing row was not persisted");
    return { outcome: "created", transaction: toTransaction(created) };
  });

  type ImmediateTransaction = typeof transaction & { immediate?: (input: CreateOrGetPerTransactionBillingInput) => CreateOrGetPerTransactionBillingResult };
  const immediateTransaction = transaction as ImmediateTransaction;
  const createOrGetPerTransactionBilling = (input: CreateOrGetPerTransactionBillingInput): CreateOrGetPerTransactionBillingResult =>
    typeof immediateTransaction.immediate === "function" ? immediateTransaction.immediate(input) : transaction(input);

  return { createOrGetPerTransactionBilling };
}
