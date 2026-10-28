import "server-only";
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { SCHEMA_SQL } from "./schema";
import { seedDatabase } from "./seed";
import { hashPassword } from "./password";

export type SQLValue = null | number | bigint | string | Uint8Array;

type GlobalDb = typeof globalThis & { __eventiqDb?: DatabaseSync };
const globalDb = globalThis as GlobalDb;

function ensureColumn(
  database: DatabaseSync,
  table: string,
  column: string,
  definition: string,
) {
  const columns = database.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  if (!columns.some((entry) => entry.name === column)) {
    database.exec(`ALTER TABLE ${table} ADD COLUMN ${definition}`);
  }
}

function demoSeedingEnabled() {
  const flag = (process.env.SEED_DEMO_DATA || "").trim().toLowerCase();
  if (flag) return flag === "1" || flag === "true" || flag === "yes";
  return process.env.NODE_ENV !== "production";
}

/**
 * Creates the first administrator on an empty production database from
 * ADMIN_EMAIL / ADMIN_PASSWORD, so a real deployment never needs the demo
 * accounts (whose credentials are public) just to get started.
 */
function bootstrapAdmin(database: DatabaseSync) {
  const email = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || "";
  if (!email || !password) return false;
  if (password.length < 12) {
    console.warn("[eventiq] ADMIN_PASSWORD must be at least 12 characters; skipping admin setup.");
    return false;
  }
  database
    .prepare(
      `INSERT INTO users (id, email, password_hash, name, phone, city, role, status, notify_email, notify_sms, notify_whatsapp, created_at)
       VALUES (?, ?, ?, ?, NULL, NULL, 'admin', 'active', 1, 0, 0, ?)`,
    )
    .run(
      `usr_admin_${randomBytes(6).toString("hex")}`,
      email,
      hashPassword(password),
      (process.env.ADMIN_NAME || "EventIQ Admin").trim(),
      new Date().toISOString(),
    );
  console.warn(`[eventiq] Created the first administrator account for ${email}.`);
  return true;
}

function createDatabase() {
  const dbPath =
    process.env.DATABASE_PATH ||
    path.join(process.cwd(), ".data", "eventiq.db");
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const database = new DatabaseSync(dbPath);
  database.exec("PRAGMA busy_timeout = 5000;");
  database.exec(SCHEMA_SQL);

  // Forward-compatible additions for databases created by earlier builds.
  const userColumns = database
    .prepare("PRAGMA table_info(users)")
    .all() as { name: string }[];
  const names = new Set(userColumns.map((c) => c.name));
  if (!names.has("notify_email")) {
    database.exec("ALTER TABLE users ADD COLUMN notify_email INTEGER NOT NULL DEFAULT 1");
  }
  if (!names.has("notify_sms")) {
    database.exec("ALTER TABLE users ADD COLUMN notify_sms INTEGER NOT NULL DEFAULT 0");
  }
  if (!names.has("notify_whatsapp")) {
    database.exec("ALTER TABLE users ADD COLUMN notify_whatsapp INTEGER NOT NULL DEFAULT 0");
  }

  const deviceColumns: Array<[string, string]> = [
    ["gate_id", "gate_id TEXT REFERENCES gates(id)"],
    ["api_key_hash", "api_key_hash TEXT"],
    ["api_key_prefix", "api_key_prefix TEXT"],
    ["paired_at", "paired_at TEXT"],
    ["last_seen_at", "last_seen_at TEXT"],
    ["last_seen_ip", "last_seen_ip TEXT"],
    ["firmware", "firmware TEXT"],
    ["mode", "mode TEXT NOT NULL DEFAULT 'online'"],
  ];
  for (const [column, definition] of deviceColumns) {
    ensureColumn(database, "devices", column, definition);
  }

  const scanColumns: Array<[string, string]> = [
    ["client_scan_id", "client_scan_id TEXT"],
    ["source", "source TEXT NOT NULL DEFAULT 'browser'"],
    ["gate_id", "gate_id TEXT REFERENCES gates(id)"],
    ["mode", "mode TEXT NOT NULL DEFAULT 'online'"],
  ];
  for (const [column, definition] of scanColumns) {
    ensureColumn(database, "scan_events", column, definition);
  }

  database.exec(
    "CREATE INDEX IF NOT EXISTS idx_devices_gate ON devices(gate_id);" +
      "CREATE INDEX IF NOT EXISTS idx_scan_events_gate ON scan_events(gate_id, created_at);" +
      "CREATE UNIQUE INDEX IF NOT EXISTS idx_scan_events_device_client ON scan_events(device_id, client_scan_id) WHERE client_scan_id IS NOT NULL;" +
      "CREATE INDEX IF NOT EXISTS idx_device_pairings_device ON device_pairings(device_id, expires_at);",
  );

  const row = database
    .prepare("SELECT COUNT(*) AS count FROM users")
    .get() as { count: number };
  if (!row || Number(row.count) === 0) {
    if (demoSeedingEnabled()) {
      seedDatabase(database);
    } else if (!bootstrapAdmin(database)) {
      console.warn(
        "[eventiq] The database is empty and demo seeding is disabled. " +
          "Set ADMIN_EMAIL and ADMIN_PASSWORD (12+ characters) to create the first administrator.",
      );
    }
  }
  return database;
}

export function getDb(): DatabaseSync {
  if (!globalDb.__eventiqDb) {
    globalDb.__eventiqDb = createDatabase();
  }
  return globalDb.__eventiqDb;
}

// node:sqlite returns rows with a null prototype, which React cannot
// serialize when passed from Server Components to Client Components.
// Spreading each row produces normal plain objects.
export function all<T>(sql: string, ...params: SQLValue[]): T[] {
  return (getDb().prepare(sql).all(...params) as T[]).map((row) => ({ ...row }));
}

export function get<T>(sql: string, ...params: SQLValue[]): T | undefined {
  const row = getDb().prepare(sql).get(...params) as T | undefined;
  return row ? { ...row } : row;
}

export function run(sql: string, ...params: SQLValue[]) {
  return getDb().prepare(sql).run(...params);
}

export function transaction<T>(fn: (db: DatabaseSync) => T): T {
  const db = getDb();
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = fn(db);
    db.exec("COMMIT");
    return result;
  } catch (error) {
    try {
      db.exec("ROLLBACK");
    } catch {
      // ignore rollback failure
    }
    throw error;
  }
}

export function exec(sql: string) {
  getDb().exec(sql);
}
