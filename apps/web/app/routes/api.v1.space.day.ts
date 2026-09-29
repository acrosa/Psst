import { absoluteAssetUrl, api, jsonWithETag, nativeItems, requireApiUser } from '~/lib/api.server';
import { localDate } from '~/lib/dates';
import { getBoardItems, getCanvasByDate } from '~/lib/services/canvases.server';
import { getSpace, getSpaceMembers, requireMember } from '~/lib/services/spaces.server';
import type { Route } from './+types/api.v1.space.day';

/** A finished day, frozen as it was left. Today isn't archived — 404 here. */
export async function loader({ request, params }: Route.LoaderArgs) {
	return api(async () => {
		const user = await requireApiUser(request);
		const membership = await requireMember(params.spaceId, user.id);
		const space = await getSpace(params.spaceId);
		if (!space) throw new Response('Not found', { status: 404 });
		if (!/^\d{4}-\d{2}-\d{2}$/.test(params.date) || params.date === localDate(space.timezone)) {
			throw new Response('Not found', { status: 404 });
		}
		const canvas = await getCanvasByDate(space.id, params.date);
		if (!canvas) throw new Response('Not found', { status: 404 });

		const [members, items] = await Promise.all([
			getSpaceMembers(space.id),
			getBoardItems(canvas.id, absoluteAssetUrl),
		]);
		return jsonWithETag(request, {
			space: { id: space.id, name: space.name, emoji: space.emoji, timezone: space.timezone },
			role: membership.role,
			members,
			board: { date: canvas.date, frozen: true, items: nativeItems(items), shareToken: null },
		});
	});
}
