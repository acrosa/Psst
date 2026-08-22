import { redirect } from 'react-router';
import { requireUser } from '~/lib/auth.server';
import { safeNext } from '~/lib/redirects';
import { completeInviteIfPresent } from '~/lib/services/invites.server';
import type { Route } from './+types/auth.continue';

/**
 * Post-OAuth landing. Better Auth honors `callbackURL` after Google; we
 * bounce through here so an invite `next` is accepted before the user sees
 * the board. Email/password signup and login call the same helper directly.
 */
export async function loader({ request }: Route.LoaderArgs) {
	const user = await requireUser(request);
	const next = safeNext(new URL(request.url).searchParams.get('next'));
	throw redirect(await completeInviteIfPresent(next, user.id));
}
