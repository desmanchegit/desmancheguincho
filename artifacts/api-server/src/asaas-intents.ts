import type Database from "better-sqlite3";
import { assertAsaasExternalReference } from "./asaas-idempotency";

export type AsaasResourceType = "customer" | "payment" | "subscription";
export type AsaasCreationIntentStatus = "pending" | "creating" | "created" | "ambiguous" | "failed";

export type AsaasCreationIntent = {
  intentId: string;
  resourceType: AsaasResourceType;
  entityType: string;
  entityId: string;
  operationKey: string;
  externalReference: string;
  status: AsaasCreationIntentStatus;
  asaasResourceId: string | null;
  parameterHash: string;
  leaseOwner: string | null;
  leaseExpiresAt: number | null;
  lastErrorCode: string | null;
  createdAt: number;
  updatedAt: number;
};

export type CreateAsaasCreationIntentInput = {
  intentId: string;
  resourceType: AsaasResourceType;
  entityType: string;
  entityId: string;
  operationKey: string;
  externalReference: string;
  parameterHash: string;
};

export class AsaasCreationIntentConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AsaasCreationIntentConflictError";
  }
}

type IntentRow = {
  intent_id: string;
  resource_type: AsaasResourceType;
  entity_type: string;
  entity_id: string;
  operation_key: string;
  external_reference: string;
  status: AsaasCreationIntentStatus;
  asaas_resource_id: string | null;
  parameter_hash: string;
  lease_owner: string | null;
  lease_expires_at: number | null;
  last_error_code: string | null;
  created_at: number;
  updated_at: number;
};

function toIntent(row: IntentRow): AsaasCreationIntent {
  return {
    intentId: row.intent_id,
    resourceType: row.resource_type,
    entityType: row.entity_type,
    entityId: row.entity_id,
    operationKey: row.operation_key,
    externalReference: row.external_reference,
    status: row.status,
    asaasResourceId: row.asaas_resource_id,
    parameterHash: row.parameter_hash,
    leaseOwner: row.lease_owner,
    leaseExpiresAt: row.lease_expires_at,
    lastErrorCode: row.last_error_code,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function nowUnixSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

function assertIdentifier(value: string, label: string): void {
  if (typeof value !== "string" || value.length === 0 || /\s/.test(value)) {
    throw new Error(`Asaas creation intent ${label} must be non-empty and contain no whitespace`);
  }
}

function assertResourceType(value: string): asserts value is AsaasResourceType {
  if (value !== "customer" && value !== "payment" && value !== "subscription") {
    throw new Error("Asaas creation intent resourceType is invalid");
  }
}

function assertParameterHash(value: string): void {
  if (!/^[a-f0-9]{64}$/.test(value)) {
    throw new Error("Asaas creation intent parameterHash must be a SHA-256 hexadecimal hash");
  }
}

function assertLeaseOwner(value: string): void {
  if (typeof value !== "string" || value.length === 0 || /\s/.test(value)) {
    throw new Error("Asaas creation intent leaseOwner must be non-empty and contain no whitespace");
  }
}

function assertErrorCode(value: string): void {
  if (!/^[A-Za-z0-9_.:-]{1,64}$/.test(value)) {
    throw new Error("Asaas creation intent error code must be an internal code of at most 64 characters");
  }
}

function assertAsaasResourceId(value: string): void {
  if (typeof value !== "string" || value.length === 0 || /\s/.test(value)) {
    throw new Error("Asaas resource id must be non-empty and contain no whitespace");
  }
}

function rowsMatchInput(row: IntentRow, input: CreateAsaasCreationIntentInput): boolean {
  return row.resource_type === input.resourceType
    && row.entity_type === input.entityType
    && row.entity_id === input.entityId
    && row.operation_key === input.operationKey
    && row.external_reference === input.externalReference
    && row.parameter_hash === input.parameterHash;
}

/** Structural migration only. It neither reads nor changes existing business records. */
export function initializeAsaasCreationIntentSchema(sqlite: Database.Database): void {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS asaas_creation_intents (
      intent_id TEXT PRIMARY KEY,
      resource_type TEXT NOT NULL CHECK (resource_type IN ('customer', 'payment', 'subscription')),
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      operation_key TEXT NOT NULL,
      external_reference TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL CHECK (status IN ('pending', 'creating', 'created', 'ambiguous', 'failed')),
      asaas_resource_id TEXT,
      parameter_hash TEXT NOT NULL,
      lease_owner TEXT,
      lease_expires_at INTEGER,
      last_error_code TEXT CHECK (last_error_code IS NULL OR length(last_error_code) <= 64),
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      UNIQUE(resource_type, entity_type, entity_id, operation_key)
    );
    CREATE INDEX IF NOT EXISTS idx_asaas_creation_intents_status
      ON asaas_creation_intents(status);
    CREATE INDEX IF NOT EXISTS idx_asaas_creation_intents_lease_expires_at
      ON asaas_creation_intents(lease_expires_at);
    CREATE INDEX IF NOT EXISTS idx_asaas_creation_intents_entity
      ON asaas_creation_intents(entity_type, entity_id);
    CREATE INDEX IF NOT EXISTS idx_asaas_creation_intents_asaas_resource_id
      ON asaas_creation_intents(asaas_resource_id);
  `);

  const billingTransactionsExists = sqlite.prepare(
    "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'billing_transactions'",
  ).get();
  if (!billingTransactionsExists) return;

  const columns = sqlite.prepare("PRAGMA table_info(billing_transactions)").all() as Array<{ name: string }>;
  if (!columns.some((column) => column.name === "asaas_creation_intent_id")) {
    sqlite.exec("ALTER TABLE billing_transactions ADD COLUMN asaas_creation_intent_id TEXT");
  }
  sqlite.exec(`
    CREATE INDEX IF NOT EXISTS idx_billing_transactions_creation_intent
      ON billing_transactions(asaas_creation_intent_id);
  `);
}

export type AsaasCreationIntentStore = {
  createOrGetAsaasCreationIntent(input: CreateAsaasCreationIntentInput): AsaasCreationIntent;
  getAsaasCreationIntent(query: { intentId?: string; externalReference?: string }): AsaasCreationIntent | null;
  claimAsaasCreationIntent(input: { intentId: string; leaseOwner: string; leaseDurationSeconds: number }): ClaimAsaasCreationIntentResult;
  markAsaasCreationIntentCreated(input: { intentId: string; leaseOwner: string; asaasResourceId: string }): MarkAsaasCreationIntentResult;
  markAsaasCreationIntentAmbiguous(input: { intentId: string; leaseOwner: string; errorCode: string }): MarkAsaasCreationIntentResult;
  markAsaasCreationIntentFailed(input: { intentId: string; leaseOwner: string; errorCode: string }): MarkAsaasCreationIntentResult;
};

export type ClaimAsaasCreationIntentResult =
  | { outcome: "claimed"; intent: AsaasCreationIntent }
  | { outcome: "busy"; intent: AsaasCreationIntent }
  | { outcome: "created"; intent: AsaasCreationIntent; asaasResourceId: string | null }
  | { outcome: "not_found" };

export type MarkAsaasCreationIntentResult =
  | { outcome: "marked"; intent: AsaasCreationIntent }
  | { outcome: "conflict"; intent: AsaasCreationIntent | null }
  | { outcome: "not_found" };

/**
 * Factory keeps the storage operations testable with an in-memory database.
 * Every transaction is synchronous; callers must do HTTP work outside it.
 */
export function createAsaasCreationIntentStore(sqlite: Database.Database): AsaasCreationIntentStore {
  const selectByIntentId = sqlite.prepare("SELECT * FROM asaas_creation_intents WHERE intent_id = ?");
  const selectByExternalReference = sqlite.prepare("SELECT * FROM asaas_creation_intents WHERE external_reference = ?");
  const selectByCompositeKey = sqlite.prepare(`
    SELECT * FROM asaas_creation_intents
    WHERE resource_type = ? AND entity_type = ? AND entity_id = ? AND operation_key = ?
  `);

  const getAsaasCreationIntent = (query: { intentId?: string; externalReference?: string }): AsaasCreationIntent | null => {
    if (!!query.intentId === !!query.externalReference) {
      throw new Error("Provide exactly one of intentId or externalReference");
    }
    const row = (query.intentId
      ? selectByIntentId.get(query.intentId)
      : selectByExternalReference.get(query.externalReference!)) as IntentRow | undefined;
    return row ? toIntent(row) : null;
  };

  const createOrGetAsaasCreationIntent = sqlite.transaction((input: CreateAsaasCreationIntentInput): AsaasCreationIntent => {
    assertIdentifier(input.intentId, "intentId");
    assertResourceType(input.resourceType);
    assertIdentifier(input.entityType, "entityType");
    assertIdentifier(input.entityId, "entityId");
    assertIdentifier(input.operationKey, "operationKey");
    assertAsaasExternalReference(input.externalReference);
    assertParameterHash(input.parameterHash);

    const byReference = selectByExternalReference.get(input.externalReference) as IntentRow | undefined;
    const byComposite = selectByCompositeKey.get(
      input.resourceType, input.entityType, input.entityId, input.operationKey,
    ) as IntentRow | undefined;
    const byIntentId = selectByIntentId.get(input.intentId) as IntentRow | undefined;

    const existingRows = [byReference, byComposite, byIntentId].filter((row): row is IntentRow => !!row);
    if (existingRows.length > 0) {
      const first = existingRows[0];
      if (existingRows.some((row) => row.intent_id !== first.intent_id)) {
        throw new AsaasCreationIntentConflictError("Asaas creation intent keys point to different records");
      }
      if (!rowsMatchInput(first, input)) {
        throw new AsaasCreationIntentConflictError("Asaas creation intent identifiers or parameter hash conflict");
      }
      return toIntent(first);
    }

    const now = nowUnixSeconds();
    sqlite.prepare(`
      INSERT INTO asaas_creation_intents (
        intent_id, resource_type, entity_type, entity_id, operation_key,
        external_reference, status, asaas_resource_id, parameter_hash,
        lease_owner, lease_expires_at, last_error_code, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'pending', NULL, ?, NULL, NULL, NULL, ?, ?)
    `).run(
      input.intentId, input.resourceType, input.entityType, input.entityId, input.operationKey,
      input.externalReference, input.parameterHash, now, now,
    );
    return toIntent(selectByIntentId.get(input.intentId) as IntentRow);
  });

  const claimAsaasCreationIntent = sqlite.transaction((input: {
    intentId: string;
    leaseOwner: string;
    leaseDurationSeconds: number;
  }): ClaimAsaasCreationIntentResult => {
    assertIdentifier(input.intentId, "intentId");
    assertLeaseOwner(input.leaseOwner);
    if (!Number.isInteger(input.leaseDurationSeconds) || input.leaseDurationSeconds < 15 || input.leaseDurationSeconds > 300) {
      throw new Error("Asaas creation intent leaseDurationSeconds must be between 15 and 300");
    }
    const row = selectByIntentId.get(input.intentId) as IntentRow | undefined;
    if (!row) return { outcome: "not_found" };
    if (row.status === "created") {
      return { outcome: "created", intent: toIntent(row), asaasResourceId: row.asaas_resource_id };
    }
    const now = nowUnixSeconds();
    if (row.status === "creating" && (row.lease_expires_at === null || row.lease_expires_at > now)) {
      return { outcome: "busy", intent: toIntent(row) };
    }

    const leaseExpiresAt = now + input.leaseDurationSeconds;
    sqlite.prepare(`
      UPDATE asaas_creation_intents
      SET status = 'creating', lease_owner = ?, lease_expires_at = ?, updated_at = ?
      WHERE intent_id = ?
    `).run(input.leaseOwner, leaseExpiresAt, now, input.intentId);
    return { outcome: "claimed", intent: toIntent(selectByIntentId.get(input.intentId) as IntentRow) };
  });

  function markWithLease(
    input: { intentId: string; leaseOwner: string },
    nextStatus: "created" | "ambiguous" | "failed",
    asaasResourceId?: string,
    errorCode?: string,
  ): MarkAsaasCreationIntentResult {
    return sqlite.transaction((): MarkAsaasCreationIntentResult => {
      assertIdentifier(input.intentId, "intentId");
      assertLeaseOwner(input.leaseOwner);
      if (asaasResourceId !== undefined) assertAsaasResourceId(asaasResourceId);
      if (errorCode !== undefined) assertErrorCode(errorCode);

      const row = selectByIntentId.get(input.intentId) as IntentRow | undefined;
      if (!row) return { outcome: "not_found" };
      if (row.status !== "creating" || row.lease_owner !== input.leaseOwner) {
        return { outcome: "conflict", intent: toIntent(row) };
      }

      const now = nowUnixSeconds();
      if (nextStatus === "created") {
        sqlite.prepare(`
          UPDATE asaas_creation_intents
          SET status = 'created', asaas_resource_id = ?, lease_owner = NULL, lease_expires_at = NULL,
              last_error_code = NULL, updated_at = ?
          WHERE intent_id = ? AND status = 'creating' AND lease_owner = ?
        `).run(asaasResourceId, now, input.intentId, input.leaseOwner);
      } else {
        sqlite.prepare(`
          UPDATE asaas_creation_intents
          SET status = ?, lease_owner = NULL, lease_expires_at = NULL,
              last_error_code = ?, updated_at = ?
          WHERE intent_id = ? AND status = 'creating' AND lease_owner = ?
        `).run(nextStatus, errorCode, now, input.intentId, input.leaseOwner);
      }
      return { outcome: "marked", intent: toIntent(selectByIntentId.get(input.intentId) as IntentRow) };
    })();
  }

  return {
    createOrGetAsaasCreationIntent,
    getAsaasCreationIntent,
    claimAsaasCreationIntent,
    markAsaasCreationIntentCreated(input) {
      return markWithLease(input, "created", input.asaasResourceId);
    },
    markAsaasCreationIntentAmbiguous(input) {
      return markWithLease(input, "ambiguous", undefined, input.errorCode);
    },
    markAsaasCreationIntentFailed(input) {
      return markWithLease(input, "failed", undefined, input.errorCode);
    },
  };
}
