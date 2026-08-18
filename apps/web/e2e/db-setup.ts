import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.resolve(__dirname, '..');

/** Absolute path of the E2E SQLite database (also set as DATABASE_URL). */
export const E2E_DB_PATH = `file:${path.join(__dirname, 'e2e-test.db')}`;

/** Read every generated SQLite migration, in order. */
function readMigrationSql(): string {
	const migrationDir = path.join(appDir, 'drizzle', 'sqlite');
	const files = fs
		.readdirSync(migrationDir)
		.filter((f) => f.endsWith('.sql'))
		.sort();

	if (files.length === 0) {
		throw new Error('No SQLite migrations found. Run: pnpm db:generate:sqlite');
	}

	// Concatenate ALL migrations in order so the E2E schema never goes stale
	// when a second migration lands.
	return files
		.map((file) => fs.readFileSync(path.join(migrationDir, file), 'utf-8'))
		.join('\n--> statement-breakpoint\n');
}

function parseStatements(sql: string): string[] {
	return sql
		.split('--> statement-breakpoint')
		.map((s) => s.trim())
		.filter((s) => s.length > 0);
}

export async function setupE2EDatabase(): Promise<void> {
	const Database = await import('better-sqlite3').then((m) => m.default);
	const dbPath = E2E_DB_PATH.replace('file:', '');
	const db = new Database(dbPath);

	for (const statement of parseStatements(readMigrationSql())) {
		try {
			db.exec(statement);
		} catch (error) {
			console.error('Failed to execute statement:', statement.slice(0, 120));
			throw error;
		}
	}

	const tables = db
		.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
		.all() as Array<{ name: string }>;
	console.log(`✅ E2E database ready (${tables.length} tables)`);

	db.close();
}

export async function teardownE2EDatabase(): Promise<void> {
	const dbFile = E2E_DB_PATH.replace('file:', '');
	for (const file of [dbFile, `${dbFile}-shm`, `${dbFile}-wal`]) {
		if (fs.existsSync(file)) {
			fs.unlinkSync(file);
		}
	}
}
