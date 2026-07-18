import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { eq, and, desc, asc, like, or, gte, lte, sql, isNotNull, inArray, SQL } from "drizzle-orm";
import * as schema from "@workspace/db/schema";
import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import path from "path";
import { mkdirSync } from "fs";
import { databasePath } from "./config";
import { migrateGuinchos } from "./migrations/guinchos";
import {
  createAsaasCreationIntentStore,
  initializeAsaasCreationIntentSchema,
} from "./asaas-intents";
import { createAsaasCustomerLinkStore } from "./asaas-customer-links";
import { createAsaasPaymentLinkStore } from "./asaas-payment-links";
import {
  createPerTransactionBillingStore,
  initializePerTransactionBillingIndex,
} from "./per-transaction-billing";

mkdirSync(path.dirname(databasePath), { recursive: true });
const sqlite = new Database(databasePath, { timeout: 5000 });
sqlite.pragma("busy_timeout = 5000");
export const db = drizzle(sqlite, { schema });

// Inicializa as tabelas
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    phone TEXT NOT NULL,
    whatsapp TEXT,
    whatsapp_contact_preference TEXT NOT NULL DEFAULT 'whatsapp',
    password TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'client',
    avatar TEXT,
    profile_complete INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
  );

  CREATE TABLE IF NOT EXISTS addresses (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id TEXT NOT NULL REFERENCES users(id),
    zip_code TEXT NOT NULL,
    street TEXT NOT NULL,
    number TEXT,
    complement TEXT,
    city TEXT NOT NULL,
    state TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS desmanches (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    company_name TEXT NOT NULL,
    trading_name TEXT NOT NULL,
    cnpj TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL UNIQUE,
    phone TEXT NOT NULL,
    password TEXT NOT NULL,
    logo TEXT,
    plan TEXT NOT NULL DEFAULT 'percentage',
    status TEXT NOT NULL DEFAULT 'pending',
    rating REAL NOT NULL DEFAULT 0,
    sales_count INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
  );

  CREATE TABLE IF NOT EXISTS desmanche_registration_verifications (
    id TEXT PRIMARY KEY,
    purpose TEXT NOT NULL DEFAULT 'desmanche_registration',
    channel TEXT NOT NULL CHECK (channel IN ('email', 'sms', 'whatsapp')),
    email TEXT NOT NULL,
    phone TEXT NOT NULL,
    code_hash TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    consumed_at INTEGER,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
  );

  CREATE INDEX IF NOT EXISTS desmanche_registration_verifications_expires_at_idx
    ON desmanche_registration_verifications(expires_at);

  CREATE TABLE IF NOT EXISTS desmanche_addresses (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    desmanche_id TEXT NOT NULL REFERENCES desmanches(id),
    zip_code TEXT NOT NULL,
    street TEXT NOT NULL,
    number TEXT,
    complement TEXT,
    city TEXT NOT NULL,
    state TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS documents (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    desmanche_id TEXT NOT NULL REFERENCES desmanches(id),
    type TEXT NOT NULL,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    valid_until INTEGER,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
  );

  CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    vehicle_type TEXT,
    vehicle_brand TEXT NOT NULL,
    vehicle_model TEXT NOT NULL,
    vehicle_year INTEGER NOT NULL,
    vehicle_plate TEXT,
    vehicle_color TEXT,
    vehicle_engine TEXT,
    part_category TEXT,
    part_name TEXT,
    part_position TEXT,
    part_condition_accepted TEXT DEFAULT 'any',
    city TEXT,
    state TEXT,
    client_id TEXT REFERENCES users(id),
    desmanche_id TEXT REFERENCES desmanches(id),
    posted_by_type TEXT NOT NULL DEFAULT 'client',
    location TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open',
    urgency TEXT NOT NULL DEFAULT 'normal',
    is_partner_request INTEGER NOT NULL DEFAULT 0,
    expires_at INTEGER,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
  );

  CREATE TABLE IF NOT EXISTS order_images (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    order_id TEXT NOT NULL REFERENCES orders(id),
    url TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
  );

  CREATE TABLE IF NOT EXISTS order_items (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    order_id TEXT NOT NULL REFERENCES orders(id),
    title TEXT NOT NULL,
    description TEXT,
    vehicle_type TEXT,
    vehicle_brand TEXT,
    vehicle_model TEXT,
    vehicle_year INTEGER,
    vehicle_plate TEXT,
    vehicle_color TEXT,
    vehicle_engine TEXT,
    part_category TEXT,
    part_name TEXT,
    part_position TEXT,
    part_condition_accepted TEXT DEFAULT 'any',
    status TEXT NOT NULL DEFAULT 'open',
    expires_at INTEGER,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
  );

  CREATE TABLE IF NOT EXISTS proposals (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    order_id TEXT NOT NULL REFERENCES orders(id),
    desmanche_id TEXT NOT NULL REFERENCES desmanches(id),
    price REAL NOT NULL,
    message TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'sent',
    whatsapp_unlocked INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
  );

  CREATE TABLE IF NOT EXISTS negotiations (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    order_id TEXT NOT NULL REFERENCES orders(id),
    proposal_id TEXT NOT NULL REFERENCES proposals(id),
    client_id TEXT NOT NULL REFERENCES users(id),
    desmanche_id TEXT NOT NULL REFERENCES desmanches(id),
    price REAL NOT NULL,
    status TEXT NOT NULL DEFAULT 'negotiating',
    tracking_code TEXT,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
  );

  CREATE TABLE IF NOT EXISTS auctions (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    title TEXT NOT NULL,
    source TEXT NOT NULL,
    lot_count INTEGER NOT NULL,
    estimated_value REAL NOT NULL,
    end_time INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'upcoming',
    url TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
  );

  CREATE TABLE IF NOT EXISTS invoices (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    desmanche_id TEXT NOT NULL REFERENCES desmanches(id),
    month TEXT NOT NULL,
    description TEXT NOT NULL,
    amount REAL NOT NULL,
    due_date INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
  );

  CREATE TABLE IF NOT EXISTS reviews (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    negotiation_id TEXT NOT NULL REFERENCES negotiations(id),
    client_id TEXT NOT NULL REFERENCES users(id),
    desmanche_id TEXT NOT NULL REFERENCES desmanches(id),
    rating INTEGER NOT NULL,
    comment TEXT,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
  );

  CREATE TABLE IF NOT EXISTS chat_rooms (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    proposal_id TEXT NOT NULL UNIQUE REFERENCES proposals(id),
    order_id TEXT NOT NULL REFERENCES orders(id),
    client_id TEXT NOT NULL REFERENCES users(id),
    desmanche_id TEXT NOT NULL REFERENCES desmanches(id),
    last_message_at INTEGER,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
  );

  CREATE TABLE IF NOT EXISTS chat_messages (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    room_id TEXT NOT NULL REFERENCES chat_rooms(id),
    sender_id TEXT NOT NULL,
    sender_type TEXT NOT NULL,
    content TEXT NOT NULL,
    read_at INTEGER,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
  );

  CREATE TABLE IF NOT EXISTS pre_proposal_rooms (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    order_id TEXT NOT NULL REFERENCES orders(id),
    order_item_id TEXT,
    client_id TEXT NOT NULL REFERENCES users(id),
    desmanche_id TEXT NOT NULL REFERENCES desmanches(id),
    last_message_at INTEGER,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
  );

  CREATE TABLE IF NOT EXISTS pre_proposal_messages (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    room_id TEXT NOT NULL REFERENCES pre_proposal_rooms(id),
    sender_id TEXT NOT NULL,
    sender_type TEXT NOT NULL,
    content TEXT NOT NULL,
    read_at INTEGER,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
  );

  CREATE TABLE IF NOT EXISTS subscription_plans (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    name TEXT NOT NULL,
    price REAL NOT NULL,
    proposal_limit INTEGER NOT NULL DEFAULT 10,
    exclusivity_slots INTEGER NOT NULL DEFAULT 0,
    description TEXT,
    active INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
  );

  CREATE TABLE IF NOT EXISTS desmanche_billing (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    desmanche_id TEXT NOT NULL UNIQUE REFERENCES desmanches(id),
    billing_model TEXT NOT NULL DEFAULT 'monthly_cycle',
    plan_id TEXT REFERENCES subscription_plans(id),
    monthly_transaction_count INTEGER NOT NULL DEFAULT 0,
    monthly_amount_paid REAL NOT NULL DEFAULT 0,
    current_period_start INTEGER NOT NULL DEFAULT 0,
    asaas_customer_id TEXT,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
  );

  CREATE TABLE IF NOT EXISTS billing_transactions (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    desmanche_id TEXT NOT NULL REFERENCES desmanches(id),
    negotiation_id TEXT,
    amount REAL NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    type TEXT NOT NULL DEFAULT 'monthly_cycle',
    asaas_charge_id TEXT,
    asaas_due_date TEXT,
    payment_link TEXT,
    description TEXT,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    paid_at INTEGER
  );

  CREATE TABLE IF NOT EXISTS system_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
  );

  CREATE TABLE IF NOT EXISTS complaints (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    type TEXT NOT NULL,
    subject TEXT NOT NULL,
    message TEXT NOT NULL,
    author_id TEXT NOT NULL,
    author_type TEXT NOT NULL,
    author_name TEXT,
    target_type TEXT,
    target_id TEXT,
    target_description TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    admin_notes TEXT,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
  );
`);

// Estrutura aditiva para idempotência de criações Asaas. Nenhum fluxo de
// negócio a utiliza nesta etapa; apenas expomos operações para a integração futura.
initializeAsaasCreationIntentSchema(sqlite);
initializePerTransactionBillingIndex(sqlite);
const asaasCreationIntentStore = createAsaasCreationIntentStore(sqlite);
export const createOrGetAsaasCreationIntent = asaasCreationIntentStore.createOrGetAsaasCreationIntent;
export const getAsaasCreationIntent = asaasCreationIntentStore.getAsaasCreationIntent;
export const claimAsaasCreationIntent = asaasCreationIntentStore.claimAsaasCreationIntent;
export const markAsaasCreationIntentCreated = asaasCreationIntentStore.markAsaasCreationIntentCreated;
export const markAsaasCreationIntentAmbiguous = asaasCreationIntentStore.markAsaasCreationIntentAmbiguous;
export const markAsaasCreationIntentFailed = asaasCreationIntentStore.markAsaasCreationIntentFailed;

// Eventos de webhook são guardados somente com metadados mínimos e um hash.
// A criação é aditiva para bancos já existentes.
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS asaas_webhook_events (
    event_id TEXT PRIMARY KEY,
    event_type TEXT NOT NULL,
    payment_id TEXT,
    payload_hash TEXT NOT NULL,
    status TEXT NOT NULL,
    received_at INTEGER NOT NULL,
    processed_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_asaas_webhook_events_processed_at
    ON asaas_webhook_events(processed_at);
  CREATE INDEX IF NOT EXISTS idx_asaas_webhook_events_payment_id
    ON asaas_webhook_events(payment_id);
  CREATE INDEX IF NOT EXISTS idx_billing_transactions_asaas_charge_id
    ON billing_transactions(asaas_charge_id);
`);

// Migrations para colunas adicionadas após a criação inicial das tabelas
const migrations = [
  `ALTER TABLE users ADD COLUMN whatsapp_contact_preference TEXT NOT NULL DEFAULT 'whatsapp'`,
  `ALTER TABLE billing_transactions ADD COLUMN asaas_due_date TEXT`,
];
for (const migration of migrations) {
  try { sqlite.exec(migration); } catch {}
}

const asaasPaymentLinkStore = createAsaasPaymentLinkStore(sqlite);
export const getBillingTransactionForAsaasPayment = asaasPaymentLinkStore.getBillingTransactionForAsaasPayment;
export const persistOrReuseAsaasDueDate = asaasPaymentLinkStore.persistOrReuseAsaasDueDate;
export const associateAsaasCreationIntentToBillingTransaction = asaasPaymentLinkStore.associateAsaasCreationIntent;
export const completeAsaasPaymentForBillingTransaction = asaasPaymentLinkStore.completeAsaasPayment;
const perTransactionBillingStore = createPerTransactionBillingStore(sqlite);
export const createOrGetPerTransactionBilling = perTransactionBillingStore.createOrGetPerTransactionBilling;

// ── Migrate: add permissions column to users ──
try {
  sqlite.exec("ALTER TABLE users ADD COLUMN permissions TEXT");
} catch {}

// ── Migrate: add status column to users ──
try {
  sqlite.exec("ALTER TABLE users ADD COLUMN status TEXT NOT NULL DEFAULT 'active'");
} catch {}

// ── Migrate: add desmanche_id to complaints ──
try {
  sqlite.exec("ALTER TABLE complaints ADD COLUMN desmanche_id TEXT");
} catch {}

// ── Migrate orders.client_id to be nullable (SQLite requires table rebuild) ──
try {
  const colInfo = sqlite.prepare("PRAGMA table_info(orders)").all() as any[];
  const clientIdCol = colInfo.find((c) => c.name === "client_id");
  if (clientIdCol && clientIdCol.notnull === 1) {
    sqlite.exec(`
      PRAGMA foreign_keys=OFF;
      BEGIN TRANSACTION;
      CREATE TABLE IF NOT EXISTS orders_rebuild (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        vehicle_type TEXT,
        vehicle_brand TEXT NOT NULL,
        vehicle_model TEXT NOT NULL,
        vehicle_year INTEGER NOT NULL,
        vehicle_plate TEXT,
        vehicle_color TEXT,
        vehicle_engine TEXT,
        part_category TEXT,
        part_name TEXT,
        part_position TEXT,
        part_condition_accepted TEXT DEFAULT 'any',
        city TEXT,
        state TEXT,
        client_id TEXT REFERENCES users(id),
        desmanche_id TEXT REFERENCES desmanches(id),
        posted_by_type TEXT NOT NULL DEFAULT 'client',
        location TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'open',
        urgency TEXT NOT NULL DEFAULT 'normal',
        is_partner_request INTEGER NOT NULL DEFAULT 0,
        expires_at INTEGER,
        created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
      );
      INSERT INTO orders_rebuild
        SELECT
          id, title, description,
          COALESCE(vehicle_type, NULL),
          vehicle_brand, vehicle_model, vehicle_year,
          COALESCE(vehicle_plate, NULL),
          COALESCE(vehicle_color, NULL),
          COALESCE(vehicle_engine, NULL),
          COALESCE(part_category, NULL),
          COALESCE(part_name, NULL),
          COALESCE(part_position, NULL),
          COALESCE(part_condition_accepted, 'any'),
          COALESCE(city, NULL),
          COALESCE(state, NULL),
          COALESCE(client_id, NULL),
          COALESCE(desmanche_id, NULL),
          COALESCE(posted_by_type, 'client'),
          location, status, urgency, is_partner_request,
          COALESCE(expires_at, NULL),
          created_at, updated_at
        FROM orders;
      DROP TABLE orders;
      ALTER TABLE orders_rebuild RENAME TO orders;
      COMMIT;
      PRAGMA foreign_keys=ON;
    `);
  }
} catch (e) {
  console.error("orders migration error (non-critical):", e);
}

// Migrate existing database - add new columns if they don't exist
try {
  sqlite.exec(`ALTER TABLE users ADD COLUMN whatsapp TEXT`);
} catch (e) { /* column already exists */ }
try {
  sqlite.exec(`ALTER TABLE users ADD COLUMN profile_complete INTEGER NOT NULL DEFAULT 0`);
} catch (e) { /* column already exists */ }
try {
  sqlite.exec(`ALTER TABLE desmanches ADD COLUMN responsible_name TEXT`);
} catch (e) { /* column already exists */ }
try {
  sqlite.exec(`ALTER TABLE desmanches ADD COLUMN responsible_cpf TEXT`);
} catch (e) { /* column already exists */ }
try {
  sqlite.exec(`ALTER TABLE desmanches ADD COLUMN rejection_reason TEXT`);
} catch (e) { /* column already exists */ }
sqlite.exec(`UPDATE desmanches SET plan = 'monthly' WHERE plan = 'percentage'`);
try { sqlite.exec(`ALTER TABLE desmanches ADD COLUMN vehicle_types TEXT DEFAULT '[]'`); } catch (e) {}
try { sqlite.exec(`ALTER TABLE users ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 0`); } catch (e) {}
try { sqlite.exec(`ALTER TABLE users ADD COLUMN email_verification_token TEXT`); } catch (e) {}
try { sqlite.exec(`ALTER TABLE users ADD COLUMN email_verification_expires INTEGER`); } catch (e) {}
try { sqlite.exec(`ALTER TABLE users ADD COLUMN password_reset_token TEXT`); } catch (e) {}
try { sqlite.exec(`ALTER TABLE users ADD COLUMN password_reset_expires INTEGER`); } catch (e) {}
try { sqlite.exec(`ALTER TABLE users ADD COLUMN cpf TEXT`); } catch (e) {}
try { sqlite.exec(`ALTER TABLE desmanche_registration_verifications ADD COLUMN purpose TEXT NOT NULL DEFAULT 'desmanche_registration'`); } catch (e) {}

// Migração multi-item: adicionar order_item_id em tabelas relacionadas
try { sqlite.exec(`ALTER TABLE proposals ADD COLUMN order_item_id TEXT REFERENCES order_items(id)`); } catch (e) {}
try { sqlite.exec(`ALTER TABLE negotiations ADD COLUMN order_item_id TEXT REFERENCES order_items(id)`); } catch (e) {}
try { sqlite.exec(`ALTER TABLE order_images ADD COLUMN order_item_id TEXT REFERENCES order_items(id)`); } catch (e) {}
try { sqlite.exec(`ALTER TABLE negotiations ADD COLUMN received_at INTEGER`); } catch (e) {}
try { sqlite.exec(`ALTER TABLE negotiations ADD COLUMN review_deadline_at INTEGER`); } catch (e) {}

// Migração: criar order_items para pedidos existentes que não têm items
{
  const THREE_DAYS_S = 3 * 24 * 60 * 60;
  const existingOrders = sqlite.prepare("SELECT * FROM orders").all() as any[];
  for (const order of existingOrders) {
    const existing = sqlite.prepare("SELECT id FROM order_items WHERE order_id = ?").get(order.id);
    if (!existing) {
      const itemId = randomUUID();
      const expiresAt = order.expires_at || Math.floor(Date.now() / 1000) + THREE_DAYS_S;
      sqlite.prepare(`
        INSERT OR IGNORE INTO order_items (id, order_id, title, description, vehicle_type, vehicle_brand, vehicle_model, vehicle_year, vehicle_plate, vehicle_color, vehicle_engine, part_category, part_name, part_position, part_condition_accepted, status, expires_at, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        itemId, order.id, order.title, order.description,
        order.vehicle_type, order.vehicle_brand, order.vehicle_model, order.vehicle_year,
        order.vehicle_plate, order.vehicle_color, order.vehicle_engine,
        order.part_category, order.part_name, order.part_position, order.part_condition_accepted || 'any',
        (order.status === 'open' || order.status === 'has_proposals') ? order.status === 'has_proposals' ? 'has_proposals' : 'open'
          : order.status === 'negotiating' ? 'negotiating'
          : order.status === 'completed' ? 'completed'
          : order.status === 'cancelled' || order.status === 'expired' ? 'archived'
          : 'open',
        expiresAt,
        order.created_at || Math.floor(Date.now() / 1000),
        order.updated_at || Math.floor(Date.now() / 1000)
      );
      // Vincular proposals existentes ao item criado
      sqlite.prepare("UPDATE proposals SET order_item_id = ? WHERE order_id = ? AND order_item_id IS NULL").run(itemId, order.id);
      // Vincular negotiations existentes ao item criado
      sqlite.prepare("UPDATE negotiations SET order_item_id = ? WHERE order_id = ? AND order_item_id IS NULL").run(itemId, order.id);
      // Vincular order_images existentes ao item criado
      sqlite.prepare("UPDATE order_images SET order_item_id = ? WHERE order_id = ? AND order_item_id IS NULL").run(itemId, order.id);
    }
  }
}

// Normalização segura do ciclo mensal: ciclos sem transações acumuladas não
// devem manter um current_period_start ativo.
try {
  sqlite.exec(`UPDATE desmanche_billing SET current_period_start = 0 WHERE billing_model = 'monthly_cycle' AND monthly_transaction_count = 0 AND current_period_start > 0`);
} catch (e) {}

sqlite.exec(`
  CREATE TABLE IF NOT EXISTS site_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL DEFAULT ''
  );
  CREATE TABLE IF NOT EXISTS brand_logos (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    brand_id TEXT NOT NULL UNIQUE,
    brand_name TEXT NOT NULL,
    logo_url TEXT NOT NULL,
    vehicle_type TEXT NOT NULL DEFAULT 'car',
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
  );
`);

// One-time recovery for the primary administrator account.  Deployment uses a
// persistent SQLite database that is intentionally not committed to Git, so
// this migration is the safe way to apply the requested credential reset to
// the production database on the next release.
const PRIMARY_ADMIN_EMAIL = "admin@centraldesmanches.com";
const PRIMARY_ADMIN_PASSWORD_RECOVERY_MIGRATION = "2026-07-17-primary-admin-password-reset";
const applyPrimaryAdminPasswordRecovery = sqlite.transaction(() => {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS application_migrations (
      name TEXT PRIMARY KEY,
      applied_at INTEGER NOT NULL
    );
  `);

  const alreadyApplied = sqlite
    .prepare("SELECT 1 FROM application_migrations WHERE name = ?")
    .get(PRIMARY_ADMIN_PASSWORD_RECOVERY_MIGRATION);
  if (alreadyApplied) return;

  // This is a bcrypt hash, never the plaintext password.
  const passwordHash = "$2b$10$A41lBHxTDNlSzfPjwpJvxe1YRjshmxhs.ib25PL.CFush0CEyXRyy";
  const existingAdmin = sqlite
    .prepare("SELECT id FROM users WHERE lower(email) = lower(?) AND type = 'admin'")
    .get(PRIMARY_ADMIN_EMAIL) as { id: string } | undefined;

  if (existingAdmin) {
    sqlite.prepare(`
      UPDATE users
      SET password = ?, status = 'active', email_verified = 1,
          password_reset_token = NULL, password_reset_expires = NULL
      WHERE id = ?
    `).run(passwordHash, existingAdmin.id);
  } else {
    sqlite.prepare(`
      INSERT INTO users (id, name, email, phone, password, type, status, email_verified)
      VALUES (?, ?, ?, ?, ?, 'admin', 'active', 1)
    `).run(randomUUID(), "Administrador", PRIMARY_ADMIN_EMAIL, "", passwordHash);
  }

  sqlite.prepare("INSERT INTO application_migrations (name, applied_at) VALUES (?, ?)")
    .run(PRIMARY_ADMIN_PASSWORD_RECOVERY_MIGRATION, Math.floor(Date.now() / 1000));
});
applyPrimaryAdminPasswordRecovery();

try { sqlite.exec(`ALTER TABLE orders ADD COLUMN vehicle_type TEXT`); } catch (e) {}
try { sqlite.exec(`ALTER TABLE orders ADD COLUMN vehicle_color TEXT`); } catch (e) {}
try { sqlite.exec(`ALTER TABLE orders ADD COLUMN vehicle_engine TEXT`); } catch (e) {}
try { sqlite.exec(`ALTER TABLE orders ADD COLUMN part_category TEXT`); } catch (e) {}
try { sqlite.exec(`ALTER TABLE orders ADD COLUMN part_name TEXT`); } catch (e) {}
try { sqlite.exec(`ALTER TABLE orders ADD COLUMN part_position TEXT`); } catch (e) {}
try { sqlite.exec(`ALTER TABLE orders ADD COLUMN part_condition_accepted TEXT DEFAULT 'any'`); } catch (e) {}
try { sqlite.exec(`ALTER TABLE orders ADD COLUMN city TEXT`); } catch (e) {}
try { sqlite.exec(`ALTER TABLE orders ADD COLUMN state TEXT`); } catch (e) {}
// Desmanche ads: new columns
try { sqlite.exec(`ALTER TABLE orders ADD COLUMN desmanche_id TEXT REFERENCES desmanches(id)`); } catch (e) {}
try { sqlite.exec(`ALTER TABLE orders ADD COLUMN posted_by_type TEXT NOT NULL DEFAULT 'client'`); } catch (e) {}
try { sqlite.exec(`ALTER TABLE orders ADD COLUMN expires_at INTEGER`); } catch (e) {}
// Negotiations: new columns for review gate
try { sqlite.exec(`ALTER TABLE negotiations ADD COLUMN received_at INTEGER`); } catch (e) {}
try { sqlite.exec(`ALTER TABLE negotiations ADD COLUMN review_deadline_at INTEGER`); } catch (e) {}
// Negotiations: stale detection column
try { sqlite.exec(`ALTER TABLE negotiations ADD COLUMN stale_check_at INTEGER`); } catch (e) {}
// Negotiations: moderation columns
try { sqlite.exec(`ALTER TABLE negotiations ADD COLUMN desmanche_response TEXT`); } catch (e) {}
try { sqlite.exec(`ALTER TABLE negotiations ADD COLUMN client_response TEXT`); } catch (e) {}
// Negotiations: audit trail for moderation resolution
try { sqlite.exec(`ALTER TABLE negotiations ADD COLUMN resolved_by_admin_id TEXT REFERENCES users(id)`); } catch (e) {}
try { sqlite.exec(`ALTER TABLE negotiations ADD COLUMN resolved_at INTEGER`); } catch (e) {}

// Activity logs table
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS activity_logs (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    action TEXT NOT NULL,
    actor_type TEXT NOT NULL,
    actor_id TEXT,
    actor_name TEXT,
    target_type TEXT,
    target_id TEXT,
    description TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
  );
`);
// Seed default system settings
const defaultSettings = [
  { key: 'reviewDeadlineDays', value: '10' },
  { key: 'maxOverdueBeforeBlock', value: '1' },
  { key: 'perTransactionAmount', value: '25' },
  { key: 'monthlyCapAmount', value: '350' },
  { key: 'licenseAlertDays', value: '30' },
  { key: 'staleNegotiationDays', value: '30' },
];
for (const s of defaultSettings) {
  sqlite.exec(`INSERT OR IGNORE INTO system_settings (key, value) VALUES ('${s.key}', '${s.value}')`);
}
// Seed default subscription plans if none exist
const planCount = (sqlite.prepare('SELECT count(*) as c FROM subscription_plans').get() as any).c;
if (planCount === 0) {
  sqlite.exec(`
    INSERT INTO subscription_plans (id, name, price, proposal_limit, exclusivity_slots, description, active)
    VALUES
      (lower(hex(randomblob(16))), 'Plano Básico', 99.90, 20, 0, 'Responda até 20 pedidos por mês', 1),
      (lower(hex(randomblob(16))), 'Plano Plus', 199.90, 50, 5, 'Responda até 50 pedidos + 5 slots exclusivos', 1),
      (lower(hex(randomblob(16))), 'Plano Pro', 349.90, 999, 15, 'Propostas ilimitadas + 15 slots exclusivos', 1)
  `);
}

// Hash de senha
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// ─── ACTIVITY LOG ────────────────────────────────────────────────────────────

export function logActivity(data: {
  action: string;
  actorType: "client" | "desmanche" | "admin" | "system";
  actorId?: string;
  actorName?: string;
  targetType?: string;
  targetId?: string;
  description: string;
}) {
  try {
    sqlite.prepare(`
      INSERT INTO activity_logs (action, actor_type, actor_id, actor_name, target_type, target_id, description)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      data.action,
      data.actorType,
      data.actorId ?? null,
      data.actorName ?? null,
      data.targetType ?? null,
      data.targetId ?? null,
      data.description,
    );
  } catch (e) {
    console.error("logActivity error:", e);
  }
}

export function getActivityLogs(opts: {
  limit?: number;
  offset?: number;
  action?: string;
  actorType?: string;
} = {}) {
  const { limit = 50, offset = 0, action, actorType } = opts;
  const conditions: string[] = [];
  const params: any[] = [];
  if (action) { conditions.push("action = ?"); params.push(action); }
  if (actorType) { conditions.push("actor_type = ?"); params.push(actorType); }
  const where = conditions.length ? " WHERE " + conditions.join(" AND ") : "";
  params.push(limit, offset);
  return sqlite.prepare(
    `SELECT * FROM activity_logs${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`
  ).all(...params) as any[];
}

export function getActivityLogsCount(opts: { action?: string; actorType?: string } = {}) {
  const { action, actorType } = opts;
  const conditions: string[] = [];
  const params: any[] = [];
  if (action) { conditions.push("action = ?"); params.push(action); }
  if (actorType) { conditions.push("actor_type = ?"); params.push(actorType); }
  const where = conditions.length ? " WHERE " + conditions.join(" AND ") : "";
  return ((sqlite.prepare(`SELECT COUNT(*) as count FROM activity_logs${where}`).get(...params) as any).count as number);
}

// ==================== USERS ====================
export async function getUserById(id: string) {
  return db.query.users.findFirst({
    where: eq(schema.users.id, id),
  });
}

export async function getUserByEmail(email: string) {
  return db.query.users.findFirst({
    where: eq(schema.users.email, email),
  });
}

export async function getUserByCpf(cpf: string) {
  const normalized = cpf.replace(/\D/g, "");
  return db.query.users.findFirst({
    where: sql`REPLACE(REPLACE(REPLACE(${schema.users.cpf}, '.', ''), '-', ''), '/', '') = ${normalized}`,
  });
}

export async function getDesmancheByResponsibleCpf(cpf: string) {
  const normalized = cpf.replace(/\D/g, "");
  return db.query.desmanches.findFirst({
    where: sql`REPLACE(REPLACE(REPLACE(${schema.desmanches.responsibleCpf}, '.', ''), '-', ''), '/', '') = ${normalized}`,
  });
}

export async function createUser(userData: schema.InsertUser) {
  const hashedPassword = await hashPassword(userData.password);
  const id = randomUUID();
  
  await db.insert(schema.users).values({
    id,
    ...userData,
    password: hashedPassword,
  });
  
  return getUserById(id);
}

export async function getAllUsers() {
  return db.query.users.findMany({
    orderBy: desc(schema.users.createdAt),
  });
}

export async function updateUserProfile(id: string, data: { name?: string; email?: string; phone?: string; whatsapp?: string; avatar?: string; whatsappContactPreference?: "whatsapp" | "chat_only" }) {
  await db.update(schema.users)
    .set(data)
    .where(eq(schema.users.id, id));
  return getUserById(id);
}

export async function setUserProfileComplete(id: string, complete: boolean) {
  await db.update(schema.users)
    .set({ profileComplete: complete })
    .where(eq(schema.users.id, id));
}

// ==================== ADDRESSES ====================
export async function getAddressByUserId(userId: string) {
  return db.query.addresses.findFirst({
    where: eq(schema.addresses.userId, userId),
  });
}

export async function createOrUpdateAddress(userId: string, data: {
  zipCode: string;
  street: string;
  number?: string;
  complement?: string;
  city: string;
  state: string;
}) {
  const existing = await getAddressByUserId(userId);
  if (existing) {
    await db.update(schema.addresses)
      .set(data)
      .where(eq(schema.addresses.id, existing.id));
    return getAddressByUserId(userId);
  } else {
    const id = randomUUID();
    await db.insert(schema.addresses).values({ id, userId, ...data });
    return db.query.addresses.findFirst({ where: eq(schema.addresses.id, id) });
  }
}

// ==================== DESMANCHES ====================
export async function getDesmancheById(id: string) {
  return db.query.desmanches.findFirst({
    where: eq(schema.desmanches.id, id),
    with: {
      documents: true,
    },
  });
}

export async function getDesmancheByEmail(email: string) {
  return db.query.desmanches.findFirst({
    where: eq(schema.desmanches.email, email),
  });
}

export async function getDesmancheByCnpj(cnpj: string) {
  return db.query.desmanches.findFirst({
    where: eq(schema.desmanches.cnpj, cnpj),
  });
}

export async function createDesmanche(data: schema.InsertDesmanche) {
  const hashedPassword = await hashPassword(data.password);
  const id = randomUUID();
  
  await db.insert(schema.desmanches).values({
    id,
    ...data,
    password: hashedPassword,
  });
  
  return getDesmancheById(id);
}

// ==================== DESMANCHE REGISTRATION VERIFICATION ====================

export function createDesmancheRegistrationVerification(data: {
  id: string;
  purpose?: "client_registration" | "desmanche_registration" | "guincho_registration";
  channel: "email" | "sms" | "whatsapp";
  email: string;
  phone: string;
  codeHash: string;
  expiresAt: number;
}) {
  sqlite.prepare(`
    INSERT INTO desmanche_registration_verifications
      (id, purpose, channel, email, phone, code_hash, expires_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(data.id, data.purpose ?? "desmanche_registration", data.channel, data.email, data.phone, data.codeHash, data.expiresAt);
}

export function getDesmancheRegistrationVerification(id: string): any {
  return sqlite.prepare(`
    SELECT id, purpose, channel, email, phone, code_hash, expires_at, attempts, consumed_at
    FROM desmanche_registration_verifications
    WHERE id = ?
  `).get(id);
}

export function incrementDesmancheRegistrationVerificationAttempts(id: string) {
  sqlite.prepare(`
    UPDATE desmanche_registration_verifications
    SET attempts = attempts + 1
    WHERE id = ?
  `).run(id);
}

export function consumeDesmancheRegistrationVerification(id: string) {
  return sqlite.prepare(`
    UPDATE desmanche_registration_verifications
    SET consumed_at = strftime('%s', 'now')
    WHERE id = ? AND consumed_at IS NULL
  `).run(id).changes === 1;
}

export async function getAllDesmanches(filters?: { status?: string; plan?: string }) {
  const conditions = [];
  
  if (filters?.status) {
    conditions.push(eq(schema.desmanches.status, filters.status as any));
  }
  if (filters?.plan) {
    conditions.push(eq(schema.desmanches.plan, filters.plan as any));
  }
  
  return db.query.desmanches.findMany({
    where: conditions.length > 0 ? and(...conditions) : undefined,
    orderBy: desc(schema.desmanches.createdAt),
  });
}

export async function updateDesmancheStatus(id: string, status: string, rejectionReason?: string) {
  const updateData: any = { status: status as any };
  if (rejectionReason) {
    updateData.rejectionReason = rejectionReason;
  }
  if (status === 'active') {
    updateData.rejectionReason = null;
  }
  await db.update(schema.desmanches)
    .set(updateData)
    .where(eq(schema.desmanches.id, id));
  return getDesmancheById(id);
}

export async function resubmitDesmanche(id: string, correctionNote?: string) {
  const updateData: any = { status: "resubmitted" as any };
  if (correctionNote) {
    updateData.rejectionReason = correctionNote;
  }
  await db.update(schema.desmanches)
    .set(updateData)
    .where(eq(schema.desmanches.id, id));
  return getDesmancheById(id);
}

export async function updateDesmancheProfile(id: string, data: { tradingName?: string; phone?: string; responsibleName?: string; responsibleCpf?: string; logo?: string; vehicleTypes?: string }) {
  await db.update(schema.desmanches)
    .set(data)
    .where(eq(schema.desmanches.id, id));
  return getDesmancheById(id);
}

export async function getDesmancheAddressByDesmancheId(desmancheId: string) {
  return db.query.desmancheAddresses.findFirst({
    where: eq(schema.desmancheAddresses.desmancheId, desmancheId),
  });
}

export async function createOrUpdateDesmancheAddress(desmancheId: string, data: {
  zipCode: string;
  street: string;
  number?: string;
  complement?: string;
  city: string;
  state: string;
}) {
  const existing = await getDesmancheAddressByDesmancheId(desmancheId);
  if (existing) {
    await db.update(schema.desmancheAddresses)
      .set(data)
      .where(eq(schema.desmancheAddresses.id, existing.id));
    return getDesmancheAddressByDesmancheId(desmancheId);
  } else {
    const id = randomUUID();
    await db.insert(schema.desmancheAddresses).values({ id, desmancheId, ...data });
    return db.query.desmancheAddresses.findFirst({ where: eq(schema.desmancheAddresses.id, id) });
  }
}

export async function updateDesmancheRating(id: string, rating: number) {
  await db.update(schema.desmanches)
    .set({ rating })
    .where(eq(schema.desmanches.id, id));
  return getDesmancheById(id);
}

// ==================== DOCUMENTS ====================
export async function createDocument(data: schema.InsertDocument) {
  const id = randomUUID();
  await db.insert(schema.documents).values({ id, ...data });
  return db.query.documents.findFirst({ where: eq(schema.documents.id, id) });
}

export async function getDocumentsByDesmanche(desmancheId: string) {
  return db.query.documents.findMany({
    where: eq(schema.documents.desmancheId, desmancheId),
    orderBy: desc(schema.documents.createdAt),
  });
}

export async function getDocumentById(id: string) {
  return db.query.documents.findFirst({ where: eq(schema.documents.id, id) });
}

export async function updateDocumentStatus(id: string, status: string) {
  await db.update(schema.documents)
    .set({ status: status as any })
    .where(eq(schema.documents.id, id));
}

// ==================== ORDER IMAGES ====================
export async function createOrderImage(orderId: string, url: string, orderItemId?: string) {
  const id = randomUUID();
  await db.insert(schema.orderImages).values({ id, orderId, url, orderItemId: orderItemId ?? null });
  return { id, orderId, orderItemId, url };
}

export async function getOrderImages(orderId: string) {
  return db.query.orderImages.findMany({
    where: eq(schema.orderImages.orderId, orderId),
  });
}

// ==================== ORDER ITEMS ====================
const THREE_DAYS_MS = 72 * 60 * 60 * 1000;

type OrderItemInput = {
  title: string;
  description?: string | null;
  vehicleType?: string | null;
  vehicleBrand?: string | null;
  vehicleModel?: string | null;
  vehicleYear?: number | null;
  vehiclePlate?: string | null;
  vehicleColor?: string | null;
  vehicleEngine?: string | null;
  partCategory?: string | null;
  partName?: string | null;
  partPosition?: string | null;
  partConditionAccepted?: string | null;
};

export async function createOrderItem(orderId: string, data: OrderItemInput) {
  const id = randomUUID();
  const expiresAt = new Date(Date.now() + THREE_DAYS_MS);
  await db.insert(schema.orderItems).values({
    id,
    orderId,
    title: data.title,
    description: data.description ?? null,
    vehicleType: data.vehicleType ?? null,
    vehicleBrand: data.vehicleBrand ?? null,
    vehicleModel: data.vehicleModel ?? null,
    vehicleYear: data.vehicleYear ?? null,
    vehiclePlate: data.vehiclePlate ?? null,
    vehicleColor: data.vehicleColor ?? null,
    vehicleEngine: data.vehicleEngine ?? null,
    partCategory: data.partCategory ?? null,
    partName: data.partName ?? null,
    partPosition: data.partPosition ?? null,
    partConditionAccepted: data.partConditionAccepted ?? 'any',
    expiresAt,
  });
  return getOrderItemById(id);
}

export async function getOrderItemById(id: string) {
  return db.query.orderItems.findFirst({
    where: eq(schema.orderItems.id, id),
    with: {
      proposals: { with: { desmanche: true } },
      images: true,
    },
  });
}

export async function getOrderItemsByOrder(orderId: string) {
  return db.query.orderItems.findMany({
    where: eq(schema.orderItems.orderId, orderId),
    orderBy: asc(schema.orderItems.createdAt),
    with: {
      proposals: { with: { desmanche: true } },
      images: true,
    },
  });
}

export async function updateOrderItemStatus(id: string, status: string) {
  await db.update(schema.orderItems)
    .set({ status: status as any, updatedAt: sql`(strftime('%s', 'now'))` })
    .where(eq(schema.orderItems.id, id));
  return getOrderItemById(id);
}

export async function reactivateOrderItem(id: string) {
  const expiresAt = new Date(Date.now() + THREE_DAYS_MS);
  await db.update(schema.orderItems)
    .set({ status: 'open', expiresAt, updatedAt: sql`(strftime('%s', 'now'))` })
    .where(eq(schema.orderItems.id, id));
  return getOrderItemById(id);
}

export async function expireOldOrderItems() {
  const now = new Date();
  await db.update(schema.orderItems)
    .set({ status: 'expired', updatedAt: sql`(strftime('%s', 'now'))` })
    .where(
      and(
        sql`${schema.orderItems.expiresAt} IS NOT NULL`,
        lte(schema.orderItems.expiresAt, now),
        sql`${schema.orderItems.status} IN ('open', 'has_proposals')`
      )
    );
}

// ==================== ORDERS ====================

export async function createOrder(
  data: schema.InsertOrder & {
    clientId: string | null;
    desmancheId?: string;
    items?: OrderItemInput[];
  }
) {
  const id = randomUUID();
  const expiresAt = new Date(Date.now() + THREE_DAYS_MS);
  const { items, ...orderData } = data;
  await db.insert(schema.orders).values({ id, ...orderData, expiresAt });

  // Criar items (usa os campos do próprio data como único item se não vier array)
  const itemsToCreate: OrderItemInput[] = items && items.length > 0 ? items : [{
    title: data.title,
    description: data.description,
    vehicleType: data.vehicleType,
    vehicleBrand: data.vehicleBrand,
    vehicleModel: data.vehicleModel,
    vehicleYear: data.vehicleYear,
    vehiclePlate: data.vehiclePlate,
    vehicleColor: data.vehicleColor,
    vehicleEngine: data.vehicleEngine,
    partCategory: data.partCategory,
    partName: data.partName,
    partPosition: data.partPosition,
    partConditionAccepted: data.partConditionAccepted,
  }];

  for (const item of itemsToCreate) {
    await createOrderItem(id, item);
  }

  return getOrderById(id);
}

export async function reactivateOrder(orderId: string) {
  const expiresAt = new Date(Date.now() + THREE_DAYS_MS);
  await db.update(schema.orders)
    .set({ status: "open", expiresAt, updatedAt: sql`(strftime('%s', 'now'))` })
    .where(eq(schema.orders.id, orderId));
  return getOrderById(orderId);
}

export async function expireOldOrders() {
  const now = new Date();
  await db.update(schema.orders)
    .set({ status: "expired", updatedAt: sql`(strftime('%s', 'now'))` })
    .where(
      and(
        sql`${schema.orders.expiresAt} IS NOT NULL`,
        lte(schema.orders.expiresAt, now),
        sql`${schema.orders.status} IN ('open', 'negotiating')`
      )
    );
}

// Expire orders where ALL items are expired/archived (no active items remain)
export function expireOrdersWithAllExpiredItems(): void {
  sqlite.exec(`
    UPDATE orders
    SET status = 'expired', updated_at = strftime('%s', 'now')
    WHERE status IN ('open', 'has_proposals')
    AND id NOT IN (
      SELECT DISTINCT order_id FROM order_items
      WHERE status IN ('open', 'has_proposals', 'negotiating', 'shipped', 'delivered', 'awaiting_review')
    )
  `);
}

export async function getOrdersByDesmanche(desmancheId: string) {
  return db.query.orders.findMany({
    where: eq(schema.orders.desmancheId, desmancheId),
    orderBy: desc(schema.orders.createdAt),
    with: {
      images: true,
      items: {
        with: {
          proposals: { with: { desmanche: true } },
          images: true,
        },
      },
      proposals: { with: { desmanche: true } },
    },
  });
}

export async function getOrderById(id: string) {
  return db.query.orders.findFirst({
    where: eq(schema.orders.id, id),
    with: {
      images: true,
      items: {
        with: {
          proposals: { with: { desmanche: true } },
          images: true,
        },
      },
      proposals: { with: { desmanche: true } },
    },
  });
}

export async function getOrdersByClient(clientId: string) {
  return db.query.orders.findMany({
    where: and(
      eq(schema.orders.clientId, clientId),
      eq(schema.orders.postedByType, "client")
    ),
    orderBy: desc(schema.orders.createdAt),
    with: {
      images: true,
      items: {
        with: {
          proposals: { with: { desmanche: true } },
          images: true,
        },
      },
      proposals: { with: { desmanche: true } },
    },
  });
}

export async function getAllOrders(filters?: { status?: string; urgency?: string; isPartnerRequest?: boolean; includeExpired?: boolean }) {
  let conditions: any[] = [];
  
  if (filters?.status) {
    conditions.push(eq(schema.orders.status, filters.status as any));
  } else if (!filters?.includeExpired) {
    conditions.push(sql`${schema.orders.status} != 'expired'`);
  }
  if (filters?.urgency) {
    conditions.push(eq(schema.orders.urgency, filters.urgency as any));
  }
  if (filters?.isPartnerRequest !== undefined) {
    conditions.push(eq(schema.orders.isPartnerRequest, filters.isPartnerRequest));
  }
  
  return db.query.orders.findMany({
    where: conditions.length > 0 ? and(...conditions) : undefined,
    orderBy: desc(schema.orders.createdAt),
    with: {
      client: true,
      desmanche: true,
      images: true,
      items: {
        with: {
          proposals: { with: { desmanche: true } },
          images: true,
        },
      },
      proposals: { with: { desmanche: true } },
    },
  });
}

export async function updateOrderStatus(id: string, status: string) {
  await db.update(schema.orders)
    .set({ 
      status: status as any,
      updatedAt: sql`(strftime('%s', 'now'))`,
    })
    .where(eq(schema.orders.id, id));
  return getOrderById(id);
}

// ==================== PROPOSALS ====================
export async function createProposal(data: schema.InsertProposal) {
  const id = randomUUID();
  await db.insert(schema.proposals).values({ id, ...data });
  return getProposalById(id);
}

export async function getProposalById(id: string) {
  return db.query.proposals.findFirst({
    where: eq(schema.proposals.id, id),
    with: {
      desmanche: true,
      order: true,
    },
  });
}

export async function getProposalsByOrder(orderId: string) {
  return db.query.proposals.findMany({
    where: eq(schema.proposals.orderId, orderId),
    orderBy: desc(schema.proposals.createdAt),
    with: {
      desmanche: true,
    },
  });
}

export async function getProposalsByDesmanche(desmancheId: string) {
  return db.query.proposals.findMany({
    where: eq(schema.proposals.desmancheId, desmancheId),
    orderBy: desc(schema.proposals.createdAt),
    with: {
      order: {
        with: { client: true },
      },
      orderItem: true,
    },
  });
}

export async function updateProposalStatus(id: string, status: string) {
  await db.update(schema.proposals)
    .set({ status: status as any })
    .where(eq(schema.proposals.id, id));
  return getProposalById(id);
}

export async function updateProposalContent(id: string, price: number, message: string) {
  await db.update(schema.proposals)
    .set({ price, message, status: "sent" as any })
    .where(eq(schema.proposals.id, id));
  return getProposalById(id);
}

export async function unlockWhatsapp(id: string) {
  await db.update(schema.proposals)
    .set({ whatsappUnlocked: true })
    .where(eq(schema.proposals.id, id));
  return getProposalById(id);
}

// ==================== NEGOTIATIONS ====================
export async function createNegotiation(data: {
  orderId: string;
  proposalId: string;
  clientId: string;
  desmancheId: string;
  price: number;
}) {
  const id = randomUUID();
  await db.insert(schema.negotiations).values({ id, ...data, status: 'negotiating' });
  return getNegotiationById(id);
}

export async function getNegotiationById(id: string) {
  return db.query.negotiations.findFirst({
    where: eq(schema.negotiations.id, id),
    with: {
      order: true,
      desmanche: true,
    },
  });
}

export async function getNegotiationsByOrder(orderId: string) {
  return db.query.negotiations.findMany({
    where: eq(schema.negotiations.orderId, orderId),
    orderBy: desc(schema.negotiations.createdAt),
    with: {
      desmanche: true,
      client: true,
      proposal: true,
    },
  });
}

export async function getNegotiationsByClient(clientId: string) {
  return db.query.negotiations.findMany({
    where: eq(schema.negotiations.clientId, clientId),
    orderBy: desc(schema.negotiations.createdAt),
    with: {
      order: true,
      desmanche: true,
      proposal: true,
    },
  });
}

export async function getNegotiationsByDesmanche(desmancheId: string) {
  return db.query.negotiations.findMany({
    where: eq(schema.negotiations.desmancheId, desmancheId),
    orderBy: desc(schema.negotiations.createdAt),
    with: {
      order: true,
      client: true,
      proposal: true,
    },
  });
}

export async function updateNegotiationStatus(id: string, status: string, trackingCode?: string) {
  const updateData: any = { 
    status: status as any,
    updatedAt: sql`(strftime('%s', 'now'))`,
  };
  if (trackingCode) {
    updateData.trackingCode = trackingCode;
  }
  
  await db.update(schema.negotiations)
    .set(updateData)
    .where(eq(schema.negotiations.id, id));
  return getNegotiationById(id);
}

// ==================== AUCTIONS ====================
export async function createAuction(data: schema.InsertAuction) {
  const id = randomUUID();
  await db.insert(schema.auctions).values({ id, ...data });
  return db.query.auctions.findFirst({ where: eq(schema.auctions.id, id) });
}

export async function getAllAuctions(filters?: { status?: string }) {
  return db.query.auctions.findMany({
    where: filters?.status ? eq(schema.auctions.status, filters.status as any) : undefined,
    orderBy: desc(schema.auctions.createdAt),
  });
}

export async function updateAuctionStatus(id: string, status: string) {
  await db.update(schema.auctions)
    .set({ status: status as any })
    .where(eq(schema.auctions.id, id));
}

// ==================== INVOICES ====================
export async function createInvoice(data: schema.InsertInvoice) {
  const id = randomUUID();
  await db.insert(schema.invoices).values({ id, ...data });
  return db.query.invoices.findFirst({ where: eq(schema.invoices.id, id) });
}

export async function getInvoicesByDesmanche(desmancheId: string) {
  return db.query.invoices.findMany({
    where: eq(schema.invoices.desmancheId, desmancheId),
    orderBy: desc(schema.invoices.createdAt),
  });
}

export async function getAllInvoices() {
  return db.query.invoices.findMany({
    orderBy: desc(schema.invoices.createdAt),
    with: {
      desmanche: true,
    },
  });
}

export async function updateInvoiceStatus(id: string, status: string) {
  await db.update(schema.invoices)
    .set({ status: status as any })
    .where(eq(schema.invoices.id, id));
}

// ==================== REVIEWS ====================
export async function createReview(data: schema.InsertReview) {
  const id = randomUUID();
  await db.insert(schema.reviews).values({ id, ...data });
  return db.query.reviews.findFirst({ where: eq(schema.reviews.id, id) });
}

export async function getReviewsByDesmanche(desmancheId: string) {
  return db.query.reviews.findMany({
    where: eq(schema.reviews.desmancheId, desmancheId),
    orderBy: desc(schema.reviews.createdAt),
  });
}

// ==================== DASHBOARD STATS ====================
export async function getDashboardStats() {
  const countSql = sql<number>`count(*)`;

  const [usersCount] = await db.select({ count: countSql }).from(schema.users);
  const [desmanchesCount] = await db.select({ count: countSql }).from(schema.desmanches);
  const [ordersCount] = await db.select({ count: countSql }).from(schema.orders);
  const [activeDesmanches] = await db.select({ count: countSql })
    .from(schema.desmanches)
    .where(eq(schema.desmanches.status, 'active'));
  const [pendingApprovals] = await db.select({ count: countSql })
    .from(schema.desmanches)
    .where(eq(schema.desmanches.status, 'pending'));
  const [openOrders] = await db.select({ count: countSql })
    .from(schema.orders)
    .where(eq(schema.orders.status, 'open'));

  const pendingComplaintsCount = getPendingComplaintsCount();

  const [pendingNegotiationsRow] = await db.select({ count: countSql })
    .from(schema.negotiations)
    .where(
      or(
        eq(schema.negotiations.status, 'stale_awaiting_desmanche'),
        eq(schema.negotiations.status, 'stale_awaiting_client'),
      )
    );

  return {
    totalUsers: Number(usersCount?.count ?? 0),
    totalDesmanches: Number(desmanchesCount?.count ?? 0),
    totalOrders: Number(ordersCount?.count ?? 0),
    activeDesmanches: Number(activeDesmanches?.count ?? 0),
    pendingApprovals: Number(pendingApprovals?.count ?? 0),
    openOrders: Number(openOrders?.count ?? 0),
    pendingComplaints: pendingComplaintsCount,
    pendingNegotiations: Number(pendingNegotiationsRow?.count ?? 0),
  };
}

export async function getStaleNegotiations() {
  return db.query.negotiations.findMany({
    where: or(
      eq(schema.negotiations.status, 'stale_awaiting_desmanche'),
      eq(schema.negotiations.status, 'stale_awaiting_client'),
    ),
    with: {
      order: true,
      desmanche: true,
    },
    orderBy: [desc(schema.negotiations.updatedAt)],
  });
}

// ==================== CHAT ====================
export async function createChatRoom(data: {
  proposalId: string;
  orderId: string;
  clientId: string;
  desmancheId: string;
}) {
  const id = randomUUID();
  await db.insert(schema.chatRooms).values({ id, ...data });
  return getChatRoomById(id);
}

export async function getChatRoomById(id: string) {
  return db.query.chatRooms.findFirst({
    where: eq(schema.chatRooms.id, id),
    with: {
      proposal: true,
      order: true,
      client: true,
      desmanche: true,
      messages: {
        orderBy: desc(schema.chatMessages.createdAt),
        limit: 1,
      },
    },
  });
}

export async function getChatRoomByProposal(proposalId: string) {
  return db.query.chatRooms.findFirst({
    where: eq(schema.chatRooms.proposalId, proposalId),
  });
}

export async function getChatRoomsByClient(clientId: string) {
  return db.query.chatRooms.findMany({
    where: eq(schema.chatRooms.clientId, clientId),
    orderBy: [desc(schema.chatRooms.lastMessageAt), desc(schema.chatRooms.createdAt)],
    with: {
      order: true,
      desmanche: true,
      messages: {
        orderBy: desc(schema.chatMessages.createdAt),
        limit: 1,
      },
    },
  });
}

export async function getChatRoomsByOrder(orderId: string) {
  return db.query.chatRooms.findMany({
    where: eq(schema.chatRooms.orderId, orderId),
    orderBy: [desc(schema.chatRooms.lastMessageAt), desc(schema.chatRooms.createdAt)],
    with: {
      client: true,
      desmanche: true,
      messages: {
        orderBy: desc(schema.chatMessages.createdAt),
        limit: 3,
      },
    },
  });
}

export async function getChatRoomsByDesmanche(desmancheId: string) {
  return db.query.chatRooms.findMany({
    where: eq(schema.chatRooms.desmancheId, desmancheId),
    orderBy: [desc(schema.chatRooms.lastMessageAt), desc(schema.chatRooms.createdAt)],
    with: {
      order: true,
      client: true,
      messages: {
        orderBy: desc(schema.chatMessages.createdAt),
        limit: 1,
      },
    },
  });
}

export async function getMessagesByRoom(roomId: string) {
  return db.query.chatMessages.findMany({
    where: eq(schema.chatMessages.roomId, roomId),
    orderBy: asc(schema.chatMessages.createdAt),
  });
}

export async function createChatMessage(data: {
  roomId: string;
  senderId: string;
  senderType: "client" | "desmanche";
  content: string;
}) {
  const id = randomUUID();
  await db.insert(schema.chatMessages).values({ id, ...data });
  await db.update(schema.chatRooms)
    .set({ lastMessageAt: sql`(strftime('%s', 'now'))` })
    .where(eq(schema.chatRooms.id, data.roomId));
  return db.query.chatMessages.findFirst({ where: eq(schema.chatMessages.id, id) });
}

export async function markRoomMessagesAsRead(roomId: string, readerId: string) {
  await db.update(schema.chatMessages)
    .set({ readAt: sql`(strftime('%s', 'now'))` })
    .where(
      and(
        eq(schema.chatMessages.roomId, roomId),
        sql`${schema.chatMessages.senderId} != ${readerId}`,
        sql`${schema.chatMessages.readAt} IS NULL`,
      )
    );
}

export async function countUnreadMessages(roomId: string, readerId: string) {
  const result = await db.select({ count: sql<number>`count(*)` })
    .from(schema.chatMessages)
    .where(
      and(
        eq(schema.chatMessages.roomId, roomId),
        sql`${schema.chatMessages.senderId} != ${readerId}`,
        sql`${schema.chatMessages.readAt} IS NULL`,
      )
    );
  return result[0]?.count || 0;
}

// ==================== PRE-PROPOSAL CHAT ====================
export async function getOrCreatePreProposalRoom(data: {
  orderId: string;
  orderItemId?: string;
  clientId: string;
  desmancheId: string;
}) {
  // Find existing room for this desmanche + order item (or order)
  const existing = await db.query.preProposalRooms.findFirst({
    where: and(
      eq(schema.preProposalRooms.desmancheId, data.desmancheId),
      eq(schema.preProposalRooms.clientId, data.clientId),
      data.orderItemId
        ? eq(schema.preProposalRooms.orderItemId, data.orderItemId)
        : eq(schema.preProposalRooms.orderId, data.orderId),
    ),
  });
  if (existing) return existing;
  const id = randomUUID();
  await db.insert(schema.preProposalRooms).values({
    id,
    orderId: data.orderId,
    orderItemId: data.orderItemId,
    clientId: data.clientId,
    desmancheId: data.desmancheId,
  });
  return db.query.preProposalRooms.findFirst({ where: eq(schema.preProposalRooms.id, id) });
}

export async function getPreProposalRoomById(id: string) {
  return db.query.preProposalRooms.findFirst({
    where: eq(schema.preProposalRooms.id, id),
  });
}

export async function getPreProposalRoomsByDesmanche(desmancheId: string) {
  const rows = sqlite.prepare(`
    SELECT r.*, 
      u.name AS client_name,
      o.title AS order_title,
      (SELECT COUNT(*) FROM pre_proposal_messages m WHERE m.room_id = r.id AND m.sender_id != ? AND m.read_at IS NULL) AS unread_count,
      (SELECT m.content FROM pre_proposal_messages m WHERE m.room_id = r.id ORDER BY m.created_at DESC LIMIT 1) AS last_message
    FROM pre_proposal_rooms r
    LEFT JOIN users u ON u.id = r.client_id
    LEFT JOIN orders o ON o.id = r.order_id
    WHERE r.desmanche_id = ?
    ORDER BY COALESCE(r.last_message_at, r.created_at) DESC
  `).all(desmancheId, desmancheId) as any[];
  return rows;
}

export async function getPreProposalRoomsByClient(clientId: string) {
  const rows = sqlite.prepare(`
    SELECT r.*,
      d.trading_name AS desmanche_name,
      o.title AS order_title,
      oi.part_name AS item_name,
      (SELECT COUNT(*) FROM pre_proposal_messages m WHERE m.room_id = r.id AND m.sender_id != ? AND m.read_at IS NULL) AS unread_count,
      (SELECT m.content FROM pre_proposal_messages m WHERE m.room_id = r.id ORDER BY m.created_at DESC LIMIT 1) AS last_message
    FROM pre_proposal_rooms r
    LEFT JOIN desmanches d ON d.id = r.desmanche_id
    LEFT JOIN orders o ON o.id = r.order_id
    LEFT JOIN order_items oi ON oi.id = r.order_item_id
    WHERE r.client_id = ?
    ORDER BY COALESCE(r.last_message_at, r.created_at) DESC
  `).all(clientId, clientId) as any[];
  return rows;
}

export async function getPreProposalMessages(roomId: string) {
  const rows = sqlite.prepare(`
    SELECT * FROM pre_proposal_messages WHERE room_id = ? ORDER BY created_at ASC
  `).all(roomId) as any[];
  return rows;
}

export async function createPreProposalMessage(data: {
  roomId: string;
  senderId: string;
  senderType: "client" | "desmanche";
  content: string;
}) {
  const id = randomUUID();
  sqlite.prepare(`
    INSERT INTO pre_proposal_messages (id, room_id, sender_id, sender_type, content, created_at)
    VALUES (?, ?, ?, ?, ?, strftime('%s', 'now'))
  `).run(id, data.roomId, data.senderId, data.senderType, data.content);
  sqlite.prepare(`
    UPDATE pre_proposal_rooms SET last_message_at = strftime('%s', 'now') WHERE id = ?
  `).run(data.roomId);
  return sqlite.prepare(`SELECT * FROM pre_proposal_messages WHERE id = ?`).get(id) as any;
}

export async function markPreProposalMessagesAsRead(roomId: string, readerId: string) {
  sqlite.prepare(`
    UPDATE pre_proposal_messages SET read_at = strftime('%s', 'now')
    WHERE room_id = ? AND sender_id != ? AND read_at IS NULL
  `).run(roomId, readerId);
}

export async function countUnreadPreProposalMessages(userId: string) {
  const result = sqlite.prepare(`
    SELECT COUNT(*) AS cnt FROM pre_proposal_messages m
    JOIN pre_proposal_rooms r ON r.id = m.room_id
    WHERE (r.client_id = ? OR r.desmanche_id = ?)
      AND m.sender_id != ?
      AND m.read_at IS NULL
  `).get(userId, userId, userId) as any;
  return result?.cnt || 0;
}

// ==================== SYSTEM SETTINGS ====================
export async function getSystemSetting(key: string): Promise<string | null> {
  const row = await db.query.systemSettings.findFirst({
    where: eq(schema.systemSettings.key, key),
  });
  return row?.value ?? null;
}

export async function getSystemSettingNumber(key: string, fallback: number): Promise<number> {
  const v = await getSystemSetting(key);
  if (!v) return fallback;
  const n = parseFloat(v);
  return isNaN(n) ? fallback : n;
}

export async function getAllSystemSettings() {
  return db.query.systemSettings.findMany();
}

export async function setSystemSetting(key: string, value: string) {
  await db.insert(schema.systemSettings)
    .values({ key, value, updatedAt: sql`(strftime('%s', 'now'))` })
    .onConflictDoUpdate({ target: schema.systemSettings.key, set: { value, updatedAt: sql`(strftime('%s', 'now'))` } });
}

// ==================== SUBSCRIPTION PLANS ====================
export async function getAllSubscriptionPlans(onlyActive = false) {
  return db.query.subscriptionPlans.findMany({
    where: onlyActive ? eq(schema.subscriptionPlans.active, true) : undefined,
    orderBy: asc(schema.subscriptionPlans.price),
  });
}

export async function getSubscriptionPlanById(id: string) {
  return db.query.subscriptionPlans.findFirst({
    where: eq(schema.subscriptionPlans.id, id),
  });
}

export async function createSubscriptionPlan(data: schema.InsertSubscriptionPlan) {
  const id = randomUUID();
  await db.insert(schema.subscriptionPlans).values({ id, ...data });
  return getSubscriptionPlanById(id);
}

export async function updateSubscriptionPlan(id: string, data: Partial<schema.InsertSubscriptionPlan>) {
  await db.update(schema.subscriptionPlans).set(data).where(eq(schema.subscriptionPlans.id, id));
  return getSubscriptionPlanById(id);
}

export async function deleteSubscriptionPlan(id: string) {
  await db.delete(schema.subscriptionPlans).where(eq(schema.subscriptionPlans.id, id));
}

// ==================== DESMANCHE BILLING ====================
export async function getDesmancheBilling(desmancheId: string) {
  return db.query.desmancheBilling.findFirst({
    where: eq(schema.desmancheBilling.desmancheId, desmancheId),
    with: { plan: true },
  });
}

export async function createOrUpdateDesmancheBilling(desmancheId: string, data: {
  billingModel?: "subscription" | "per_transaction" | "monthly_cycle";
  planId?: string | null;
  asaasCustomerId?: string;
}) {
  const existing = await getDesmancheBilling(desmancheId);
  if (existing) {
    const setData: any = {};
    if (data.billingModel !== undefined) setData.billingModel = data.billingModel;
    if (data.planId !== undefined) setData.planId = data.planId ?? null;
    if (data.asaasCustomerId) setData.asaasCustomerId = data.asaasCustomerId;
    if (Object.keys(setData).length > 0) {
      await db.update(schema.desmancheBilling)
        .set(setData)
        .where(eq(schema.desmancheBilling.desmancheId, desmancheId));
    }
  } else {
    const id = randomUUID();
    await db.insert(schema.desmancheBilling).values({
      id,
      desmancheId,
      billingModel: data.billingModel ?? "monthly_cycle",
      planId: data.planId ?? null,
      asaasCustomerId: data.asaasCustomerId,
      currentPeriodStart: 0, // Cycle starts only on first transaction, not on record creation
    });
  }
  return getDesmancheBilling(desmancheId);
}

export async function incrementBillingTransaction(desmancheId: string, amount: number, isFirstInCycle = false) {
  const setData: any = {
    monthlyTransactionCount: sql`monthly_transaction_count + 1`,
    monthlyAmountPaid: sql`monthly_amount_paid + ${amount}`,
  };
  if (isFirstInCycle) {
    setData.currentPeriodStart = sql`(strftime('%s', 'now'))`;
  }
  await db.update(schema.desmancheBilling)
    .set(setData)
    .where(eq(schema.desmancheBilling.desmancheId, desmancheId));
}

export async function resetMonthlyBillingCounters(desmancheId: string) {
  await db.update(schema.desmancheBilling)
    .set({
      monthlyTransactionCount: 0,
      monthlyAmountPaid: 0,
      currentPeriodStart: sql`(strftime('%s', 'now'))`,
    })
    .where(eq(schema.desmancheBilling.desmancheId, desmancheId));
}

export async function resetMonthlyCycle(desmancheId: string) {
  await db.update(schema.desmancheBilling)
    .set({
      monthlyTransactionCount: 0,
      monthlyAmountPaid: 0,
      currentPeriodStart: sql`0`,
    })
    .where(eq(schema.desmancheBilling.desmancheId, desmancheId));
}

export async function getDesmanchesWithOverdueMonthlyCycles() {
  const thirtyDaysAgo = Math.floor((Date.now() - 30 * 24 * 60 * 60 * 1000) / 1000);
  return db.query.desmancheBilling.findMany({
    where: and(
      eq(schema.desmancheBilling.billingModel, "monthly_cycle"),
      sql`${schema.desmancheBilling.monthlyTransactionCount} > 0`,
      sql`${schema.desmancheBilling.currentPeriodStart} > 0`,
      sql`${schema.desmancheBilling.currentPeriodStart} <= ${thirtyDaysAgo}`,
    ),
    with: { desmanche: true },
  });
}

export async function getPendingCycleBillingTransactions(desmancheId: string) {
  return db.query.billingTransactions.findMany({
    where: and(
      eq(schema.billingTransactions.desmancheId, desmancheId),
      eq(schema.billingTransactions.status, "pending"),
      eq(schema.billingTransactions.type, "monthly_cycle"),
    ),
    orderBy: asc(schema.billingTransactions.createdAt),
  });
}

export async function markBillingTransactionsAsBilled(txIds: string[], asaasChargeId: string, paymentLink?: string) {
  if (txIds.length === 0) return;
  const updateData: any = { status: "billed", asaasChargeId };
  if (paymentLink) updateData.paymentLink = paymentLink;
  await db.update(schema.billingTransactions)
    .set(updateData)
    .where(inArray(schema.billingTransactions.id, txIds));
}

// ==================== BILLING TRANSACTIONS ====================
export async function getBillingTransactionsByDesmanche(desmancheId: string) {
  return db.query.billingTransactions.findMany({
    where: eq(schema.billingTransactions.desmancheId, desmancheId),
    orderBy: desc(schema.billingTransactions.createdAt),
  });
}

export async function getAllBillingTransactions() {
  return db.query.billingTransactions.findMany({
    orderBy: desc(schema.billingTransactions.createdAt),
    with: { desmanche: true },
  });
}

export async function createBillingTransaction(data: {
  desmancheId: string;
  negotiationId?: string;
  amount: number;
  type: "per_transaction" | "subscription" | "monthly_cycle";
  description?: string;
  asaasChargeId?: string;
  paymentLink?: string;
  status?: "pending" | "paid" | "failed" | "exempt" | "billed";
}) {
  const id = randomUUID();
  await db.insert(schema.billingTransactions).values({
    id,
    desmancheId: data.desmancheId,
    negotiationId: data.negotiationId,
    amount: data.amount,
    type: data.type,
    description: data.description,
    asaasChargeId: data.asaasChargeId,
    paymentLink: data.paymentLink,
    status: data.status ?? "pending",
  });
  return db.query.billingTransactions.findFirst({ where: eq(schema.billingTransactions.id, id) });
}

export async function updateBillingTransactionStatus(id: string, status: "pending" | "paid" | "failed" | "exempt" | "billed", asaasChargeId?: string, paymentLink?: string) {
  const updateData: any = { status };
  if (asaasChargeId) updateData.asaasChargeId = asaasChargeId;
  if (paymentLink) updateData.paymentLink = paymentLink;
  if (status === "paid") updateData.paidAt = sql`(strftime('%s', 'now'))`;
  await db.update(schema.billingTransactions).set(updateData).where(eq(schema.billingTransactions.id, id));
}

export type AsaasWebhookEventInput = {
  eventId: string;
  eventType: string;
  paymentId?: string;
  payloadHash: string;
};

export type AsaasWebhookProcessResult = {
  status: "processed" | "ignored" | "duplicate";
  payloadHashMismatch: boolean;
};

/**
 * Atomically persists an Asaas event and applies its local effects. This is
 * deliberately synchronous: better-sqlite3 transactions must not await.
 */
export function processAsaasWebhookEvent(
  input: AsaasWebhookEventInput,
): AsaasWebhookProcessResult {
  const handledEvents = new Set(["PAYMENT_RECEIVED", "PAYMENT_CONFIRMED"]);

  return sqlite.transaction((event: AsaasWebhookEventInput): AsaasWebhookProcessResult => {
    const existing = sqlite.prepare(
      "SELECT payload_hash FROM asaas_webhook_events WHERE event_id = ?",
    ).get(event.eventId) as { payload_hash: string } | undefined;

    if (existing) {
      const payloadHashMismatch = existing.payload_hash !== event.payloadHash;
      if (payloadHashMismatch) {
        // Do not log the payload, token, payment data, or its hash.
        console.error("[webhook] duplicate Asaas event with a different payload hash");
      }
      return { status: "duplicate", payloadHashMismatch };
    }

    const now = Math.floor(Date.now() / 1000);
    if (!handledEvents.has(event.eventType)) {
      sqlite.prepare(`
        INSERT INTO asaas_webhook_events
          (event_id, event_type, payment_id, payload_hash, status, received_at, processed_at)
        VALUES (?, ?, ?, ?, 'ignored', ?, ?)
      `).run(event.eventId, event.eventType, event.paymentId ?? null, event.payloadHash, now, now);
      return { status: "ignored", payloadHashMismatch: false };
    }

    if (!event.paymentId) {
      throw new Error("paymentId is required for handled Asaas webhook events");
    }

    sqlite.prepare(`
      UPDATE billing_transactions
      SET status = 'paid',
          paid_at = CASE WHEN paid_at IS NULL THEN ? ELSE paid_at END
      WHERE asaas_charge_id = ?
    `).run(now, event.paymentId);

    sqlite.prepare(`
      UPDATE guinchos
      SET status = 'active'
      WHERE asaas_payment_id = ? AND status = 'pending'
    `).run(event.paymentId);

    sqlite.prepare(`
      INSERT INTO asaas_webhook_events
        (event_id, event_type, payment_id, payload_hash, status, received_at, processed_at)
      VALUES (?, ?, ?, ?, 'processed', ?, ?)
    `).run(event.eventId, event.eventType, event.paymentId, event.payloadHash, now, now);

    return { status: "processed", payloadHashMismatch: false };
  })(input);
}

// ==================== PROPOSAL LIMIT (subscription plans) ====================
export async function getMonthlyProposalCountForDesmanche(desmancheId: string): Promise<number> {
  const now = new Date();
  const startOfMonth = Math.floor(new Date(now.getFullYear(), now.getMonth(), 1).getTime() / 1000);
  const result = await db.select({ count: sql<number>`count(*)` })
    .from(schema.proposals)
    .where(
      and(
        eq(schema.proposals.desmancheId, desmancheId),
        sql`${schema.proposals.createdAt} >= ${startOfMonth}`,
      )
    );
  return Number(result[0]?.count ?? 0);
}

// ==================== REVIEW GATE / BLOCKING ====================
export async function getOverdueReviewCountForClient(clientId: string): Promise<number> {
  const now = Math.floor(Date.now() / 1000);
  const result = await db.select({ count: sql<number>`count(*)` })
    .from(schema.negotiations)
    .where(
      and(
        eq(schema.negotiations.clientId, clientId),
        eq(schema.negotiations.status, 'awaiting_review'),
        sql`${schema.negotiations.reviewDeadlineAt} IS NOT NULL`,
        sql`${schema.negotiations.reviewDeadlineAt} < ${now}`,
      )
    );
  return result[0]?.count || 0;
}

export async function getOverdueReviewCountForDesmanche(desmancheId: string): Promise<number> {
  const now = Math.floor(Date.now() / 1000);
  const result = await db.select({ count: sql<number>`count(*)` })
    .from(schema.negotiations)
    .where(
      and(
        eq(schema.negotiations.desmancheId, desmancheId),
        eq(schema.negotiations.status, 'awaiting_review'),
        sql`${schema.negotiations.reviewDeadlineAt} IS NOT NULL`,
        sql`${schema.negotiations.reviewDeadlineAt} < ${now}`,
      )
    );
  return result[0]?.count || 0;
}

export async function getPendingReviewsForClient(clientId: string) {
  return db.query.negotiations.findMany({
    where: and(
      eq(schema.negotiations.clientId, clientId),
      eq(schema.negotiations.status, 'awaiting_review'),
    ),
    with: { order: true, desmanche: true },
  });
}

export async function autoExpireOverdueReviews(): Promise<Array<{ id: string; desmancheId: string }>> {
  const now = Math.floor(Date.now() / 1000);
  const overdue = await db.select({
    id: schema.negotiations.id,
    desmancheId: schema.negotiations.desmancheId,
  }).from(schema.negotiations)
    .where(
      and(
        eq(schema.negotiations.status, 'awaiting_review'),
        sql`${schema.negotiations.reviewDeadlineAt} IS NOT NULL`,
        sql`${schema.negotiations.reviewDeadlineAt} < ${now}`,
      )
    );
  if (overdue.length > 0) {
    await db.update(schema.negotiations)
      .set({ status: 'completed', updatedAt: sql`(strftime('%s', 'now'))` })
      .where(
        and(
          eq(schema.negotiations.status, 'awaiting_review'),
          sql`${schema.negotiations.reviewDeadlineAt} IS NOT NULL`,
          sql`${schema.negotiations.reviewDeadlineAt} < ${now}`,
        )
      );
  }
  return overdue;
}

export async function detectStaleNegotiations(staleDays: number): Promise<Array<{ id: string; desmancheId: string }>> {
  const cutoff = Math.floor(Date.now() / 1000) - staleDays * 24 * 60 * 60;
  const stale = await db.select({
    id: schema.negotiations.id,
    desmancheId: schema.negotiations.desmancheId,
  }).from(schema.negotiations)
    .where(
      and(
        eq(schema.negotiations.status, 'negotiating'),
        sql`${schema.negotiations.updatedAt} IS NOT NULL`,
        sql`${schema.negotiations.updatedAt} < ${cutoff}`,
      )
    );
  if (stale.length > 0) {
    const now = new Date();
    await db.update(schema.negotiations)
      .set({ status: 'stale_awaiting_desmanche', staleCheckAt: now, updatedAt: now })
      .where(
        and(
          eq(schema.negotiations.status, 'negotiating'),
          sql`${schema.negotiations.updatedAt} < ${cutoff}`,
        )
      );
  }
  return stale;
}

export async function respondStaleAsDesmanche(id: string, response: "sold" | "not_sold" | "still_negotiating") {
  const now = new Date();
  if (response === "still_negotiating") {
    await db.update(schema.negotiations)
      .set({ status: 'negotiating', staleCheckAt: null, desmanchemResponse: response, updatedAt: now })
      .where(eq(schema.negotiations.id, id));
  } else {
    // Both "sold" and "not_sold" proceed to client confirmation
    await db.update(schema.negotiations)
      .set({ status: 'stale_awaiting_client', staleCheckAt: null, desmanchemResponse: response, updatedAt: now })
      .where(eq(schema.negotiations.id, id));
  }
  return getNegotiationById(id);
}

type NegotiationById = Awaited<ReturnType<typeof getNegotiationById>>;

export async function respondStaleAsClient(
  id: string,
  response: "received" | "not_received",
  reviewDeadlineDays: number,
): Promise<{ negotiation: NegotiationById; divergence: boolean }> {
  const negotiation = await getNegotiationById(id);
  if (!negotiation) return { negotiation: undefined, divergence: false };

  const desmancheResp = negotiation.desmanchemResponse;
  const now = new Date();

  // Determine outcome based on both responses
  const desmancheSold = desmancheResp === "sold";
  const clientReceived = response === "received";
  const divergence = desmancheSold !== clientReceived;

  if (divergence) {
    await db.update(schema.negotiations)
      .set({ status: 'in_moderation', staleCheckAt: null, clientResponse: response, updatedAt: now })
      .where(eq(schema.negotiations.id, id));
  } else if (clientReceived) {
    const deadline = new Date(now.getTime() + reviewDeadlineDays * 24 * 60 * 60 * 1000);
    await db.update(schema.negotiations)
      .set({ status: 'awaiting_review', staleCheckAt: null, clientResponse: response, receivedAt: now, reviewDeadlineAt: deadline, updatedAt: now })
      .where(eq(schema.negotiations.id, id));
  } else {
    await db.update(schema.negotiations)
      .set({ status: 'cancelled', staleCheckAt: null, clientResponse: response, updatedAt: now })
      .where(eq(schema.negotiations.id, id));
  }

  const updated = await getNegotiationById(id);
  return { negotiation: updated, divergence };
}

export async function getModerationNegotiations() {
  return db.query.negotiations.findMany({
    where: eq(schema.negotiations.status, 'in_moderation'),
    with: {
      order: true,
      desmanche: true,
      client: true,
    },
    orderBy: [desc(schema.negotiations.updatedAt)],
  });
}

export async function resolveModerationNegotiation(id: string, resolution: 'sold' | 'cancelled', reviewDeadlineDays: number, adminId: string) {
  const now = new Date();
  if (resolution === 'sold') {
    const deadline = new Date(now.getTime() + reviewDeadlineDays * 24 * 60 * 60 * 1000);
    await db.update(schema.negotiations)
      .set({ status: 'awaiting_review', receivedAt: now, reviewDeadlineAt: deadline, updatedAt: now, resolvedByAdminId: adminId, resolvedAt: now })
      .where(eq(schema.negotiations.id, id));
  } else {
    await db.update(schema.negotiations)
      .set({ status: 'cancelled', updatedAt: now, resolvedByAdminId: adminId, resolvedAt: now })
      .where(eq(schema.negotiations.id, id));
  }
  return getNegotiationById(id);
}

export async function getResolvedModerationNegotiations(filters?: {
  dateFrom?: string;
  dateTo?: string;
  resolution?: 'sold' | 'cancelled';
  desmancheName?: string;
  clientName?: string;
}) {
  const conditions: SQL<unknown>[] = [
    isNotNull(schema.negotiations.resolvedByAdminId),
  ];

  if (filters?.resolution === 'sold') {
    conditions.push(inArray(schema.negotiations.status, ['awaiting_review', 'completed']));
  } else if (filters?.resolution === 'cancelled') {
    conditions.push(eq(schema.negotiations.status, 'cancelled'));
  } else {
    conditions.push(inArray(schema.negotiations.status, ['awaiting_review', 'completed', 'cancelled']));
  }

  if (filters?.dateFrom) {
    conditions.push(gte(schema.negotiations.resolvedAt, new Date(filters.dateFrom)));
  }

  if (filters?.dateTo) {
    const toDate = new Date(filters.dateTo);
    toDate.setHours(23, 59, 59, 999);
    conditions.push(lte(schema.negotiations.resolvedAt, toDate));
  }

  if (filters?.desmancheName) {
    const term = `%${filters.desmancheName}%`;
    conditions.push(
      sql`lower((SELECT trading_name FROM desmanches WHERE desmanches.id = ${schema.negotiations.desmancheId})) LIKE lower(${term})`
    );
  }

  if (filters?.clientName) {
    const term = `%${filters.clientName}%`;
    conditions.push(
      sql`lower((SELECT name FROM users WHERE users.id = ${schema.negotiations.clientId})) LIKE lower(${term})`
    );
  }

  return db.query.negotiations.findMany({
    where: and(...conditions),
    with: {
      order: true,
      desmanche: true,
      client: true,
      resolvedByAdmin: true,
    },
    orderBy: [desc(schema.negotiations.resolvedAt)],
    limit: 200,
  });
}

export async function setNegotiationReceived(id: string, reviewDeadlineDays: number) {
  const now = new Date();
  const deadline = new Date(now.getTime() + reviewDeadlineDays * 24 * 60 * 60 * 1000);
  await db.update(schema.negotiations)
    .set({
      status: 'awaiting_review',
      receivedAt: now,
      reviewDeadlineAt: deadline,
      updatedAt: now,
    })
    .where(eq(schema.negotiations.id, id));
  return getNegotiationById(id);
}

// ==================== SEED DATA ====================
// ─── EMAIL VERIFICATION + PASSWORD RESET ────────────────────────────────────

export function setEmailVerificationToken(userId: string, token: string, expiresAt: number) {
  sqlite.prepare("UPDATE users SET email_verification_token = ?, email_verification_expires = ? WHERE id = ?").run(token, expiresAt, userId);
}

export function getUserByVerificationToken(token: string): any {
  return sqlite.prepare("SELECT * FROM users WHERE email_verification_token = ?").get(token);
}

export function markEmailVerified(userId: string) {
  sqlite.prepare("UPDATE users SET email_verified = 1, email_verification_token = NULL, email_verification_expires = NULL WHERE id = ?").run(userId);
}

export function isEmailVerified(userId: string): boolean {
  const row = sqlite.prepare("SELECT email_verified FROM users WHERE id = ?").get(userId) as any;
  return !!row?.email_verified;
}

export function setPasswordResetToken(userId: string, token: string, expiresAt: number) {
  sqlite.prepare("UPDATE users SET password_reset_token = ?, password_reset_expires = ? WHERE id = ?").run(token, expiresAt, userId);
}

export function getUserByPasswordResetToken(token: string): any {
  return sqlite.prepare("SELECT * FROM users WHERE password_reset_token = ?").get(token);
}

export function clearPasswordResetToken(userId: string) {
  sqlite.prepare("UPDATE users SET password_reset_token = NULL, password_reset_expires = NULL WHERE id = ?").run(userId);
}

export async function updateUserPassword(userId: string, hashedPassword: string) {
  sqlite.prepare("UPDATE users SET password = ? WHERE id = ?").run(hashedPassword, userId);
}

export function autoVerifyAdmin(email: string) {
  sqlite.prepare("UPDATE users SET email_verified = 1 WHERE email = ?").run(email);
}

// ─── SITE SETTINGS ────────────────────────────────────────────────────────────

export function getSiteSettings(): Record<string, string> {
  const rows = sqlite.prepare("SELECT key, value FROM site_settings").all() as { key: string; value: string }[];
  const result: Record<string, string> = {};
  for (const row of rows) result[row.key] = row.value;
  return result;
}

export function setSiteSetting(key: string, value: string) {
  sqlite.prepare("INSERT INTO site_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(key, value);
}

export function setSiteSettings(data: Record<string, string>) {
  const stmt = sqlite.prepare("INSERT INTO site_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value");
  for (const [key, value] of Object.entries(data)) stmt.run(key, value);
}

// ─── BRAND LOGOS ──────────────────────────────────────────────────────────────

export function getBrandLogos(): { id: string; brandId: string; brandName: string; logoUrl: string; vehicleType: string }[] {
  return (sqlite.prepare("SELECT id, brand_id AS brandId, brand_name AS brandName, logo_url AS logoUrl, vehicle_type AS vehicleType FROM brand_logos ORDER BY brand_name ASC").all() as any[]);
}

export function upsertBrandLogo(brandId: string, brandName: string, logoUrl: string, vehicleType: string = "car") {
  sqlite.prepare(`
    INSERT INTO brand_logos (id, brand_id, brand_name, logo_url, vehicle_type) VALUES (lower(hex(randomblob(16))), ?, ?, ?, ?)
    ON CONFLICT(brand_id) DO UPDATE SET logo_url = excluded.logo_url, brand_name = excluded.brand_name, vehicle_type = excluded.vehicle_type
  `).run(brandId, brandName, logoUrl, vehicleType);
  return sqlite.prepare("SELECT id, brand_id AS brandId, brand_name AS brandName, logo_url AS logoUrl, vehicle_type AS vehicleType FROM brand_logos WHERE brand_id = ?").get(brandId);
}

export function deleteBrandLogo(id: string) {
  sqlite.prepare("DELETE FROM brand_logos WHERE id = ?").run(id);
}

export async function seedDemoDatabase() {
  // Verifica se já existe admin
  const admin = await getUserByEmail('admin@centraldesmanches.com');
  if (!admin) {
    await createUser({
      name: 'Administrador',
      email: 'admin@centraldesmanches.com',
      phone: '(11) 99999-9999',
      password: 'admin123',
      type: 'admin',
    });
    console.log('Admin criado: admin@centraldesmanches.com / admin123');
  }
  // Auto-verify admin and all existing/seed users
  autoVerifyAdmin('admin@centraldesmanches.com');
  sqlite.prepare("UPDATE users SET email_verified = 1 WHERE type = 'admin'").run();
  sqlite.prepare("UPDATE users SET email_verified = 1 WHERE email = 'recriarme@gmail.com'").run();
  
  // Verifica se já existe desmanche
  const desmanche = await getDesmancheByEmail('contato@irmaossilva.com');
  if (!desmanche) {
    const newDesmanche = await createDesmanche({
      companyName: 'Desmanche Irmãos Silva Ltda',
      tradingName: 'Irmãos Silva',
      cnpj: '98.765.432/0001-10',
      email: 'contato@irmaossilva.com',
      phone: '(11) 98888-5555',
      password: 'desmanche123',
      plan: 'monthly',
    });
    
    if (newDesmanche) {
      await updateDesmancheStatus(newDesmanche.id, 'active');
      
      // Adiciona documentos
      await createDocument({
        desmancheId: newDesmanche.id,
        type: 'alvara',
        name: 'Alvará de Funcionamento',
        url: '/docs/alvara.pdf',
        validUntil: new Date('2026-04-15'),
      });
      
      await createDocument({
        desmancheId: newDesmanche.id,
        type: 'credenciamento_detran',
        name: 'Credenciamento Detran',
        url: '/docs/credenciamento.pdf',
        validUntil: new Date('2026-12-10'),
      });
      
      console.log('Desmanche criado: contato@irmaossilva.com / desmanche123');
    }
  }
  
  // Verifica se já existe cliente
  const client = await getUserByEmail('cliente@email.com');
  if (!client) {
    await createUser({
      name: 'Carlos Eduardo',
      email: 'cliente@email.com',
      phone: '(11) 98888-7777',
      password: 'cliente123',
      type: 'client',
    });
    console.log('Cliente criado: cliente@email.com / cliente123');
  }
  
  // Cria alguns leilões
  const auctions = await getAllAuctions();
  if (auctions.length === 0) {
    await createAuction({
      title: 'Leilão Detran/SP - Lote Veículos Inteiros',
      source: 'Detran SP',
      lotCount: 450,
      estimatedValue: 1200000,
      endTime: new Date(Date.now() + 7200 * 1000), // 2 horas
      status: 'live',
      url: 'https://leiloes.detran.sp.gov.br',
    });
    
    await createAuction({
      title: 'Sucatas e Peças Aproveitáveis - Seguradora',
      source: 'Seguradora XYZ',
      lotCount: 120,
      estimatedValue: 450000,
      endTime: new Date(Date.now() + 86400 * 1000), // 24 horas
      status: 'upcoming',
      url: 'https://leiloes.seguradora.com',
    });
    
    console.log('Leilões de exemplo criados');
  }
}

// ==================== COMPLAINTS ====================

export interface ComplaintInput {
  type: "denuncia" | "sugestao" | "reclamacao";
  subject: string;
  message: string;
  authorId: string;
  authorType: "client" | "desmanche";
  authorName?: string;
  targetType?: "listing" | "general" | "desmanche";
  targetId?: string;
  targetDescription?: string;
  desmancheId?: string;
}

export function createComplaint(data: ComplaintInput): any {
  const id = randomUUID();
  sqlite.prepare(`
    INSERT INTO complaints (id, type, subject, message, author_id, author_type, author_name, target_type, target_id, target_description, desmanche_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, data.type, data.subject, data.message, data.authorId, data.authorType,
    data.authorName || null, data.targetType || null, data.targetId || null,
    data.targetDescription || null, data.desmancheId || null);
  return sqlite.prepare("SELECT * FROM complaints WHERE id = ?").get(id);
}

export function getPendingComplaintsCount(): number {
  const row = sqlite.prepare("SELECT COUNT(*) as c FROM complaints WHERE status = 'pending'").get() as any;
  return row?.c ?? 0;
}

// Returns distinct desmanches a client has interacted with (proposals OR negotiations)
// plus all client orders — used for complaint association dropdowns
export async function getDesmanchesByClientInteractions(clientId: string): Promise<{
  desmanches: any[];
  orders: any[];
}> {
  // All client orders
  const orders = sqlite.prepare(`
    SELECT o.id, o.title, o.status, o.created_at
    FROM orders o
    WHERE o.client_id = ? AND o.posted_by_type = 'client'
    ORDER BY o.created_at DESC
  `).all(clientId) as any[];

  // Desmanches from negotiations
  const fromNeg = sqlite.prepare(`
    SELECT DISTINCT d.id, d.trading_name, d.company_name, d.logo, n.order_id
    FROM negotiations n
    JOIN desmanches d ON n.desmanche_id = d.id
    WHERE n.client_id = ?
  `).all(clientId) as any[];

  // Desmanches from proposals on client's orders
  const fromProp = sqlite.prepare(`
    SELECT DISTINCT d.id, d.trading_name, d.company_name, d.logo, p.order_id
    FROM proposals p
    JOIN desmanches d ON p.desmanche_id = d.id
    JOIN orders o ON p.order_id = o.id
    WHERE o.client_id = ?
  `).all(clientId) as any[];

  // Merge and deduplicate desmanches, tracking which orders they relate to
  const desmancheMap = new Map<string, { id: string; tradingName: string; companyName: string; logo: string | null; orderIds: Set<string> }>();
  for (const row of [...fromNeg, ...fromProp]) {
    if (!desmancheMap.has(row.id)) {
      desmancheMap.set(row.id, {
        id: row.id,
        tradingName: row.trading_name,
        companyName: row.company_name,
        logo: row.logo,
        orderIds: new Set(),
      });
    }
    if (row.order_id) desmancheMap.get(row.id)!.orderIds.add(row.order_id);
  }

  const desmanches = Array.from(desmancheMap.values()).map((d) => ({
    id: d.id,
    tradingName: d.tradingName,
    companyName: d.companyName,
    logo: d.logo,
    orderIds: Array.from(d.orderIds),
  }));

  return { desmanches, orders };
}

export function getComplaintsByAuthor(authorId: string): any[] {
  return sqlite.prepare("SELECT * FROM complaints WHERE author_id = ? ORDER BY created_at DESC").all(authorId) as any[];
}

export function getAllComplaints(filters?: { type?: string; status?: string }): any[] {
  let query = "SELECT * FROM complaints WHERE 1=1";
  const params: any[] = [];
  if (filters?.type) { query += " AND type = ?"; params.push(filters.type); }
  if (filters?.status) { query += " AND status = ?"; params.push(filters.status); }
  query += " ORDER BY created_at DESC";
  return sqlite.prepare(query).all(...params) as any[];
}

export function updateComplaintStatus(id: string, status: string, adminNotes?: string): any {
  sqlite.prepare("UPDATE complaints SET status = ?, admin_notes = COALESCE(?, admin_notes) WHERE id = ?")
    .run(status, adminNotes || null, id);
  return sqlite.prepare("SELECT * FROM complaints WHERE id = ?").get(id);
}

export function getComplaintById(id: string): any {
  return sqlite.prepare("SELECT * FROM complaints WHERE id = ?").get(id);
}

// ==================== REAL SITE STATS ====================

export function getRealStats() {
  const desmanchesOnline = (sqlite.prepare("SELECT COUNT(*) as c FROM desmanches WHERE status = 'active'").get() as any)?.c ?? 0;
  const clientsTotal = (sqlite.prepare("SELECT COUNT(*) as c FROM users WHERE type = 'client'").get() as any)?.c ?? 0;
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayStartSec = Math.floor(todayStart.getTime() / 1000);
  const ordersToday = (sqlite.prepare("SELECT COUNT(*) as c FROM orders WHERE created_at >= ?").get(todayStartSec) as any)?.c ?? 0;
  const activeNegotiations = (sqlite.prepare("SELECT COUNT(*) as c FROM negotiations WHERE status IN ('negotiating','awaiting_review')").get() as any)?.c ?? 0;
  return { desmanchesOnline, clientsTotal, ordersToday, activeNegotiations };
}

// ==================== ADMIN USER MANAGEMENT ====================

export function getAdminUsers(): any[] {
  return sqlite.prepare("SELECT id, name, email, phone, status, permissions, created_at FROM users WHERE type = 'admin' ORDER BY created_at ASC").all() as any[];
}

export function setAdminPermissions(id: string, permissions: string[] | null): void {
  const val = permissions === null ? null : JSON.stringify(permissions);
  sqlite.prepare("UPDATE users SET permissions = ? WHERE id = ? AND type = 'admin'").run(val, id);
}

export function getAdminPermissions(id: string): string[] | null {
  const row = sqlite.prepare("SELECT permissions FROM users WHERE id = ?").get(id) as any;
  if (!row) return null;
  if (row.permissions === null || row.permissions === undefined) return null;
  try { return JSON.parse(row.permissions); } catch { return null; }
}

export function deleteAdminUser(id: string): void {
  sqlite.prepare("DELETE FROM users WHERE id = ? AND type = 'admin'").run(id);
}

export function updateAdminUser(id: string, data: { name?: string }): void {
  if (data.name) {
    sqlite.prepare("UPDATE users SET name = ? WHERE id = ? AND type = 'admin'").run(data.name, id);
  }
}

export function setUserStatus(id: string, status: "active" | "inactive"): void {
  sqlite.prepare("UPDATE users SET status = ? WHERE id = ?").run(status, id);
}

// ─── GUINCHOS ─────────────────────────────────────────────────────────────────

sqlite.exec(`
  CREATE TABLE IF NOT EXISTS guinchos (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    name TEXT NOT NULL,
    trading_name TEXT NOT NULL,
    document_type TEXT NOT NULL DEFAULT 'cnpj',
    cnpj TEXT UNIQUE,
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
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
  );
`);

// Idempotent migrations for columns added after the original guinchos table.
// These must run before the legacy cnpj rebuild so its explicit INSERT can
// preserve every current column.
for (const stmt of [
  "ALTER TABLE guinchos ADD COLUMN document_type TEXT NOT NULL DEFAULT 'cnpj'",
  "ALTER TABLE guinchos ADD COLUMN cpf TEXT",
  "ALTER TABLE guinchos ADD COLUMN antt TEXT",
  "ALTER TABLE guinchos ADD COLUMN photo_url TEXT",
  "ALTER TABLE guinchos ADD COLUMN latitude REAL",
  "ALTER TABLE guinchos ADD COLUMN longitude REAL",
  "ALTER TABLE guinchos ADD COLUMN asaas_customer_id TEXT",
  "ALTER TABLE guinchos ADD COLUMN asaas_payment_id TEXT",
  "ALTER TABLE guinchos ADD COLUMN asaas_subscription_id TEXT",
  "ALTER TABLE guinchos ADD COLUMN plan TEXT NOT NULL DEFAULT 'annual'",
]) {
  try { sqlite.exec(stmt); } catch { /* column already exists */ }
}

// SQLite can't drop a NOT NULL constraint via ALTER TABLE, so rebuild the table
// if the legacy `cnpj NOT NULL` constraint is still present (needed for CPF-only guinchos).
// The rebuild, validation, and index creation preserve the existing foreign_keys state.
migrateGuinchos(sqlite);

// Must be initialized after the guinchos structural migration, because these
// finalizers prepare statements for both local entity tables.
const asaasCustomerLinkStore = createAsaasCustomerLinkStore(sqlite);
export const completeAsaasCustomerForDesmanche = asaasCustomerLinkStore.completeDesmanche;
export const completeAsaasCustomerForGuincho = asaasCustomerLinkStore.completeGuincho;

export async function createGuincho(data: any): Promise<any> {
  const { password, ...rest } = data;
  const hashed = await bcrypt.hash(password, 10);
  const id = randomUUID();
  const coords = await geocodeAddress({
    street: rest.street, number: rest.number, neighborhood: rest.neighborhood,
    city: rest.city, state: rest.state, zipCode: rest.zipCode,
  });
  sqlite.prepare(`
    INSERT INTO guinchos (id, name, trading_name, document_type, cnpj, cpf, antt, email, phone, whatsapp, password, description, zip_code, street, number, neighborhood, city, state, service_radius, photo_url, latitude, longitude, plan)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, rest.name, rest.tradingName, rest.documentType ?? "cnpj", rest.cnpj ?? null, rest.cpf ?? null, rest.antt ?? null,
    rest.email, rest.phone, rest.whatsapp,
    hashed, rest.description ?? null, rest.zipCode, rest.street, rest.number ?? null,
    rest.neighborhood ?? null, rest.city, rest.state, rest.serviceRadius ?? 50,
    rest.photoUrl ?? null, coords?.latitude ?? null, coords?.longitude ?? null, rest.plan ?? "annual"
  );
  return getGuinchoById(id);
}

/**
 * Geocode a Brazilian address into lat/lng using the free Nominatim (OpenStreetMap) API.
 * Nominatim requires a descriptive User-Agent and has a strict rate limit — this is
 * only called on register/address-update, never on list/read paths.
 */
export async function geocodeAddress(addr: {
  street?: string | null; number?: string | null; neighborhood?: string | null;
  city: string; state: string; zipCode?: string | null;
}): Promise<{ latitude: number; longitude: number } | null> {
  try {
    const parts = [
      [addr.street, addr.number].filter(Boolean).join(", "),
      addr.neighborhood,
      addr.city,
      addr.state,
      "Brasil",
    ].filter(Boolean);
    const query = parts.join(", ");
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=br&q=${encodeURIComponent(query)}`;
    const res = await fetch(url, {
      headers: { "User-Agent": "CentralDosDesmanches/1.0 (contato@centraldosdesmanches.com.br)" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const results = (await res.json()) as Array<{ lat: string; lon: string }>;
    if (!results.length) return null;
    return { latitude: parseFloat(results[0].lat), longitude: parseFloat(results[0].lon) };
  } catch {
    return null;
  }
}

export function getGuinchoById(id: string): any | undefined {
  return sqlite.prepare("SELECT * FROM guinchos WHERE id = ?").get(id) as any;
}

export function getGuinchoByEmail(email: string): any | undefined {
  return sqlite.prepare("SELECT * FROM guinchos WHERE email = ?").get(email) as any;
}

export function getGuinchoByCnpj(cnpj: string): any | undefined {
  return sqlite.prepare("SELECT * FROM guinchos WHERE cnpj = ?").get(cnpj) as any;
}

export function getGuinchoByCpf(cpf: string): any | undefined {
  return sqlite.prepare("SELECT * FROM guinchos WHERE cpf = ?").get(cpf) as any;
}

export function listGuinchos(opts: { status?: string; city?: string; state?: string; limit?: number; offset?: number } = {}): any[] {
  const { status, city, state, limit = 50, offset = 0 } = opts;
  const conditions: string[] = [];
  const params: any[] = [];
  if (status) { conditions.push("status = ?"); params.push(status); }
  if (city) { conditions.push("LOWER(city) LIKE LOWER(?)"); params.push(`%${city}%`); }
  if (state) { conditions.push("state = ?"); params.push(state); }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  params.push(limit, offset);
  return sqlite.prepare(`SELECT * FROM guinchos ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`).all(...params) as any[];
}

export function countGuinchos(opts: { status?: string; city?: string; state?: string } = {}): number {
  const { status, city, state } = opts;
  const conditions: string[] = [];
  const params: any[] = [];
  if (status) { conditions.push("status = ?"); params.push(status); }
  if (city) { conditions.push("LOWER(city) LIKE LOWER(?)"); params.push(`%${city}%`); }
  if (state) { conditions.push("state = ?"); params.push(state); }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  return (sqlite.prepare(`SELECT COUNT(*) as c FROM guinchos ${where}`).get(...params) as any)?.c ?? 0;
}

export function updateGuinchoStatus(id: string, status: string, rejectionReason?: string): void {
  sqlite.prepare("UPDATE guinchos SET status = ?, rejection_reason = ? WHERE id = ?").run(status, rejectionReason ?? null, id);
}

export function updateGuinchoAsaas(id: string, asaasCustomerId: string, asaasPaymentId: string): void {
  sqlite.prepare("UPDATE guinchos SET asaas_customer_id = ?, asaas_payment_id = ? WHERE id = ?").run(asaasCustomerId, asaasPaymentId, id);
}

export function updateGuinchoAsaasFull(id: string, opts: {
  asaasCustomerId: string;
  asaasPaymentId?: string;
  asaasSubscriptionId?: string;
  plan?: "annual" | "monthly";
}): void {
  sqlite.prepare(
    "UPDATE guinchos SET asaas_customer_id = ?, asaas_payment_id = COALESCE(?, asaas_payment_id), asaas_subscription_id = COALESCE(?, asaas_subscription_id), plan = COALESCE(?, plan) WHERE id = ?"
  ).run(opts.asaasCustomerId, opts.asaasPaymentId ?? null, opts.asaasSubscriptionId ?? null, opts.plan ?? null, id);
}

export function getGuinchoByAsaasPaymentId(paymentId: string): any | undefined {
  return sqlite.prepare("SELECT * FROM guinchos WHERE asaas_payment_id = ?").get(paymentId) as any;
}

export type GuinchoDeletionCandidate =
  | {
    outcome: "ready";
    guincho: {
      id: string;
      tradingName: string;
      photoUrl: string | null;
      asaasPaymentId: string | null;
      asaasSubscriptionId: string | null;
    };
  }
  | { outcome: "not_found" }
  | { outcome: "billing_processing" };

export type DeleteGuinchoResult =
  | { outcome: "deleted"; guincho: { id: string; tradingName: string; photoUrl: string | null } }
  | { outcome: "not_found" }
  | { outcome: "billing_processing" };

/**
 * Returns a guincho that can be removed after the caller has cancelled any
 * open Asaas billing. An Asaas creation in progress remains a hard block,
 * because it could still create a charge after the local registration is gone.
 */
export function getGuinchoDeletionCandidate(id: string): GuinchoDeletionCandidate {
  const guincho = sqlite.prepare(`
    SELECT id, trading_name, photo_url, status, asaas_customer_id, asaas_payment_id, asaas_subscription_id
    FROM guinchos
    WHERE id = ?
  `).get(id) as {
    id: string;
    trading_name: string;
    photo_url: string | null;
    status: string;
    asaas_customer_id: string | null;
    asaas_payment_id: string | null;
    asaas_subscription_id: string | null;
  } | undefined;

  if (!guincho) return { outcome: "not_found" };

  const billingIsBeingCreated = Boolean(sqlite.prepare(`
    SELECT 1
    FROM asaas_creation_intents
    WHERE entity_type = 'guincho'
      AND entity_id = ?
      AND status NOT IN ('created', 'failed')
    LIMIT 1
  `).get(id));
  if (billingIsBeingCreated) return { outcome: "billing_processing" };

  return {
    outcome: "ready",
    guincho: {
      id: guincho.id,
      tradingName: guincho.trading_name,
      photoUrl: guincho.photo_url,
      asaasPaymentId: guincho.asaas_payment_id,
      asaasSubscriptionId: guincho.asaas_subscription_id,
    },
  };
}

/** Completes local deletion only after remote open billing was cancelled. */
export const deleteGuinchoAfterBillingCleanup = sqlite.transaction((id: string): DeleteGuinchoResult => {
  const candidate = getGuinchoDeletionCandidate(id);
  if (candidate.outcome !== "ready") return candidate;

  // Intent records are only idempotency history for this registration. Keeping
  // them after deletion would prevent a later registration from being cleanly
  // independent of this one.
  sqlite.prepare("DELETE FROM asaas_creation_intents WHERE entity_type = 'guincho' AND entity_id = ?").run(id);
  sqlite.prepare("DELETE FROM guinchos WHERE id = ?").run(id);
  return {
    outcome: "deleted",
    guincho: candidate.guincho,
  };
});

type SafeDeletionResult =
  | { outcome: "deleted"; name: string }
  | { outcome: "not_found" }
  | { outcome: "protected" }
  | { outcome: "blocked"; blockers: string[] };

const ACTIVE_ORDER_STATUSES = "'open','has_proposals','negotiating','shipped','delivered','awaiting_review'";

function hasDeletionRows(sqlText: string, ...params: unknown[]): boolean {
  return Boolean(sqlite.prepare(sqlText).get(...params));
}

/** Permanently removes a client only after all live commerce and finance flows are closed. */
export const deleteUserIfSafe = sqlite.transaction((id: string): SafeDeletionResult => {
  const user = sqlite.prepare("SELECT id, name, type FROM users WHERE id = ?").get(id) as { id: string; name: string; type: string } | undefined;
  if (!user) return { outcome: "not_found" };
  if (user.type !== "client") return { outcome: "protected" };

  const blockers: string[] = [];
  if (hasDeletionRows(`SELECT 1 FROM orders WHERE client_id = ? AND status IN (${ACTIVE_ORDER_STATUSES}) LIMIT 1`, id)) blockers.push("pedido em andamento");
  if (hasDeletionRows("SELECT 1 FROM negotiations WHERE client_id = ? AND status NOT IN ('completed','cancelled') LIMIT 1", id)) blockers.push("negociação em andamento");
  if (hasDeletionRows(`SELECT 1 FROM billing_transactions WHERE negotiation_id IN (SELECT id FROM negotiations WHERE client_id = ?) LIMIT 1`, id)) blockers.push("cobrança vinculada");
  if (hasDeletionRows("SELECT 1 FROM complaints WHERE (author_id = ? OR target_id = ?) AND status IN ('pending','reviewing') LIMIT 1", id, id)) blockers.push("reclamação em análise");
  if (blockers.length) return { outcome: "blocked", blockers };

  sqlite.prepare("DELETE FROM chat_messages WHERE room_id IN (SELECT id FROM chat_rooms WHERE client_id = ?)").run(id);
  sqlite.prepare("DELETE FROM chat_rooms WHERE client_id = ?").run(id);
  sqlite.prepare("DELETE FROM pre_proposal_messages WHERE room_id IN (SELECT id FROM pre_proposal_rooms WHERE client_id = ?)").run(id);
  sqlite.prepare("DELETE FROM pre_proposal_rooms WHERE client_id = ?").run(id);
  sqlite.prepare("DELETE FROM reviews WHERE client_id = ? OR negotiation_id IN (SELECT id FROM negotiations WHERE client_id = ?)").run(id, id);
  sqlite.prepare("DELETE FROM negotiations WHERE client_id = ?").run(id);
  sqlite.prepare("DELETE FROM proposals WHERE order_id IN (SELECT id FROM orders WHERE client_id = ?)").run(id);
  sqlite.prepare("DELETE FROM order_images WHERE order_id IN (SELECT id FROM orders WHERE client_id = ?)").run(id);
  sqlite.prepare("DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE client_id = ?)").run(id);
  sqlite.prepare("DELETE FROM orders WHERE client_id = ?").run(id);
  sqlite.prepare("DELETE FROM addresses WHERE user_id = ?").run(id);
  sqlite.prepare("DELETE FROM complaints WHERE (author_id = ? OR target_id = ?) AND status NOT IN ('pending','reviewing')").run(id, id);
  sqlite.prepare("DELETE FROM users WHERE id = ?").run(id);
  return { outcome: "deleted", name: user.name };
});

/** Permanently removes a desmanche only when it has no live marketplace or financial relationship. */
export const deleteDesmancheIfSafe = sqlite.transaction((id: string): SafeDeletionResult => {
  const desmanche = sqlite.prepare("SELECT id, trading_name, company_name FROM desmanches WHERE id = ?").get(id) as { id: string; trading_name: string; company_name: string } | undefined;
  if (!desmanche) return { outcome: "not_found" };

  const blockers: string[] = [];
  if (hasDeletionRows(`SELECT 1 FROM orders WHERE desmanche_id = ? AND status IN (${ACTIVE_ORDER_STATUSES}) LIMIT 1`, id)) blockers.push("pedido em andamento");
  if (hasDeletionRows("SELECT 1 FROM proposals WHERE desmanche_id = ? AND status IN ('sent','accepted') LIMIT 1", id)) blockers.push("proposta pendente");
  if (hasDeletionRows("SELECT 1 FROM negotiations WHERE desmanche_id = ? AND status NOT IN ('completed','cancelled') LIMIT 1", id)) blockers.push("negociação em andamento");
  if (hasDeletionRows("SELECT 1 FROM billing_transactions WHERE desmanche_id = ? LIMIT 1", id)) blockers.push("cobrança vinculada");
  if (hasDeletionRows("SELECT 1 FROM desmanche_billing WHERE desmanche_id = ? AND asaas_customer_id IS NOT NULL LIMIT 1", id)) blockers.push("cliente de cobrança vinculado");
  if (hasDeletionRows("SELECT 1 FROM asaas_creation_intents WHERE entity_type = 'desmanche' AND entity_id = ? AND status <> 'failed' LIMIT 1", id)) blockers.push("cobrança em processamento");
  if (hasDeletionRows("SELECT 1 FROM complaints WHERE (author_id = ? OR target_id = ?) AND status IN ('pending','reviewing') LIMIT 1", id, id)) blockers.push("reclamação em análise");
  if (blockers.length) return { outcome: "blocked", blockers };

  sqlite.prepare("DELETE FROM chat_messages WHERE room_id IN (SELECT id FROM chat_rooms WHERE desmanche_id = ?)").run(id);
  sqlite.prepare("DELETE FROM chat_rooms WHERE desmanche_id = ?").run(id);
  sqlite.prepare("DELETE FROM pre_proposal_messages WHERE room_id IN (SELECT id FROM pre_proposal_rooms WHERE desmanche_id = ?)").run(id);
  sqlite.prepare("DELETE FROM pre_proposal_rooms WHERE desmanche_id = ?").run(id);
  sqlite.prepare("DELETE FROM reviews WHERE desmanche_id = ? OR negotiation_id IN (SELECT id FROM negotiations WHERE desmanche_id = ?)").run(id, id);
  sqlite.prepare("DELETE FROM negotiations WHERE desmanche_id = ?").run(id);
  sqlite.prepare("DELETE FROM proposals WHERE desmanche_id = ?").run(id);
  sqlite.prepare("DELETE FROM documents WHERE desmanche_id = ?").run(id);
  sqlite.prepare("DELETE FROM desmanche_addresses WHERE desmanche_id = ?").run(id);
  sqlite.prepare("DELETE FROM desmanche_billing WHERE desmanche_id = ?").run(id);
  sqlite.prepare("DELETE FROM complaints WHERE (author_id = ? OR target_id = ?) AND status NOT IN ('pending','reviewing')").run(id, id);
  sqlite.prepare("DELETE FROM desmanches WHERE id = ?").run(id);
  return { outcome: "deleted", name: desmanche.trading_name || desmanche.company_name };
});

export async function updateGuinchoProfile(id: string, data: {
  name?: string; tradingName?: string; phone?: string; whatsapp?: string; description?: string;
  serviceRadius?: number; zipCode?: string; street?: string; number?: string; neighborhood?: string; city?: string; state?: string;
  photoUrl?: string;
}): Promise<any> {
  const g = getGuinchoById(id);
  if (!g) return null;

  const addressChanged = ["zipCode", "street", "number", "neighborhood", "city", "state"].some(
    (k) => (data as any)[k] !== undefined
  );
  let latitude = g.latitude;
  let longitude = g.longitude;
  if (addressChanged) {
    const coords = await geocodeAddress({
      street: data.street ?? g.street,
      number: data.number !== undefined ? data.number : g.number,
      neighborhood: data.neighborhood !== undefined ? data.neighborhood : g.neighborhood,
      city: data.city ?? g.city,
      state: data.state ?? g.state,
      zipCode: data.zipCode ?? g.zip_code,
    });
    if (coords) {
      latitude = coords.latitude;
      longitude = coords.longitude;
    }
  }

  sqlite.prepare(`
    UPDATE guinchos SET
      name = ?, trading_name = ?, phone = ?, whatsapp = ?, description = ?, service_radius = ?,
      zip_code = ?, street = ?, number = ?, neighborhood = ?, city = ?, state = ?, photo_url = ?,
      latitude = ?, longitude = ?
    WHERE id = ?
  `).run(
    data.name ?? g.name,
    data.tradingName ?? g.trading_name,
    data.phone ?? g.phone,
    data.whatsapp ?? g.whatsapp,
    data.description !== undefined ? data.description : g.description,
    data.serviceRadius ?? g.service_radius,
    data.zipCode ?? g.zip_code,
    data.street ?? g.street,
    data.number !== undefined ? data.number : g.number,
    data.neighborhood !== undefined ? data.neighborhood : g.neighborhood,
    data.city ?? g.city,
    data.state ?? g.state,
    data.photoUrl !== undefined ? data.photoUrl : g.photo_url,
    latitude,
    longitude,
    id
  );
  return getGuinchoById(id);
}
