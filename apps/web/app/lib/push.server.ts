import { eq, inArray } from 'drizzle-orm';
import { db, schema } from './db/client.server';
import { env } from './env.server';

/**
 * APNs sender (token-based auth over HTTP/2 via apns2). Without the APNS_*
 * env vars this no-ops with a console line — the product works pushless.
 * Every push carries the psst sound.
 */

type PushMessage = {
	title: string;
	body: string;
	payload?: Record<string, unknown>;
};

const configured = Boolean(
	env.APNS_TEAM_ID && env.APNS_KEY_ID && env.APNS_PRIVATE_KEY && env.APNS_BUNDLE_ID,
);

let clientPromise: Promise<import('apns2').ApnsClient> | null = null;

async function getClient() {
	if (!clientPromise) {
		clientPromise = (async () => {
			const { ApnsClient } = await import('apns2');
			// Allow the key to arrive base64-encoded or with literal \n escapes.
			const raw = env.APNS_PRIVATE_KEY as string;
			const signingKey = raw.includes('BEGIN')
				? raw.replace(/\\n/g, '\n')
				: Buffer.from(raw, 'base64').toString('utf-8');
			return new ApnsClient({
				team: env.APNS_TEAM_ID as string,
				keyId: env.APNS_KEY_ID as string,
				signingKey,
				defaultTopic: env.APNS_BUNDLE_ID as string,
				host: env.APNS_ENV === 'production' ? 'api.push.apple.com' : 'api.sandbox.push.apple.com',
			});
		})();
	}
	return clientPromise;
}

/** Fan a message out to device tokens; prunes tokens Apple reports dead. */
export async function sendPush(tokens: string[], message: PushMessage): Promise<void> {
	if (tokens.length === 0) return;
	if (!configured) {
		console.log(`[push] (no APNs config) would notify ${tokens.length} device(s):`, message.title);
		return;
	}

	const { Notification } = await import('apns2');
	const client = await getClient();
	const dead: string[] = [];

	await Promise.all(
		tokens.map(async (token) => {
			try {
				await client.send(
					new Notification(token, {
						alert: { title: message.title, body: message.body },
						sound: 'psst.wav',
						data: message.payload,
					}),
				);
			} catch (error) {
				const reason = (error as { reason?: string })?.reason ?? '';
				if (reason === 'Unregistered' || reason === 'BadDeviceToken') {
					dead.push(token);
				} else {
					console.error('[push] send failed:', reason || error);
				}
			}
		}),
	);

	if (dead.length > 0) {
		await db.delete(schema.pushDevices).where(inArray(schema.pushDevices.token, dead));
	}
}

/** Every registered device for a set of users. */
export async function tokensForUsers(userIds: string[]): Promise<string[]> {
	if (userIds.length === 0) return [];
	const rows = await db
		.select({ token: schema.pushDevices.token })
		.from(schema.pushDevices)
		.where(inArray(schema.pushDevices.userId, userIds));
	return rows.map((row) => row.token);
}

/** Register (or refresh) a device token for a user. */
export async function registerDevice(userId: string, token: string): Promise<void> {
	const [existing] = await db
		.select()
		.from(schema.pushDevices)
		.where(eq(schema.pushDevices.token, token));
	if (existing) {
		await db
			.update(schema.pushDevices)
			.set({ userId, updatedAt: new Date() })
			.where(eq(schema.pushDevices.token, token));
		return;
	}
	await db.insert(schema.pushDevices).values({ userId, token });
}

export async function unregisterDevice(token: string): Promise<void> {
	await db.delete(schema.pushDevices).where(eq(schema.pushDevices.token, token));
}
