import { defineConfig } from 'drizzle-kit';

// SQLite dialect is used by the E2E suite (USE_SQLITE=true). Migrations are
// generated into drizzle/sqlite and executed by e2e/db-setup.ts.
export default defineConfig({
	schema: './app/lib/db/schema.sqlite.ts',
	out: './drizzle/sqlite',
	dialect: 'sqlite',
	dbCredentials: {
		url: 'file:./e2e/e2e-test.db',
	},
});
