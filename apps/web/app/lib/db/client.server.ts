import Database from 'better-sqlite3';
import { drizzle as drizzleSqlite } from 'drizzle-orm/better-sqlite3';
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { env } from '../env.server';
import * as pgSchema from './schema';
import * as sqliteSchema from './schema.sqlite';

const { Pool } = pg;

/** SQLite is used for E2E tests (USE_SQLITE=true); PostgreSQL everywhere else. */
export const useSqlite = env.USE_SQLITE === 'true';

export type Db = ReturnType<typeof drizzlePg<typeof pgSchema>>;

function createClient(): Db {
	if (useSqlite) {
		const dbPath = (env.DATABASE_URL ?? ':memory:').replace('file:', '');
		const sqlite = new Database(dbPath);
		sqlite.pragma('journal_mode = WAL');
		sqlite.pragma('foreign_keys = ON');
		// Typed as the Postgres client for a single query surface; the runtime
		// dialect difference is absorbed by using `schema` (below) in all queries.
		return drizzleSqlite(sqlite, { schema: sqliteSchema }) as unknown as Db;
	}

	if (!env.DATABASE_URL) {
		throw new Error('DATABASE_URL is not set (or set USE_SQLITE=true). See apps/web/.env.example');
	}

	return drizzlePg(new Pool({ connectionString: env.DATABASE_URL }), { schema: pgSchema });
}

export const db = createClient();

/**
 * Dialect-appropriate table objects. Always query through `schema.*` (never
 * import tables from ./schema directly in app code) so SQLite mode works.
 */
export const schema = (useSqlite ? sqliteSchema : pgSchema) as typeof pgSchema;
