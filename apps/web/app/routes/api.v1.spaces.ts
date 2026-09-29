import { api, methodNotAllowed, readJson, requireApiUser } from '~/lib/api.server';
import { createSpace, listSpacesForUser } from '~/lib/services/spaces.server';
import type { Route } from './+types/api.v1.spaces';

/** The spaces you're in, with who's there and how full today is. */
export async function loader({ request }: Route.LoaderArgs) {
	return api(async () => {
		const user = await requireApiUser(request);
		return { spaces: await listSpacesForUser(user.id) };
	});
}

/** A new space — the first canvas, or one more corner. */
export async function action({ request }: Route.ActionArgs) {
	if (request.method !== 'POST') return methodNotAllowed();
	return api(async () => {
		const user = await requireApiUser(request);
		const body = await readJson(request);
		const name = typeof body.name === 'string' ? body.name.trim() : '';
		if (!name) {
			throw new Response('Give your canvas a name — anything cozy works.', { status: 400 });
		}
		if (name.length > 60) {
			throw new Response('Keep names under 60 characters.', { status: 400 });
		}
		const emoji = typeof body.emoji === 'string' && body.emoji.trim() ? body.emoji.trim() : '🌷';
		const timezone = typeof body.timezone === 'string' && body.timezone ? body.timezone : 'UTC';
		const space = await createSpace({ userId: user.id, name, emoji, timezone });
		return Response.json(
			{ space: { id: space.id, name: space.name, emoji: space.emoji, timezone: space.timezone } },
			{ status: 201 },
		);
	});
}
