import 'dotenv/config';
import { z } from 'zod';

/**
 * All environment variables, validated at startup.
 * Only BETTER_AUTH_SECRET and a database (DATABASE_URL or USE_SQLITE=true) are
 * needed in practice — everything else no-ops gracefully when unset.
 */
const schema = z.object({
	NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
	APP_URL: z.string().url().optional(),

	// Database
	DATABASE_URL: z.string().optional(),
	USE_SQLITE: z.enum(['true', 'false']).default('false'),

	// Auth
	BETTER_AUTH_SECRET: z.string().min(32).optional(),
	BETTER_AUTH_URL: z.string().url().default('http://localhost:3000'),
	GOOGLE_CLIENT_ID: z.string().optional(),
	GOOGLE_CLIENT_SECRET: z.string().optional(),

	// Jobs: inline (default, no worker needed) or queue (pg-boss + `pnpm worker`)
	JOBS_MODE: z.enum(['inline', 'queue']).default('inline'),

	// Email (invites): console unless Resend is configured
	RESEND_API_KEY: z.string().optional(),
	EMAIL_FROM: z.string().default('psst <hello@psst.local>'),

	// Storage: local disk unless S3 is configured (R2 / MinIO / any S3-compatible)
	S3_ENDPOINT: z.string().optional(),
	S3_REGION: z.string().default('auto'),
	S3_BUCKET: z.string().optional(),
	S3_ACCESS_KEY_ID: z.string().optional(),
	S3_SECRET_ACCESS_KEY: z.string().optional(),
	S3_PUBLIC_URL: z.string().optional(),

	// Analytics (LogSnag)
	LOGSNAG_TOKEN: z.string().optional(),
	LOGSNAG_PROJECT: z.string().default('psst'),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
	console.error('❌ Invalid environment configuration:', parsed.error.flatten().fieldErrors);
	throw new Error('Invalid environment configuration');
}

export const env = parsed.data;

/** Public origin of the app, used in invite links and emails. */
export const appUrl = env.APP_URL ?? env.BETTER_AUTH_URL;
