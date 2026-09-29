import { api, methodNotAllowed, requireApiUser } from '~/lib/api.server';
import { acceptInvite } from '~/lib/services/invites.server';
import type { Route } from './+types/api.v1.invite.accept';

/**
 * Walk through an invite (a universal link, opened in the app). Waitlisted
 * people are welcome — an invite from inside is what lets them in. Sad
 * outcomes answer 410/409 with the status the app words warmly.
 */
export async function action({ request, params }: Route.ActionArgs) {
	if (request.method !== 'POST') return methodNotAllowed();
	return api(async () => {
		const user = await requireApiUser(request, { allowWaitlisted: true });
		const result = await acceptInvite({ token: params.token, userId: user.id });
		if (result.status === 'joined' || result.status === 'already-member') {
			return { status: result.status, spaceId: result.spaceId };
		}
		return Response.json(
			{ status: result.status, error: INVITE_TROUBLE[result.status] },
			{ status: result.status === 'full' ? 409 : 410 },
		);
	});
}

const INVITE_TROUBLE = {
	invalid: 'This invite wandered off — ask for a fresh one.',
	expired: 'This invite expired — invites last a week.',
	used: 'This invite was already used — each link seats one person.',
	full: 'This space is full — spaces stay small on purpose.',
} as const;
