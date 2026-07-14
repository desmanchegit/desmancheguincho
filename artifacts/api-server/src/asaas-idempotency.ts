import { createHash } from "node:crypto";

type JsonPrimitive = null | boolean | number | string;
export type JsonSimpleValue = JsonPrimitive | JsonSimpleValue[] | { [key: string]: JsonSimpleValue };

function assertNonEmptySegment(value: string, label: string): void {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Asaas external reference ${label} must not be empty`);
  }
  if (/\s/.test(value)) {
    throw new Error(`Asaas external reference ${label} must not contain whitespace`);
  }
}

/** Validates a reference without changing any caller-provided identifier. */
export function assertAsaasExternalReference(value: string): void {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error("Asaas external reference must not be blank");
  }
  if (/\s/.test(value)) {
    throw new Error("Asaas external reference must not contain whitespace");
  }
  if (value.length > 100) {
    throw new Error("Asaas external reference must contain at most 100 characters");
  }
}

function buildReference(prefix: string, segments: Array<[string, string]>): string {
  for (const [label, value] of segments) assertNonEmptySegment(value, label);
  const reference = [prefix, ...segments.map(([, value]) => value)].join(":");
  assertAsaasExternalReference(reference);
  return reference;
}

export const asaasExternalReferences = {
  desmancheCustomer(desmancheId: string): string {
    return buildReference("cdd:c:d", [["desmanche id", desmancheId]]);
  },
  guinchoCustomer(guinchoId: string): string {
    return buildReference("cdd:c:g", [["guincho id", guinchoId]]);
  },
  billingTransactionPayment(billingTransactionId: string): string {
    return buildReference("cdd:p:bt", [["billing transaction id", billingTransactionId]]);
  },
  monthlyConsolidatedPayment(intentId: string): string {
    return buildReference("cdd:p:mc", [["intent id", intentId]]);
  },
  guinchoAnnualPayment(guinchoId: string): string {
    return buildReference("cdd:p:g", [["guincho id", guinchoId], ["plan", "annual"]]);
  },
  guinchoMonthlySubscription(guinchoId: string): string {
    return buildReference("cdd:s:g", [["guincho id", guinchoId], ["plan", "p:monthly"]]);
  },
};

function canonicalize(value: unknown, path: string, seen: Set<object>): JsonSimpleValue {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error(`Cannot hash non-finite JSON number at ${path}`);
    return value;
  }
  if (typeof value === "undefined" || typeof value === "function" || typeof value === "symbol" || typeof value === "bigint") {
    throw new Error(`Cannot hash non-JSON value at ${path}`);
  }
  if (Array.isArray(value)) {
    if (seen.has(value)) throw new Error(`Cannot hash circular JSON value at ${path}`);
    seen.add(value);
    const normalized = value.map((item, index) => canonicalize(item, `${path}[${index}]`, seen));
    seen.delete(value);
    return normalized;
  }
  if (typeof value === "object") {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new Error(`Cannot hash non-JSON object at ${path}`);
    }
    if (seen.has(value)) throw new Error(`Cannot hash circular JSON value at ${path}`);
    seen.add(value);
    const normalized: { [key: string]: JsonSimpleValue } = {};
    for (const key of Object.keys(value).sort()) {
      normalized[key] = canonicalize((value as Record<string, unknown>)[key], `${path}.${key}`, seen);
    }
    seen.delete(value);
    return normalized;
  }
  throw new Error(`Cannot hash non-JSON value at ${path}`);
}

/** SHA-256 of recursively key-sorted, JSON-simple data. It deliberately does not log input. */
export function hashAsaasCreationParameters(value: unknown): string {
  const canonical = canonicalize(value, "$", new Set());
  return createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
}
