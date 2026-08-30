import { spawnSync } from 'node:child_process';

// Vercel builds run this before the app build. Migrations need the session
// pooler (DDL over the transaction pooler is unreliable), so they run only
// when DATABASE_URL_MIGRATIONS is set — otherwise deploys assume the schema
// is already current (the manual `pnpm db:migrate` flow).
const url = process.env.DATABASE_URL_MIGRATIONS;
if (!url) {
	console.log('[migrate] DATABASE_URL_MIGRATIONS not set — skipping migrations.');
	process.exit(0);
}

console.log('[migrate] applying pending migrations…');
const result = spawnSync('pnpm', ['exec', 'drizzle-kit', 'migrate'], {
	stdio: 'inherit',
	env: { ...process.env, DATABASE_URL: url },
});
process.exit(result.status ?? 1);
