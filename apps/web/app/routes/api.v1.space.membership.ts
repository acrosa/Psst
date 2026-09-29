import { api, methodNotAllowed, requireApiUser } from '~/lib/api.server';
import { leaveSpace, requireMember } from '~/lib/services/spaces.server';
import type { Route } from './+types/api.v1.space.membership';

/** Leave a space. Owners stay with what they started (for now). */
export async function action({ request, params }: Route.ActionArgs) {
	if (request.method !== 'DELETE') return methodNotAllowed();
	return api(async () => {
		const user = await requireApiUser(request);
		const membership = await requireMember(params.spaceId, user.id);
		if (membership.role === 'owner') {
			throw new Response("Owners can't leave their own space (yet).", { status: 409 });
		}
		await leaveSpace(params.spaceId, user.id);
		return { ok: true };
	});
}
