import { eq } from 'drizzle-orm';
import { requireUser } from '~/lib/auth.server';
import { db, schema } from '~/lib/db/client.server';
import { publicUrl, putObject } from '~/lib/storage.server';
import type { Route } from './+types/api.avatar';

const EXT_BY_MIME: Record<string, string> = {
	'image/png': 'png',
	'image/jpeg': 'jpg',
	'image/webp': 'webp',
	'image/gif': 'gif',
	'image/avif': 'avif',
};

const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

/** Upload a profile photo; the stored URL is versioned so caches let go. */
export async function action({ request }: Route.ActionArgs) {
	const user = await requireUser(request);
	const formData = await request.formData();
	const file = formData.get('file');

	if (!(file instanceof File) || file.size === 0) {
		return Response.json({ error: 'Pick a photo first.' }, { status: 400 });
	}
	const ext = EXT_BY_MIME[file.type];
	if (!ext) {
		return Response.json({ error: 'Photos only — png, jpg, webp, gif or avif.' }, { status: 400 });
	}
	if (file.size > MAX_AVATAR_BYTES) {
		return Response.json({ error: 'Keep it under 5MB.' }, { status: 400 });
	}

	const key = `avatars/${user.id}.${ext}`;
	await putObject(key, Buffer.from(await file.arrayBuffer()), file.type);
	const image = `${publicUrl(key)}?v=${Date.now()}`;
	await db.update(schema.users).set({ image }).where(eq(schema.users.id, user.id));

	return { ok: true, image };
}
