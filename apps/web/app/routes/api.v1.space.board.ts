import { absoluteAssetUrl, api, jsonWithETag, nativeItems, requireApiUser } from '~/lib/api.server';
import { env } from '~/lib/env.server';
import { getBoardItems, getOrCreateTodayCanvas } from '~/lib/services/canvases.server';
import { ensureWeeklyLetter } from '~/lib/services/letters.server';
import { ensureMember, getSpace, getSpaceMembers } from '~/lib/services/spaces.server';
import type { Route } from './+types/api.v1.space.board';

/**
 * Today's board — everything the native board draws, the same payload the
 * web canvas loads. ETagged: a poll that finds nothing new gets a bare 304.
 */
export async function loader({ request, params }: Route.LoaderArgs) {
	return api(async () => {
		const user = await requireApiUser(request);
		// A shared canvas link is an open door, here as on the web.
		const membership = await ensureMember(params.spaceId, user.id);
		const space = await getSpace(params.spaceId);
		if (!space) throw new Response('Not found', { status: 404 });

		const [members, canvas] = await Promise.all([
			getSpaceMembers(space.id),
			getOrCreateTodayCanvas(space.id, space.timezone),
		]);
		const items = await getBoardItems(canvas.id, absoluteAssetUrl);
		// A new week's first open books last week's letter; nothing waits for it.
		void ensureWeeklyLetter(space).catch((error) => console.error('[letters]', error));

		return jsonWithETag(request, {
			space: { id: space.id, name: space.name, emoji: space.emoji, timezone: space.timezone },
			role: membership.role,
			members,
			board: {
				date: canvas.date,
				frozen: false,
				items: nativeItems(items),
				shareToken: canvas.shareToken ?? null,
			},
			pollMs: env.NODE_ENV === 'test' ? 2000 : 10_000,
		});
	});
}
