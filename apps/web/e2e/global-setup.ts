import { E2E_DB_PATH } from './db-setup';

/**
 * Environment for the Playwright *test* process (the web server gets its env
 * from playwright.config.ts webServer.env). Helpers that open the database
 * directly rely on DATABASE_URL here.
 */
export default async function globalSetup() {
	process.env.USE_SQLITE = 'true';
	process.env.DATABASE_URL = E2E_DB_PATH;
}
