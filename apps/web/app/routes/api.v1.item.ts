import { api, methodNotAllowed, optionalNumber, readJson, requireApiUser } from '~/lib/api.server';
import { deleteItem, moveItem, resizeItem } from '~/lib/services/items.server';
import type { Route } from './+types/api.v1.item';

/**
 * Arrange the table: PATCH `{ x, y }` moves (anyone may), `{ scale }` lets a
 * card breathe (clamped). DELETE takes your own thing back off the board.
 */
export async function action({ request, params }: Route.ActionArgs) {
	return api(async () => {
		const user = await requireApiUser(request);

		if (request.method === 'DELETE') {
			await deleteItem({ itemId: params.itemId, userId: user.id });
			return { ok: true };
		}
		if (request.method !== 'PATCH') return methodNotAllowed();

		const body = await readJson(request);
		const x = optionalNumber(body.x);
		const y = optionalNumber(body.y);
		const scale = optionalNumber(body.scale);
		if (x === undefined && y === undefined && scale === undefined) {
			throw new Response('Nothing to change.', { status: 400 });
		}
		if (x !== undefined || y !== undefined) {
			if (x === undefined || y === undefined) {
				throw new Response('Bad position', { status: 400 });
			}
			await moveItem({ itemId: params.itemId, userId: user.id, x, y });
		}
		if (scale !== undefined) {
			await resizeItem({ itemId: params.itemId, userId: user.id, scale });
		}
		return { ok: true };
	});
}
