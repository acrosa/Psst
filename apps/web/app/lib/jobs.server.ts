import PgBoss from 'pg-boss';
import { env } from './env.server';
import { type JobPayloads, type JobType, handlers } from './jobs/registry';

/**
 * Queue a background job. With JOBS_MODE=queue (and Postgres) jobs go through
 * pg-boss and are processed by `pnpm worker`; otherwise the handler runs
 * inline, fire-and-forget, so the product works without any worker process
 * (local dev, tests, serverless).
 */
const useQueue =
	env.JOBS_MODE === 'queue' && Boolean(env.DATABASE_URL) && env.USE_SQLITE !== 'true';

let bossPromise: Promise<PgBoss> | null = null;
const ensuredQueues = new Set<string>();

async function getBoss(): Promise<PgBoss> {
	if (!bossPromise) {
		bossPromise = (async () => {
			const boss = new PgBoss(env.DATABASE_URL as string);
			boss.on('error', (error) => console.error('[jobs] pg-boss error:', error));
			await boss.start();
			return boss;
		})();
	}
	return bossPromise;
}

export async function enqueue<T extends JobType>(type: T, data: JobPayloads[T]): Promise<void> {
	if (useQueue) {
		try {
			const boss = await getBoss();
			if (!ensuredQueues.has(type)) {
				await boss.createQueue(type);
				ensuredQueues.add(type);
			}
			await boss.send(type, data);
			return;
		} catch (error) {
			console.error(`[jobs] enqueue ${type} failed; falling back to inline:`, error);
		}
	}

	// Inline: never block the caller on job work.
	void Promise.resolve()
		.then(() => handlers[type](data))
		.catch((error) => console.error(`[jobs] inline ${type} failed:`, error));
}
