import { api, methodNotAllowed, readJson, requireApiUser } from '~/lib/api.server';
import { addComment } from '~/lib/services/items.server';
import type { Route } from './+types/api.v1.item.comments';

/** Write on the back of a card — 280 characters, a caption, not a thread. */
export async function action({ request, params }: Route.ActionArgs) {
	if (request.method !== 'POST') return methodNotAllowed();
	return api(async () => {
		const user = await requireApiUser(request);
		const body = await readJson(request);
		const comment = await addComment({
			itemId: params.itemId,
			userId: user.id,
			text: typeof body.text === 'string' ? body.text : '',
		});
		return Response.json(
			{
				comment: {
					id: comment.id,
					text: comment.text,
					createdAt: comment.createdAt.toISOString(),
				},
			},
			{ status: 201 },
		);
	});
}
