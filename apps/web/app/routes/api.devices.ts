import { requireUser } from '~/lib/auth.server';
import { registerDevice, unregisterDevice } from '~/lib/push.server';
import type { Route } from './+types/api.devices';

/** iOS device registration for push. POST {token} to register, {token, remove:true} to forget. */
export async function action({ request }: Route.ActionArgs) {
	const user = await requireUser(request);
	const body = (await request.json().catch(() => null)) as {
		token?: unknown;
		remove?: unknown;
	} | null;

	const token = typeof body?.token === 'string' ? body.token.trim() : '';
	if (!token || token.length > 200) {
		return Response.json({ error: 'A device token, please.' }, { status: 400 });
	}

	if (body?.remove === true) {
		await unregisterDevice(token);
		return { ok: true, removed: true };
	}

	await registerDevice(user.id, token);
	return { ok: true };
}
