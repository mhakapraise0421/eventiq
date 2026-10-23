import "server-only";
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { SCHEMA_SQL } from "./schema";
import { seedDatabase } from "./seed";

export type SQLValue = null | number | bigint | string | Uint8Array;

type GlobalDb = typeof globalThis & { __eventiqDb?: DatabaseSync };
const globalDb = globalThis as GlobalDb;

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

  const row = database
    .prepare("SELECT COUNT(*) AS count FROM users")
    .get() as { count: number };
  if (!row || Number(row.count) === 0) {
    seedDatabase(database);
  }
  return database;
}

export function getDb(): DatabaseSync {
  if (!globalDb.__eventiqDb) {
    globalDb.__eventiqDb = createDatabase();
  }
  return globalDb.__eventiqDb;
}

export function all<T>(sql: string, ...params: SQLValue[]): T[] {
  return getDb().prepare(sql).all(...params) as T[];
}

export function get<T>(sql: string, ...params: SQLValue[]): T | undefined {
  return getDb().prepare(sql).get(...params) as T | undefined;
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
