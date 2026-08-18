/**
 * Background worker (optional). Processes pg-boss jobs when the web app runs
 * with JOBS_MODE=queue; without it, jobs run inline in the web process.
 *
 *   pnpm worker
 */
import 'dotenv/config';
import PgBoss from 'pg-boss';
import { handlers } from '../app/lib/jobs/registry';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
	console.error('[worker] DATABASE_URL is required (pg-boss runs on Postgres)');
	process.exit(1);
}

const boss = new PgBoss(databaseUrl);
boss.on('error', (error) => console.error('[worker] pg-boss error:', error));

await boss.start();

const types = Object.keys(handlers) as Array<keyof typeof handlers>;

for (const type of types) {
	await boss.createQueue(type);
	// Concrete dispatch over the registry's union type
	const handler = handlers[type] as (data: unknown) => Promise<void>;
	await boss.work(type, async (jobs) => {
		for (const job of jobs) {
			console.log(`[worker] ${type} ${job.id}`);
			await handler(job.data);
		}
	});
}

console.log(
	`[worker] started — listening for ${types.length} job type(s)${types.length ? `: ${types.join(', ')}` : ''}`,
);

async function shutdown() {
	console.log('[worker] shutting down…');
	await boss.stop();
	process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
