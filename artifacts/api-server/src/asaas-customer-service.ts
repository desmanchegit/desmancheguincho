import { randomUUID } from "node:crypto";
import {
  asaasExternalReferences,
  hashAsaasCreationParameters,
} from "./asaas-idempotency";
import { AsaasCreationIntentConflictError } from "./asaas-intents";
import type { AsaasCreationIntent, ClaimAsaasCreationIntentResult, MarkAsaasCreationIntentResult } from "./asaas-intents";
import type { AsaasCustomerListItem, AsaasListResult, CreateAsaasCustomerDetailedResult } from "./asaas";

export type EnsureAsaasCustomerResult =
  | { outcome: "ready"; customerId: string }
  | { outcome: "busy" }
  | { outcome: "ambiguous" }
  | { outcome: "failed"; errorCode: string }
  | { outcome: "conflict" };

type EntityType = "desmanche" | "guincho";
type CustomerInput = { id: string; name: string; email: string; phone: string; cpfCnpj: string; asaasCustomerId?: string | null };
type Completion = { outcome: "linked"; customerId: string } | { outcome: "conflict" } | { outcome: "not_found" };

export type AsaasCustomerServiceDependencies = {
  getDesmanche(id: string): Promise<CustomerInput | null>;
  getGuincho(id: string): Promise<CustomerInput | null>;
  getDesmancheCustomerId(id: string): Promise<string | null>;
  createOrGetIntent(input: { intentId: string; resourceType: "customer"; entityType: EntityType; entityId: string; operationKey: "customer"; externalReference: string; parameterHash: string }): AsaasCreationIntent;
  claimIntent(input: { intentId: string; leaseOwner: string; leaseDurationSeconds: number }): ClaimAsaasCreationIntentResult;
  markAmbiguous(input: { intentId: string; leaseOwner: string; errorCode: string }): MarkAsaasCreationIntentResult;
  markFailed(input: { intentId: string; leaseOwner: string; errorCode: string }): MarkAsaasCreationIntentResult;
  completeDesmanche(input: { intentId: string; desmancheId: string; leaseOwner?: string; customerId?: string }): Completion;
  completeGuincho(input: { intentId: string; guinchoId: string; leaseOwner?: string; customerId?: string }): Completion;
  listByExternalReference(reference: string): Promise<AsaasListResult<AsaasCustomerListItem>>;
  listByCpfCnpj(cpfCnpj: string): Promise<AsaasListResult<AsaasCustomerListItem>>;
  createCustomer(data: { name: string; email: string; phone: string; cpfCnpj: string; externalReference: string }): Promise<CreateAsaasCustomerDetailedResult>;
};

function lookupError(prefix: string, result: Exclude<AsaasListResult<AsaasCustomerListItem>, { ok: true }>): string {
  return `${prefix}_${result.errorType.toUpperCase()}${result.statusCode ? `_${result.statusCode}` : ""}`;
}

function terminal(result: MarkAsaasCreationIntentResult, outcome: "ambiguous" | "failed", errorCode?: string): EnsureAsaasCustomerResult {
  return result.outcome === "marked" ? (outcome === "failed" ? { outcome, errorCode: errorCode! } : { outcome }) : { outcome: "conflict" };
}

async function ensure(entityType: EntityType, entityId: string, deps: AsaasCustomerServiceDependencies): Promise<EnsureAsaasCustomerResult> {
  const entity = entityType === "desmanche" ? await deps.getDesmanche(entityId) : await deps.getGuincho(entityId);
  if (!entity) return { outcome: "failed", errorCode: "LOCAL_ENTITY_NOT_FOUND" };
  const localCustomerId = entityType === "desmanche"
    ? await deps.getDesmancheCustomerId(entityId)
    : entity.asaasCustomerId ?? null;
  if (localCustomerId) return { outcome: "ready", customerId: localCustomerId };

  const externalReference = entityType === "desmanche"
    ? asaasExternalReferences.desmancheCustomer(entityId)
    : asaasExternalReferences.guinchoCustomer(entityId);
  let intent: AsaasCreationIntent;
  try {
    intent = deps.createOrGetIntent({
      intentId: randomUUID(), resourceType: "customer", entityType, entityId, operationKey: "customer", externalReference,
      // Intentionally only immutable non-personal identifiers are hashed.
      parameterHash: hashAsaasCreationParameters({ resourceType: "customer", entityType, entityId, operationKey: "customer", externalReference }),
    });
  } catch (error) {
    // A key collision is an expected, controlled state. Do not log this error:
    // callers may provide personal customer fields to this service.
    // The name check keeps this specific error recognizable when independent
    // bundled entry points contain separate copies of the class constructor.
    if (error instanceof AsaasCreationIntentConflictError || (error instanceof Error && error.name === "AsaasCreationIntentConflictError")) {
      return { outcome: "conflict" };
    }
    throw error;
  }
  const leaseOwner = randomUUID();
  const claim = deps.claimIntent({ intentId: intent.intentId, leaseOwner, leaseDurationSeconds: 45 });
  const complete = (customerId?: string, owner?: string): Completion => entityType === "desmanche"
    ? deps.completeDesmanche({ intentId: intent.intentId, desmancheId: entityId, leaseOwner: owner, customerId })
    : deps.completeGuincho({ intentId: intent.intentId, guinchoId: entityId, leaseOwner: owner, customerId });
  if (claim.outcome === "busy") return { outcome: "busy" };
  if (claim.outcome === "created") {
    if (!claim.asaasResourceId) return { outcome: "conflict" };
    const linked = complete(undefined);
    return linked.outcome === "linked" ? { outcome: "ready", customerId: linked.customerId } : { outcome: "conflict" };
  }
  if (claim.outcome !== "claimed") return { outcome: "conflict" };

  const byReference = await deps.listByExternalReference(externalReference);
  if (!byReference.ok) return terminal(deps.markAmbiguous({ intentId: intent.intentId, leaseOwner, errorCode: lookupError("CUSTOMER_LOOKUP_REFERENCE", byReference) }), "ambiguous");
  if (byReference.data.length > 1) return terminal(deps.markAmbiguous({ intentId: intent.intentId, leaseOwner, errorCode: "REMOTE_DUPLICATE_REFERENCE" }), "ambiguous");
  if (byReference.data.length === 1) {
    const linked = complete(byReference.data[0].id, leaseOwner);
    return linked.outcome === "linked" ? { outcome: "ready", customerId: linked.customerId } : { outcome: "conflict" };
  }

  if (!entity.cpfCnpj.replace(/\D/g, "")) {
    return terminal(deps.markFailed({ intentId: intent.intentId, leaseOwner, errorCode: "CUSTOMER_DOCUMENT_MISSING" }), "failed", "CUSTOMER_DOCUMENT_MISSING");
  }
  const byDocument = await deps.listByCpfCnpj(entity.cpfCnpj);
  if (!byDocument.ok) return terminal(deps.markAmbiguous({ intentId: intent.intentId, leaseOwner, errorCode: lookupError("CUSTOMER_LOOKUP_DOCUMENT", byDocument) }), "ambiguous");
  if (byDocument.data.length > 1) return terminal(deps.markAmbiguous({ intentId: intent.intentId, leaseOwner, errorCode: "REMOTE_DUPLICATE_DOCUMENT" }), "ambiguous");
  if (byDocument.data.length === 1) {
    const linked = complete(byDocument.data[0].id, leaseOwner);
    return linked.outcome === "linked" ? { outcome: "ready", customerId: linked.customerId } : { outcome: "conflict" };
  }

  const created = await deps.createCustomer({ name: entity.name, email: entity.email, phone: entity.phone, cpfCnpj: entity.cpfCnpj, externalReference });
  if (created.ok) {
    const linked = complete(created.customer.id, leaseOwner);
    return linked.outcome === "linked" ? { outcome: "ready", customerId: linked.customerId } : { outcome: "conflict" };
  }
  const errorCode = `CUSTOMER_POST_${created.errorType.toUpperCase()}${created.statusCode ? `_${created.statusCode}` : ""}`;
  if (created.errorType === "http" && created.statusCode && created.statusCode >= 400 && created.statusCode < 500) {
    return terminal(deps.markFailed({ intentId: intent.intentId, leaseOwner, errorCode: created.errorCode ?? errorCode }), "failed", created.errorCode ?? errorCode);
  }
  return terminal(deps.markAmbiguous({ intentId: intent.intentId, leaseOwner, errorCode }), "ambiguous");
}

export function ensureAsaasCustomerForDesmanche(desmancheId: string, deps: AsaasCustomerServiceDependencies): Promise<EnsureAsaasCustomerResult> {
  return ensure("desmanche", desmancheId, deps);
}

export function ensureAsaasCustomerForGuincho(guinchoId: string, deps: AsaasCustomerServiceDependencies): Promise<EnsureAsaasCustomerResult> {
  return ensure("guincho", guinchoId, deps);
}
