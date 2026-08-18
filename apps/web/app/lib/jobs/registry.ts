import { imageProcess } from './handlers/image-process';
import { unfurlFetch } from './handlers/unfurl';

/**
 * Job registry: every background job is a plain async function keyed by type.
 * The same handlers run through pg-boss (JOBS_MODE=queue + `pnpm worker`) or
 * inline as a fire-and-forget fallback — keep them side-effect-complete and
 * idempotent. Register new jobs here and they are picked up by both paths.
 */

export type JobPayloads = {
	'unfurl.fetch': { itemId: string };
	'image.process': { itemId: string };
};

export type JobType = keyof JobPayloads;

export const handlers: { [T in JobType]: (data: JobPayloads[T]) => Promise<void> } = {
	'unfurl.fetch': unfurlFetch,
	'image.process': imageProcess,
};
