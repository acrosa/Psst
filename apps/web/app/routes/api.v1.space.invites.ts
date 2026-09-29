import { api, methodNotAllowed, readJson, requireApiUser } from '~/lib/api.server';
import { createInvite } from '~/lib/services/invites.server';
import type { Route } from './+types/api.v1.space.invites';

/** One more seat at the table: a link to share, or `{ email }` to send it. */
export async function action({ request, params }: Route.ActionArgs) {
	if (request.method !== 'POST') return methodNotAllowed();
	return api(async () => {
		const user = await requireApiUser(request);
		const body = await readJson(request).catch(() => ({}) as Record<string, unknown>);
		const email = typeof body.email === 'string' ? body.email.trim() : '';
		if (email && !email.includes('@')) {
			throw new Response('That email looks off — try again?', { status: 400 });
		}
		const { url } = await createInvite({
			spaceId: params.spaceId,
			userId: user.id,
			...(email ? { email } : {}),
		});
		return Response.json({ url, ...(email ? { emailedTo: email } : {}) }, { status: 201 });
	});
}
