import type Database from "better-sqlite3";

export type CompleteAsaasCustomerLinkResult =
  | { outcome: "linked"; customerId: string }
  | { outcome: "conflict" }
  | { outcome: "not_found" };

type IntentRow = {
  resource_type: string;
  entity_type: string;
  entity_id: string;
  status: string;
  asaas_resource_id: string | null;
  lease_owner: string | null;
};

/**
 * SQLite-only finalizers.  They do not perform network work and update the
 * local customer link and the creation intent in the same transaction.
 */
export function createAsaasCustomerLinkStore(sqlite: Database.Database) {
  const getIntent = sqlite.prepare(`
    SELECT resource_type, entity_type, entity_id, status, asaas_resource_id, lease_owner
    FROM asaas_creation_intents WHERE intent_id = ?
  `);

  const completeDesmanche = sqlite.transaction((input: {
    intentId: string; desmancheId: string; leaseOwner?: string; customerId?: string;
  }): CompleteAsaasCustomerLinkResult => {
    const intent = getIntent.get(input.intentId) as IntentRow | undefined;
    if (!intent) return { outcome: "not_found" };
    if (intent.resource_type !== "customer" || intent.entity_type !== "desmanche" || intent.entity_id !== input.desmancheId) return { outcome: "conflict" };
    const customerId = intent.status === "created" ? intent.asaas_resource_id : input.customerId;
    if (!customerId) return { outcome: "conflict" };
    if (intent.status === "creating" && intent.lease_owner !== input.leaseOwner) return { outcome: "conflict" };
    if (intent.status !== "creating" && intent.status !== "created") return { outcome: "conflict" };

    const billing = sqlite.prepare("SELECT asaas_customer_id FROM desmanche_billing WHERE desmanche_id = ?").get(input.desmancheId) as { asaas_customer_id: string | null } | undefined;
    if (!billing) return { outcome: "not_found" };
    if (billing.asaas_customer_id && billing.asaas_customer_id !== customerId) return { outcome: "conflict" };
    if (!billing.asaas_customer_id) {
      const link = sqlite.prepare("UPDATE desmanche_billing SET asaas_customer_id = ? WHERE desmanche_id = ? AND asaas_customer_id IS NULL").run(customerId, input.desmancheId);
      if (link.changes !== 1) return { outcome: "conflict" };
    }
    if (intent.status === "creating") {
      const finalize = sqlite.prepare(`UPDATE asaas_creation_intents
        SET status = 'created', asaas_resource_id = ?, lease_owner = NULL, lease_expires_at = NULL, last_error_code = NULL, updated_at = strftime('%s', 'now')
        WHERE intent_id = ? AND status = 'creating' AND lease_owner = ?`).run(customerId, input.intentId, input.leaseOwner);
      if (finalize.changes !== 1) {
        throw new Error("Asaas customer intent finalization did not update exactly one row");
      }
    }
    return { outcome: "linked", customerId };
  });

  const completeGuincho = sqlite.transaction((input: {
    intentId: string; guinchoId: string; leaseOwner?: string; customerId?: string;
  }): CompleteAsaasCustomerLinkResult => {
    const intent = getIntent.get(input.intentId) as IntentRow | undefined;
    if (!intent) return { outcome: "not_found" };
    if (intent.resource_type !== "customer" || intent.entity_type !== "guincho" || intent.entity_id !== input.guinchoId) return { outcome: "conflict" };
    const customerId = intent.status === "created" ? intent.asaas_resource_id : input.customerId;
    if (!customerId) return { outcome: "conflict" };
    if (intent.status === "creating" && intent.lease_owner !== input.leaseOwner) return { outcome: "conflict" };
    if (intent.status !== "creating" && intent.status !== "created") return { outcome: "conflict" };

    const guincho = sqlite.prepare("SELECT asaas_customer_id FROM guinchos WHERE id = ?").get(input.guinchoId) as { asaas_customer_id: string | null } | undefined;
    if (!guincho) return { outcome: "not_found" };
    if (guincho.asaas_customer_id && guincho.asaas_customer_id !== customerId) return { outcome: "conflict" };
    if (!guincho.asaas_customer_id) {
      // This touches only the customer column; payment, subscription, plan and status remain intact.
      const link = sqlite.prepare("UPDATE guinchos SET asaas_customer_id = ? WHERE id = ? AND asaas_customer_id IS NULL").run(customerId, input.guinchoId);
      if (link.changes !== 1) return { outcome: "conflict" };
    }
    if (intent.status === "creating") {
      const finalize = sqlite.prepare(`UPDATE asaas_creation_intents
        SET status = 'created', asaas_resource_id = ?, lease_owner = NULL, lease_expires_at = NULL, last_error_code = NULL, updated_at = strftime('%s', 'now')
        WHERE intent_id = ? AND status = 'creating' AND lease_owner = ?`).run(customerId, input.intentId, input.leaseOwner);
      if (finalize.changes !== 1) {
        throw new Error("Asaas customer intent finalization did not update exactly one row");
      }
    }
    return { outcome: "linked", customerId };
  });

  return { completeDesmanche, completeGuincho };
}
