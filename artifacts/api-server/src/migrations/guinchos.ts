import type Database from "better-sqlite3";

export const guinchoColumns = [
  "id", "name", "trading_name", "document_type", "cnpj", "cpf", "antt",
  "email", "phone", "whatsapp", "password", "description", "zip_code",
  "street", "number", "neighborhood", "city", "state", "service_radius",
  "photo_url", "latitude", "longitude", "status", "rejection_reason",
  "asaas_customer_id", "asaas_payment_id", "asaas_subscription_id", "plan",
  "created_at",
] as const;

const guinchosNewDefinition = `
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
`;

const guinchoColumnList = guinchoColumns.join(", ");

/**
 * Removes the legacy NOT NULL constraint from cnpj without risking a partial
 * table swap. better-sqlite3 transactions are synchronous, which is required
 * for SQLite to roll back both DDL and the copied rows together.
 */
export type LegacyGuinchosRebuildOptions = {
  beforeCopy?: (sqlite: Database.Database) => void;
};

export function rebuildLegacyGuinchos(
  sqlite: Database.Database,
  options: LegacyGuinchosRebuildOptions = {},
): boolean {
  const cnpjColumn = (sqlite.prepare("PRAGMA table_info(guinchos)").all() as Array<{
    name: string;
    notnull: number;
  }>).find((column) => column.name === "cnpj");

  if (!cnpjColumn || cnpjColumn.notnull !== 1) {
    return false;
  }

  sqlite.transaction(() => {
    // A previous interrupted pre-transaction migration may have left this
    // table behind. It is never a source of truth: guinchos is copied first.
    sqlite.exec("DROP TABLE IF EXISTS guinchos_new");
    sqlite.exec(`CREATE TABLE guinchos_new (${guinchosNewDefinition})`);
    options.beforeCopy?.(sqlite);
    sqlite.prepare(`
      INSERT INTO guinchos_new (${guinchoColumnList})
      SELECT ${guinchoColumnList}
      FROM guinchos
    `).run();

    const originalCount = (sqlite.prepare("SELECT COUNT(*) AS count FROM guinchos").get() as { count: number }).count;
    const copiedCount = (sqlite.prepare("SELECT COUNT(*) AS count FROM guinchos_new").get() as { count: number }).count;
    if (copiedCount !== originalCount) {
      throw new Error("guinchos migration copy verification failed");
    }

    // The original stays intact until the copy and its verification succeed.
    sqlite.exec("DROP TABLE guinchos");
    sqlite.exec("ALTER TABLE guinchos_new RENAME TO guinchos");
  })();

  return true;
}

export function assertGuinchoColumns(sqlite: Database.Database): void {
  const currentColumns = sqlite.prepare("PRAGMA table_info(guinchos)").all() as Array<{ name: string }>;
  const missingColumns = guinchoColumns.filter(
    (column) => !currentColumns.some((currentColumn) => currentColumn.name === column),
  );
  if (missingColumns.length > 0) {
    throw new Error(`guinchos migration incomplete; missing columns: ${missingColumns.join(", ")}`);
  }
}

export function migrateGuinchos(sqlite: Database.Database): void {
  rebuildLegacyGuinchos(sqlite);
  assertGuinchoColumns(sqlite);
  sqlite.exec(`
    CREATE INDEX IF NOT EXISTS idx_guinchos_asaas_payment_id
      ON guinchos(asaas_payment_id);
  `);
}
