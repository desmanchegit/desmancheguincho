import { randomUUID } from "node:crypto";
import {
  AsaasCreationIntentConflictError,
  type AsaasCreationIntent,
  type ClaimAsaasCreationIntentResult,
  type MarkAsaasCreationIntentResult,
} from "./asaas-intents";
import {
  asaasExternalReferences,
  hashAsaasCreationParameters,
} from "./asaas-idempotency";
import type { BillingTransactionForAsaasPayment, CompleteAsaasPaymentLinkResult } from "./asaas-payment-links";
import { AsaasPaymentDueDateInvalidError } from "./asaas-payment-links";
import type { AsaasListResult, AsaasPaymentListItem, CreateAsaasChargeDetailedResult } from "./asaas";
import type { EnsureAsaasCustomerResult } from "./asaas-customer-service";

export type EnsureAsaasPaymentResult =
  | { outcome: "ready"; paymentId: string; paymentLink?: string }
  | { outcome: "busy" }
  | { outcome: "ambiguous" }
  | { outcome: "failed"; errorCode: string }
  | { outcome: "conflict" }
  | { outcome: "not_found" };

export type AsaasPaymentServiceDependencies = {
  getBillingTransaction(id: string): BillingTransactionForAsaasPayment | null;
  persistOrReuseDueDate(input: { billingTransactionId: string; dueDate: string }): string | null;
  associateIntent(input: { billingTransactionId: string; intentId: string }): "associated" | "conflict" | "not_found";
  completePayment(input: { intentId: string; billingTransactionId: string; leaseOwner?: string; paymentId?: string; paymentLink?: string }): CompleteAsaasPaymentLinkResult;
  ensureCustomer(desmancheId: string): Promise<EnsureAsaasCustomerResult>;
  createOrGetIntent(input: {
    intentId: string; resourceType: "payment"; entityType: "billing_transaction"; entityId: string;
    operationKey: "charge"; externalReference: string; parameterHash: string;
  }): AsaasCreationIntent;
  claimIntent(input: { intentId: string; leaseOwner: string; leaseDurationSeconds: number }): ClaimAsaasCreationIntentResult;
  markAmbiguous(input: { intentId: string; leaseOwner: string; errorCode: string }): MarkAsaasCreationIntentResult;
  markFailed(input: { intentId: string; leaseOwner: string; errorCode: string }): MarkAsaasCreationIntentResult;
  listPaymentsByExternalReference(reference: string): Promise<AsaasListResult<AsaasPaymentListItem>>;
  createCharge(data: {
    customerId: string; value: number; dueDate: string; description: string; billingType: "UNDEFINED"; externalReference: string;
  }): Promise<CreateAsaasChargeDetailedResult>;
  getDueDateString(daysFromNow: number): string;
};

function cents(value: number): number | null {
  if (!Number.isFinite(value) || value <= 0) return null;
  const amountCents = Math.round(value * 100);
  if (!Number.isSafeInteger(amountCents) || Math.abs(value * 100 - amountCents) > 1e-8) return null;
  return amountCents;
}

function paymentLink(payment: { invoiceUrl?: string; bankSlipUrl?: string }): string | undefined {
  return payment.invoiceUrl || payment.bankSlipUrl;
}

function terminal(
  result: MarkAsaasCreationIntentResult,
  outcome: "ambiguous" | "failed",
  errorCode?: string,
): EnsureAsaasPaymentResult {
  return result.outcome === "marked"
    ? outcome === "failed" ? { outcome, errorCode: errorCode! } : { outcome }
    : result.outcome === "not_found" ? { outcome: "not_found" } : { outcome: "conflict" };
}

function lookupError(result: AsaasListResult<unknown>): string {
  return `PAYMENT_LOOKUP_${result.ok ? "UNKNOWN" : result.errorType.toUpperCase()}${!result.ok && result.statusCode ? `_${result.statusCode}` : ""}`;
}

function matchesExpected(
  payment: AsaasPaymentListItem,
  expected: { customerId: string; amountCents: number; dueDate: string; billingType: string; externalReference: string },
  requireAll: boolean,
): string | null {
  if (requireAll && (!payment.customer || payment.value === undefined || !payment.dueDate || !payment.billingType || !payment.externalReference)) return "REMOTE_PAYMENT_FIELDS_MISSING";
  if (payment.externalReference !== undefined && payment.externalReference !== expected.externalReference) return "REMOTE_PAYMENT_REFERENCE_MISMATCH";
  if (payment.customer !== undefined && payment.customer !== expected.customerId) return "REMOTE_PAYMENT_CUSTOMER_MISMATCH";
  if (payment.value !== undefined && cents(payment.value) !== expected.amountCents) return "REMOTE_PAYMENT_VALUE_MISMATCH";
  if (payment.dueDate !== undefined && payment.dueDate !== expected.dueDate) return "REMOTE_PAYMENT_DUE_DATE_MISMATCH";
  if (payment.billingType !== undefined && payment.billingType !== expected.billingType) return "REMOTE_PAYMENT_BILLING_TYPE_MISMATCH";
  return null;
}

function complete(
  deps: AsaasPaymentServiceDependencies,
  input: { intentId: string; billingTransactionId: string; leaseOwner?: string; paymentId?: string; paymentLink?: string },
): EnsureAsaasPaymentResult {
  const result = deps.completePayment(input);
  if (result.outcome === "linked") return { outcome: "ready", paymentId: result.paymentId, ...(result.paymentLink ? { paymentLink: result.paymentLink } : {}) };
  return { outcome: result.outcome };
}

/**
 * Ensures exactly one recoverable Asaas payment intent for an existing billing
 * transaction. HTTP happens only after local intent/due-date state is durable.
 */
export async function ensureAsaasPaymentForBillingTransaction(
  input: { billingTransactionId: string; desmancheId: string },
  deps: AsaasPaymentServiceDependencies,
): Promise<EnsureAsaasPaymentResult> {
  const tx = deps.getBillingTransaction(input.billingTransactionId);
  if (!tx) return { outcome: "not_found" };
  if (tx.desmancheId !== input.desmancheId || tx.status !== "pending" || tx.type === "monthly_cycle") return { outcome: "conflict" };
  const amountCents = cents(tx.amount);
  if (amountCents === null) return { outcome: "failed", errorCode: "BILLING_AMOUNT_INVALID" };
  if (tx.asaasChargeId) return { outcome: "ready", paymentId: tx.asaasChargeId, ...(tx.paymentLink ? { paymentLink: tx.paymentLink } : {}) };

  // A persisted intent without its persisted due date is inconsistent state.
  // Do not invent a new date, because that would change the intent hash.
  if (tx.asaasCreationIntentId && tx.asaasDueDate === null) return { outcome: "conflict" };
  let dueDate: string | null;
  try {
    dueDate = deps.persistOrReuseDueDate({
      billingTransactionId: tx.id,
      dueDate: tx.asaasDueDate || deps.getDueDateString(3),
    });
  } catch (error) {
    if (error instanceof AsaasPaymentDueDateInvalidError || (error instanceof Error && error.name === "AsaasPaymentDueDateInvalidError")) {
      return { outcome: "conflict" };
    }
    throw error;
  }
  if (!dueDate) return { outcome: "not_found" };

  const customer = await deps.ensureCustomer(tx.desmancheId);
  if (customer.outcome !== "ready") return customer.outcome === "failed"
    ? { outcome: "failed", errorCode: customer.errorCode }
    : { outcome: customer.outcome };
  const externalReference = asaasExternalReferences.billingTransactionPayment(tx.id);
  const expected = { customerId: customer.customerId, amountCents, dueDate, billingType: "UNDEFINED", externalReference };
  let intent: AsaasCreationIntent;
  try {
    intent = deps.createOrGetIntent({
      intentId: randomUUID(), resourceType: "payment", entityType: "billing_transaction", entityId: tx.id,
      operationKey: "charge", externalReference,
      parameterHash: hashAsaasCreationParameters({
        resourceType: "payment", entityType: "billing_transaction", entityId: tx.id,
        operationKey: "charge", externalReference, customerId: expected.customerId,
        amountCents: expected.amountCents, dueDate: expected.dueDate, billingType: expected.billingType,
      }),
    });
  } catch (error) {
    if (error instanceof AsaasCreationIntentConflictError || (error instanceof Error && error.name === "AsaasCreationIntentConflictError")) return { outcome: "conflict" };
    throw error;
  }
  const associated = deps.associateIntent({ billingTransactionId: tx.id, intentId: intent.intentId });
  if (associated === "not_found") return { outcome: "not_found" };
  if (associated !== "associated") return { outcome: "conflict" };

  const leaseOwner = randomUUID();
  const claim = deps.claimIntent({ intentId: intent.intentId, leaseOwner, leaseDurationSeconds: 45 });
  if (claim.outcome === "busy") return { outcome: "busy" };
  if (claim.outcome === "created") return complete(deps, { intentId: intent.intentId, billingTransactionId: tx.id });
  if (claim.outcome !== "claimed") return { outcome: "conflict" };

  const lookup = await deps.listPaymentsByExternalReference(externalReference);
  if (!lookup.ok) return terminal(deps.markAmbiguous({ intentId: intent.intentId, leaseOwner, errorCode: lookupError(lookup) }), "ambiguous");
  if (lookup.data.length > 0 && lookup.data.some((payment) => payment.externalReference !== externalReference)) {
    return terminal(deps.markAmbiguous({ intentId: intent.intentId, leaseOwner, errorCode: "REMOTE_PAYMENT_REFERENCE_INCONSISTENT" }), "ambiguous");
  }
  if (lookup.data.length > 1) return terminal(deps.markAmbiguous({ intentId: intent.intentId, leaseOwner, errorCode: "REMOTE_DUPLICATE_REFERENCE" }), "ambiguous");
  if (lookup.data.length === 1) {
    const mismatch = matchesExpected(lookup.data[0], expected, true);
    if (mismatch) return terminal(deps.markAmbiguous({ intentId: intent.intentId, leaseOwner, errorCode: mismatch }), "ambiguous");
    return complete(deps, { intentId: intent.intentId, billingTransactionId: tx.id, leaseOwner, paymentId: lookup.data[0].id, paymentLink: paymentLink(lookup.data[0]) });
  }

  const created = await deps.createCharge({
    customerId: expected.customerId, value: tx.amount, dueDate, billingType: "UNDEFINED", externalReference,
    description: tx.description || `Central dos Desmanches — transação #${tx.id.slice(0, 8)}`,
  });
  if (!created.ok) {
    const errorCode = `PAYMENT_POST_${created.errorType.toUpperCase()}${created.statusCode ? `_${created.statusCode}` : ""}`;
    if (created.errorType === "http" && created.statusCode && created.statusCode >= 400 && created.statusCode < 500) {
      return terminal(deps.markFailed({ intentId: intent.intentId, leaseOwner, errorCode: created.errorCode || errorCode }), "failed", created.errorCode || errorCode);
    }
    return terminal(deps.markAmbiguous({ intentId: intent.intentId, leaseOwner, errorCode }), "ambiguous");
  }
  const mismatch = matchesExpected(created.payment, expected, false);
  if (mismatch) return terminal(deps.markAmbiguous({ intentId: intent.intentId, leaseOwner, errorCode: mismatch }), "ambiguous");
  return complete(deps, { intentId: intent.intentId, billingTransactionId: tx.id, leaseOwner, paymentId: created.payment.id, paymentLink: paymentLink(created.payment) });
}
