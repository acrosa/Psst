import { api, methodNotAllowed, requireApiUser } from '~/lib/api.server';
import { appUrl } from '~/lib/env.server';
import { getOrCreateTodayCanvas, shareCanvas, unshareCanvas } from '~/lib/services/canvases.server';
import { getSpace, requireMember } from '~/lib/services/spaces.server';
import type { Route } from './+types/api.v1.space.share';

/** Show today around: POST mints the public link, DELETE takes it back. */
export async function action({ request, params }: Route.ActionArgs) {
	if (request.method !== 'POST' && request.method !== 'DELETE') return methodNotAllowed();
	return api(async () => {
		const user = await requireApiUser(request);
		await requireMember(params.spaceId, user.id);
		const space = await getSpace(params.spaceId);
		if (!space) throw new Response('Not found', { status: 404 });
		const canvas = await getOrCreateTodayCanvas(space.id, space.timezone);

		if (request.method === 'DELETE') {
			await unshareCanvas(canvas.id);
			return { shared: false };
		}
		const token = await shareCanvas(canvas.id);
		return { shared: true, url: new URL(`/b/${token}`, appUrl).toString() };
	});
}
