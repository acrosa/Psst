import {
	api,
	methodNotAllowed,
	optionalPosition,
	readJson,
	requireApiUser,
} from '~/lib/api.server';
import { createAudioItem, createImageItem, createItem } from '~/lib/services/items.server';
import type { Route } from './+types/api.v1.space.items';

const JSON_KINDS = ['link', 'note', 'emoji', 'drawing'] as const;

/**
 * Drop something on today's board. JSON for words, links, stickers and
 * drawings (`{ kind, content, x?, y? }`); multipart for a photo or a voice
 * note (`kind=image|audio`, `file`, audio's `content` meta, `x`, `y`).
 * No position → the gentle collage auto-placement.
 */
export async function action({ request, params }: Route.ActionArgs) {
	if (request.method !== 'POST') return methodNotAllowed();
	return api(async () => {
		const user = await requireApiUser(request);
		const contentType = request.headers.get('content-type') ?? '';

		if (contentType.includes('multipart/form-data')) {
			const form = await request.formData();
			const kind = form.get('kind');
			const file = form.get('file');
			const position = optionalPosition(form.get('x'), form.get('y'));
			if (!(file instanceof File) || file.size === 0) {
				throw new Response(kind === 'audio' ? 'Record something first.' : 'Pick a photo first.', {
					status: 400,
				});
			}
			if (kind === 'image') {
				const item = await createImageItem({
					spaceId: params.spaceId,
					userId: user.id,
					file,
					position,
				});
				return Response.json({ item: { id: item.id } }, { status: 201 });
			}
			if (kind === 'audio') {
				const item = await createAudioItem({
					spaceId: params.spaceId,
					userId: user.id,
					file,
					meta: String(form.get('content') ?? ''),
					position,
				});
				return Response.json({ item: { id: item.id } }, { status: 201 });
			}
			throw new Response('Unknown item kind.', { status: 400 });
		}

		const body = await readJson(request);
		const kind = JSON_KINDS.find((known) => known === body.kind);
		if (!kind) throw new Response('Unknown item kind.', { status: 400 });
		const item = await createItem({
			spaceId: params.spaceId,
			userId: user.id,
			kind,
			content: typeof body.content === 'string' ? body.content : '',
			position: optionalPosition(body.x, body.y),
		});
		return Response.json({ item: { id: item.id } }, { status: 201 });
	});
}
