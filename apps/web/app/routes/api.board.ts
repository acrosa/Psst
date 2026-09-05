import { requireUser } from '~/lib/auth.server';
import { appUrl } from '~/lib/env.server';
import { getBoardItems, getOrCreateTodayCanvas } from '~/lib/services/canvases.server';
import { ensureWeeklyLetter } from '~/lib/services/letters.server';
import { getSpace, listSpacesForUser, requireMember } from '~/lib/services/spaces.server';
import { publicUrl } from '~/lib/storage.server';
import type { Route } from './+types/api.board';

/**
 * Today's board as JSON — the surface the iOS app and widget read.
 * Asset URLs are absolute so out-of-origin clients can fetch them.
 */
export async function loader({ request }: Route.LoaderArgs) {
	const user = await requireUser(request);
	const url = new URL(request.url);

	let spaceId = url.searchParams.get('spaceId');
	if (spaceId) {
		await requireMember(spaceId, user.id);
	} else {
		const spaces = await listSpacesForUser(user.id);
		spaceId = spaces[0]?.id ?? null;
	}
	if (!spaceId) {
		return Response.json({ error: 'No space yet.' }, { status: 404 });
	}

	const space = await getSpace(spaceId);
	if (!space) {
		return Response.json({ error: 'No space yet.' }, { status: 404 });
	}

	const canvas = await getOrCreateTodayCanvas(space.id, space.timezone);
	void ensureWeeklyLetter(space).catch((error) => console.error('[letters]', error));
	const items = await getBoardItems(canvas.id, (key) => new URL(publicUrl(key), appUrl).toString());

	return {
		space: { id: space.id, name: space.name, emoji: space.emoji },
		date: canvas.date,
		items,
	};
}
