import { absoluteAssetUrl, api, requireApiUser } from '~/lib/api.server';
import { localDate } from '~/lib/dates';
import { getTimelinePreviews, listCanvases } from '~/lib/services/canvases.server';
import { getSpace, requireMember } from '~/lib/services/spaces.server';
import type { Route } from './+types/api.v1.space.days';

const PAGE = 30;

/** The scrapbook: past days, newest first, each with a peek. `?before=` pages. */
export async function loader({ request, params }: Route.LoaderArgs) {
	return api(async () => {
		const user = await requireApiUser(request);
		await requireMember(params.spaceId, user.id);
		const space = await getSpace(params.spaceId);
		if (!space) throw new Response('Not found', { status: 404 });

		const before = new URL(request.url).searchParams.get('before') ?? localDate(space.timezone);
		const canvases = await listCanvases(space.id, { before, limit: PAGE });
		return {
			space: { id: space.id, name: space.name, emoji: space.emoji },
			days: await getTimelinePreviews(canvases, absoluteAssetUrl),
			nextBefore: canvases.length === PAGE ? canvases[canvases.length - 1].date : null,
		};
	});
}
