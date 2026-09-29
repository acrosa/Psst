import { api, methodNotAllowed, readJson, requireApiUser } from '~/lib/api.server';
import { listPendingInvites } from '~/lib/services/invites.server';
import {
	getSpace,
	getSpaceMembers,
	requireMember,
	updateSpace,
} from '~/lib/services/spaces.server';
import type { Route } from './+types/api.v1.space';

/** A space's settings page, as data: who's in, who's invited, your role. */
export async function loader({ request, params }: Route.LoaderArgs) {
	return api(async () => {
		const user = await requireApiUser(request);
		const membership = await requireMember(params.spaceId, user.id);
		const space = await getSpace(params.spaceId);
		if (!space) throw new Response('Not found', { status: 404 });
		const [members, invites] = await Promise.all([
			getSpaceMembers(space.id),
			listPendingInvites(space.id),
		]);
		return {
			role: membership.role,
			space: { id: space.id, name: space.name, emoji: space.emoji, timezone: space.timezone },
			members,
			invites: invites.map((invite) => ({
				id: invite.id,
				email: invite.email,
				createdAt: invite.createdAt.toISOString(),
			})),
		};
	});
}

/** Rename the space or change its mood — the owner's one small setting. */
export async function action({ request, params }: Route.ActionArgs) {
	if (request.method !== 'PATCH') return methodNotAllowed();
	return api(async () => {
		const user = await requireApiUser(request);
		const membership = await requireMember(params.spaceId, user.id);
		if (membership.role !== 'owner') {
			throw new Response('Only the owner can rename the space.', { status: 403 });
		}
		const body = await readJson(request);
		const name = typeof body.name === 'string' ? body.name.trim() : undefined;
		const emoji = typeof body.emoji === 'string' ? body.emoji.trim() : undefined;
		if (name !== undefined && !name) throw new Response('A space needs a name.', { status: 400 });
		if (name && name.length > 60) {
			throw new Response('Keep names under 60 characters.', { status: 400 });
		}
		const space = await updateSpace(params.spaceId, {
			...(name ? { name } : {}),
			...(emoji ? { emoji } : {}),
		});
		return { space: { id: space.id, name: space.name, emoji: space.emoji } };
	});
}
