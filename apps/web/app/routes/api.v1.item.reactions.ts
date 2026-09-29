import { api, methodNotAllowed, readJson, requireApiUser } from '~/lib/api.server';
import { toggleReaction } from '~/lib/services/items.server';
import type { Route } from './+types/api.v1.item.reactions';

/** Toggle a reaction (a double-tap like is `{ emoji: '🫶' }`). */
export async function action({ request, params }: Route.ActionArgs) {
	if (request.method !== 'POST') return methodNotAllowed();
	return api(async () => {
		const user = await requireApiUser(request);
		const body = await readJson(request);
		return toggleReaction({
			itemId: params.itemId,
			userId: user.id,
			emoji: typeof body.emoji === 'string' ? body.emoji : '',
		});
	});
}
