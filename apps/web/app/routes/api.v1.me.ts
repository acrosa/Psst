import { api, requireApiUser } from '~/lib/api.server';
import { isLetIn } from '~/lib/auth.server';
import { env } from '~/lib/env.server';
import { listSpacesForUser } from '~/lib/services/spaces.server';
import type { Route } from './+types/api.v1.me';

/**
 * Who's here, where they can go, and how the iOS app should show the board.
 * Answers for waitlisted people too — the app shows them the waiting room.
 */
export async function loader({ request }: Route.LoaderArgs) {
	return api(async () => {
		const user = await requireApiUser(request, { allowWaitlisted: true });
		const waitlisted = !(await isLetIn(user));
		return {
			user: { id: user.id, name: user.name ?? null, email: user.email, image: user.image ?? null },
			waitlisted,
			spaces: waitlisted ? [] : await listSpacesForUser(user.id),
			flags: { nativeBoard: env.IOS_NATIVE_BOARD },
		};
	});
}
