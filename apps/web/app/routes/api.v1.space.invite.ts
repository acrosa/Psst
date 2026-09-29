import { api, methodNotAllowed, requireApiUser } from '~/lib/api.server';
import { revokeInvite } from '~/lib/services/invites.server';
import { requireMember } from '~/lib/services/spaces.server';
import type { Route } from './+types/api.v1.space.invite';

/** Take back an invite that hasn't been used — the link stops working. */
export async function action({ request, params }: Route.ActionArgs) {
	if (request.method !== 'DELETE') return methodNotAllowed();
	return api(async () => {
		const user = await requireApiUser(request);
		await requireMember(params.spaceId, user.id);
		await revokeInvite(params.inviteId, params.spaceId);
		return { ok: true };
	});
}
