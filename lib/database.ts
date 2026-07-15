import { Pool } from "pg";

let pool: Pool | undefined;
let ready: Promise<void> | undefined;

function databaseUrl() { return process.env.DATABASE_URL?.trim(); }

export function hasDatabase() { return Boolean(databaseUrl()); }

export async function databaseStatus() {
  const db = await database();
  if (!db) return { configured: false, connected: false };
  await db.query("SELECT 1");
  return { configured: true, connected: true };
}

async function database() {
  const connectionString = databaseUrl();
  if (!connectionString) return undefined;
  // Alibaba RDS accepts the normal PostgreSQL connection without TLS. Enable
  // TLS explicitly when a deployment requires it, rather than making a
  // certificate mode the default for every environment.
  pool ||= new Pool({ connectionString, ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : false, max: 5 });
  ready ||= pool.query(`CREATE TABLE IF NOT EXISTS locksmith_records (kind text NOT NULL, record_key text NOT NULL, value jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (kind, record_key))`).then(() => undefined);
  await ready;
  return pool;
}

export async function readRecord<T>(kind: string, recordKey: string, fallback: T): Promise<T> {
  const db = await database();
  if (!db) return fallback;
  const result = await db.query<{ value: T }>("SELECT value FROM locksmith_records WHERE kind = $1 AND record_key = $2", [kind, recordKey]);
  return result.rows[0]?.value ?? fallback;
}

export async function writeRecord(kind: string, recordKey: string, value: unknown) {
  const db = await database();
  if (!db) return;
  await db.query("INSERT INTO locksmith_records (kind, record_key, value) VALUES ($1, $2, $3) ON CONFLICT (kind, record_key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()", [kind, recordKey, value]);
}
