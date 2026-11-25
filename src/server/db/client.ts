import { sql } from 'drizzle-orm';
import { drizzle as drizzleMysql, type MySql2Database } from 'drizzle-orm/mysql2';
import { drizzle as drizzlePg, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import mysql from 'mysql2/promise';
import postgres from 'postgres';
import { mysqlSchema } from './schema/mysql';
import { pgSchema } from './schema/pg';
import type { DbDialect } from './types';

export type PgDb = PostgresJsDatabase<typeof pgSchema>;
export type MySqlDb = MySql2Database<typeof mysqlSchema>;

export type TenantTxContext =
  | {
      dialect: 'postgres';
      tenantId: string;
      tx: Parameters<Parameters<PgDb['transaction']>[0]>[0];
    }
  | {
      dialect: 'mysql';
      tenantId: string;
      tx: Parameters<Parameters<MySqlDb['transaction']>[0]>[0];
    };

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

let pgClient: ReturnType<typeof postgres> | null = null;
let pgDbInstance: PgDb | null = null;
let mysqlPool: mysql.Pool | null = null;
let mysqlDbInstance: MySqlDb | null = null;

export function getDbDialect(): DbDialect {
  const raw = (process.env.DB_DIALECT ?? 'postgres').toLowerCase().trim();
  if (raw === 'mysql') return 'mysql';
  return 'postgres';
}

function requireDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL environment variable is required');
  }
  return url;
}

export function getPgDb(): PgDb {
  if (!pgDbInstance) {
    const url = requireDatabaseUrl();
    // prepare: false is required for Supabase PgBouncer transaction poolers
    pgClient = postgres(url, {
      prepare: false,
      max: Number(process.env.DB_POOL_MAX ?? 10),
    });
    pgDbInstance = drizzlePg(pgClient, { schema: pgSchema });
  }
  return pgDbInstance;
}

export function getMySqlDb(): MySqlDb {
  if (!mysqlDbInstance) {
    const url = requireDatabaseUrl();
    mysqlPool = mysql.createPool({
      uri: url,
      connectionLimit: Number(process.env.DB_POOL_MAX ?? 10),
    });
    mysqlDbInstance = drizzleMysql(mysqlPool, {
      schema: mysqlSchema,
      mode: 'default',
    });
  }
  return mysqlDbInstance;
}

export function getDb():
  | { dialect: 'postgres'; db: PgDb }
  | { dialect: 'mysql'; db: MySqlDb } {
  const dialect = getDbDialect();
  if (dialect === 'mysql') {
    return { dialect: 'mysql', db: getMySqlDb() };
  }
  return { dialect: 'postgres', db: getPgDb() };
}

/**
 * Executes a callback inside a database transaction scoped to a single tenant.
 * On PostgreSQL, sets `app.tenant_id` locally via `set_config(..., true)` so
 * RESTRICTIVE Row-Level Security policies enforce tenant isolation even on
 * pooled connections. Repositories also filter explicitly by `tenantId` for
 * MySQL parity.
 */
export async function withTenantTx<T>(
  tenantId: string,
  fn: (ctx: TenantTxContext) => Promise<T>,
): Promise<T> {
  if (!UUID_RE.test(tenantId)) {
    throw new Error(`Invalid tenantId UUID passed to withTenantTx: ${tenantId}`);
  }

  const dialect = getDbDialect();
  if (dialect === 'mysql') {
    const db = getMySqlDb();
    return db.transaction(async (tx) => fn({ dialect: 'mysql', tenantId, tx }));
  }

  const db = getPgDb();
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`SELECT set_config('app.tenant_id', ${tenantId}, true)`,
    );
    return fn({ dialect: 'postgres', tenantId, tx });
  });
}

export async function closeDb(): Promise<void> {
  if (pgClient) {
    await pgClient.end({ timeout: 5 });
    pgClient = null;
    pgDbInstance = null;
  }
  if (mysqlPool) {
    await mysqlPool.end();
    mysqlPool = null;
    mysqlDbInstance = null;
  }
}
