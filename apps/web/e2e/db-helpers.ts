import Database from 'better-sqlite3';
import { E2E_DB_PATH } from './db-setup';

/**
 * Direct SQLite access from the test process — for fabricating states the UI
 * can't reach (expired invites, yesterday's canvases). Timestamps in the
 * database are unix SECONDS (drizzle sqlite `timestamp` mode).
 */
export function withDb<T>(fn: (db: Database.Database) => T): T {
	const db = new Database(E2E_DB_PATH.replace('file:', ''));
	try {
		return fn(db);
	} finally {
		db.close();
	}
}

export function nowSeconds(): number {
	return Math.floor(Date.now() / 1000);
}

/** Lift the waitlist rope for a user — most specs test life inside. */
export function acceptUser(email: string): void {
	withDb((db) => {
		db.prepare('UPDATE users SET accepted_at = ? WHERE email = ?').run(nowSeconds(), email);
	});
}
