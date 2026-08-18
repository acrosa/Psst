/**
 * Job registry: every background job is a plain async function keyed by type.
 * The same handlers run through pg-boss (JOBS_MODE=queue + `pnpm worker`) or
 * inline as a fire-and-forget fallback — keep them side-effect-complete and
 * idempotent. Register new jobs here and they are picked up by both paths.
 */

// biome-ignore lint/complexity/noBannedTypes: filled in as job types are added
export type JobPayloads = {};

export type JobType = keyof JobPayloads;

export const handlers: { [T in JobType]: (data: JobPayloads[T]) => Promise<void> } = {};
