import { env } from './env.server';

type TrackArgs = {
	event: string;
	icon?: string;
	description?: string;
	userId?: string;
	tags?: Record<string, string | number | boolean>;
};

/**
 * Product analytics via LogSnag. Fire-and-forget; a no-op unless
 * LOGSNAG_TOKEN is configured. Never throws.
 */
export function track({ event, icon, description, userId, tags }: TrackArgs): void {
	if (!env.LOGSNAG_TOKEN) return;

	void fetch('https://api.logsnag.com/v1/log', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${env.LOGSNAG_TOKEN}`,
		},
		body: JSON.stringify({
			project: env.LOGSNAG_PROJECT,
			channel: 'product',
			event,
			icon,
			description,
			user_id: userId,
			tags,
		}),
	}).catch((error) => {
		console.error('[metrics] track failed:', error);
	});
}
