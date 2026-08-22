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

export function inviteTokenFromUrl(inviteUrl: string): string {
	const token = inviteUrl.split('/invite/')[1]?.split(/[?#]/)[0];
	if (!token) throw new Error(`No invite token in ${inviteUrl}`);
	return token;
}

export function inviteAcceptedAt(token: string): number | null {
	return withDb((db) => {
		const row = db.prepare('SELECT accepted_at FROM invites WHERE token = ?').get(token) as
			| { accepted_at: number | null }
			| undefined;
		return row?.accepted_at ?? null;
	});
}
