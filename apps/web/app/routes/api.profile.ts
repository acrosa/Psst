import { eq } from 'drizzle-orm';
import { requireUser } from '~/lib/auth.server';
import { db, schema } from '~/lib/db/client.server';
import { publicUrl, putObject } from '~/lib/storage.server';
import type { Route } from './+types/api.profile';

const EXT_BY_MIME: Record<string, string> = {
	'image/png': 'png',
	'image/jpeg': 'jpg',
	'image/webp': 'webp',
	'image/gif': 'gif',
	'image/avif': 'avif',
};

const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

/** The signed-in user's editable profile bits. */
export async function loader({ request }: Route.LoaderArgs) {
	const user = await requireUser(request);
	const [row] = await db
		.select({ emailMentions: schema.users.emailMentions })
		.from(schema.users)
		.where(eq(schema.users.id, user.id));
	return { emailMentions: row?.emailMentions ?? true };
}

/** Update name, photo, and/or the mention-email preference. */
export async function action({ request }: Route.ActionArgs) {
	const user = await requireUser(request);
	const formData = await request.formData();

	const updates: { name?: string; image?: string; emailMentions?: boolean } = {};

	const emailMentions = formData.get('emailMentions');
	if (emailMentions === 'true' || emailMentions === 'false') {
		updates.emailMentions = emailMentions === 'true';
	}

	const name = formData.get('name');
	if (typeof name === 'string') {
		const trimmed = name.trim();
		if (!trimmed) return Response.json({ error: 'A name, even a tiny one.' }, { status: 400 });
		if (trimmed.length > 60) {
			return Response.json({ error: 'Keep names under 60 characters.' }, { status: 400 });
		}
		updates.name = trimmed;
	}

	const file = formData.get('file');
	if (file instanceof File && file.size > 0) {
		const ext = EXT_BY_MIME[file.type];
		if (!ext) {
			return Response.json(
				{ error: 'Photos only — png, jpg, webp, gif or avif.' },
				{ status: 400 },
			);
		}
		if (file.size > MAX_AVATAR_BYTES) {
			return Response.json({ error: 'Keep it under 5MB.' }, { status: 400 });
		}
		const key = `avatars/${user.id}.${ext}`;
		await putObject(key, Buffer.from(await file.arrayBuffer()), file.type);
		updates.image = `${publicUrl(key)}?v=${Date.now()}`;
	}

	if (Object.keys(updates).length > 0) {
		await db.update(schema.users).set(updates).where(eq(schema.users.id, user.id));
	}

	return { ok: true, ...updates };
}
