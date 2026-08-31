import { requireUser } from '~/lib/auth.server';
import { listSpacesForUser } from '~/lib/services/spaces.server';
import type { Route } from './+types/api.spaces';

/** The user's spaces, lean — feeds native pickers (share extension). */
export async function loader({ request }: Route.LoaderArgs) {
	const user = await requireUser(request);
	const spaces = await listSpacesForUser(user.id);
	return Response.json({
		spaces: spaces.map((space) => ({ id: space.id, name: space.name, emoji: space.emoji })),
	});
}
