import { and, count, eq, isNull, max } from 'drizzle-orm';
import { localDate } from '../dates';
import { db, schema } from '../db/client.server';
import { clampScale } from '../design';
import { enqueue } from '../jobs.server';
import { track } from '../metrics.server';
import { putObject } from '../storage.server';
import { getOrCreateTodayCanvas } from './canvases.server';
import { getSpace, requireMember } from './spaces.server';

const MAX_NOTE_LENGTH = 1000;
const MAX_COMMENT_LENGTH = 280;

/** Throw a friendly 400 with a message the UI can show. */
function reject(message: string): never {
	throw new Response(message, { status: 400 });
}

function parseHttpUrl(raw: string): URL {
	let url: URL;
	try {
		url = new URL(raw.trim());
	} catch {
		reject('That link doesn’t look like a URL.');
	}
	if (url.protocol !== 'http:' && url.protocol !== 'https:') {
		reject('Only http(s) links can land on the board.');
	}
	return url;
}

export type DropPosition = { x: number; y: number };

/** Validate a pencil drawing payload: one color, a bounded M/L path, a size. */
function parseDrawingContent(raw: string) {
	let parsed: { color?: unknown; d?: unknown; w?: unknown; h?: unknown };
	try {
		parsed = JSON.parse(raw);
	} catch {
		reject('That drawing didn’t survive the trip.');
	}
	const { color, d, w, h } = parsed;
	if (typeof color !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(color)) {
		reject('Pick a pencil color.');
	}
	if (typeof d !== 'string' || d.length === 0 || d.length > 20_000 || !/^[ML0-9,. -]+$/.test(d)) {
		reject('That drawing didn’t survive the trip.');
	}
	if (
		typeof w !== 'number' ||
		typeof h !== 'number' ||
		!Number.isFinite(w) ||
		!Number.isFinite(h) ||
		w < 8 ||
		h < 8 ||
		w > 2000 ||
		h > 2000
	) {
		reject('Drawings stay on the table — a bit smaller.');
	}
	return { color, d, w: Math.round(w), h: Math.round(h) };
}

/**
 * Gentle auto-placement: items flow into a loose collage (4 to a row, with a
 * little jitter and rotation) so nothing ever buries what came before.
 * Members rearrange from there — that's the point. A drag-drop or paste can
 * pin the position instead (`at`), keeping the rotation charm.
 */
async function nextPlacement(canvasId: string, at?: DropPosition) {
	const [top] = await db
		.select({ z: max(schema.items.z) })
		.from(schema.items)
		.where(eq(schema.items.canvasId, canvasId));
	const z = (top?.z ?? 0) + 1;
	const rotation = Math.round((Math.random() * 6 - 3) * 10) / 10;

	if (at && Number.isFinite(at.x) && Number.isFinite(at.y)) {
		return { x: at.x, y: at.y, z, rotation };
	}

	const [counted] = await db
		.select({ value: count() })
		.from(schema.items)
		.where(and(eq(schema.items.canvasId, canvasId), isNull(schema.items.deletedAt)))
		.limit(1);
	const index = counted?.value ?? 0;

	const column = index % 4;
	const row = Math.floor(index / 4);
	const jitter = () => Math.round((Math.random() - 0.5) * 60);

	return {
		x: column * 370 + jitter(),
		y: row * 350 + jitter(),
		z,
		rotation,
	};
}

export type CreateItemInput = {
	spaceId: string;
	userId: string;
	kind: 'link' | 'note' | 'emoji' | 'drawing';
	content: string;
	/** Optional pinned position (drag-drop / paste); omitted → collage flow. */
	position?: DropPosition;
};

export async function createItem({ spaceId, userId, kind, content, position }: CreateItemInput) {
	await requireMember(spaceId, userId);
	const space = await getSpace(spaceId);
	if (!space) reject('Space not found.');

	const canvas = await getOrCreateTodayCanvas(spaceId, space.timezone);
	const placement = await nextPlacement(canvas.id, position);

	let values: typeof schema.items.$inferInsert;

	if (kind === 'link') {
		const url = parseHttpUrl(content);
		values = {
			canvasId: canvas.id,
			spaceId,
			authorId: userId,
			type: 'link',
			url: url.toString(),
			...placement,
		};
	} else if (kind === 'emoji') {
		const emoji = content.trim();
		if (!emoji || [...emoji].length > 4) reject('Pick a single emoji for a sticker.');
		values = {
			canvasId: canvas.id,
			spaceId,
			authorId: userId,
			type: 'emoji',
			text: emoji,
			...placement,
		};
	} else if (kind === 'drawing') {
		values = {
			canvasId: canvas.id,
			spaceId,
			authorId: userId,
			type: 'drawing',
			text: JSON.stringify(parseDrawingContent(content)),
			...placement,
		};
	} else {
		const text = content.trim();
		if (!text) reject('Write something first.');
		if (text.length > MAX_NOTE_LENGTH) reject('Notes stay small — under 1000 characters.');
		values = {
			canvasId: canvas.id,
			spaceId,
			authorId: userId,
			type: 'note',
			text,
			...placement,
		};
	}

	const [item] = await db.insert(schema.items).values(values).returning();

	if (item.type === 'link') {
		await db.insert(schema.itemUnfurls).values({ itemId: item.id, status: 'pending' });
		await enqueue('unfurl.fetch', { itemId: item.id });
	}

	track({ event: 'item_posted', icon: '📮', userId, tags: { type: item.type } });
	return item;
}

/**
 * Load an item and authorize the user as a member of its space; verifies the
 * item still lives on TODAY's canvas unless `allowArchived`.
 */
export async function getMutableItem(itemId: string, userId: string, allowArchived = false) {
	const [row] = await db
		.select({ item: schema.items, canvas: schema.canvases, space: schema.spaces })
		.from(schema.items)
		.innerJoin(schema.canvases, eq(schema.items.canvasId, schema.canvases.id))
		.innerJoin(schema.spaces, eq(schema.items.spaceId, schema.spaces.id))
		.where(eq(schema.items.id, itemId));

	if (!row || row.item.deletedAt) {
		throw new Response('Not found', { status: 404 });
	}
	await requireMember(row.space.id, userId);

	if (!allowArchived && row.canvas.date !== localDate(row.space.timezone)) {
		throw new Response('This day is archived — it can’t be changed anymore.', { status: 409 });
	}
	return row;
}

/** Anyone in the space can move anything — arranging together is the point. */
export async function moveItem(args: { itemId: string; userId: string; x: number; y: number }) {
	const { item, canvas } = await getMutableItem(args.itemId, args.userId);

	if (!Number.isFinite(args.x) || !Number.isFinite(args.y)) {
		throw new Response('Bad position', { status: 400 });
	}

	const [top] = await db
		.select({ z: max(schema.items.z) })
		.from(schema.items)
		.where(eq(schema.items.canvasId, canvas.id));

	await db
		.update(schema.items)
		.set({ x: args.x, y: args.y, z: (top?.z ?? 0) + 1 })
		.where(eq(schema.items.id, item.id));

	track({ event: 'item_moved', icon: '🫳', userId: args.userId, tags: { type: item.type } });
}

/** Anyone in the space can let a card breathe — clamped so nothing takes over. */
export async function resizeItem(args: { itemId: string; userId: string; scale: number }) {
	const { item } = await getMutableItem(args.itemId, args.userId);

	if (!Number.isFinite(args.scale)) {
		throw new Response('Bad scale', { status: 400 });
	}

	await db
		.update(schema.items)
		.set({ scale: clampScale(args.scale) })
		.where(eq(schema.items.id, item.id));

	track({ event: 'item_resized', icon: '🔍', userId: args.userId, tags: { type: item.type } });
}

/** Authors take their own things back off the board. */
export async function deleteItem(args: { itemId: string; userId: string }) {
	const { item } = await getMutableItem(args.itemId, args.userId);
	if (item.authorId !== args.userId) {
		throw new Response('Only the author can remove this.', { status: 403 });
	}
	await db.update(schema.items).set({ deletedAt: new Date() }).where(eq(schema.items.id, item.id));
}

export async function addComment(args: { itemId: string; userId: string; text: string }) {
	const text = args.text.trim();
	if (!text) reject('Write something first.');
	if (text.length > MAX_COMMENT_LENGTH) {
		reject('Keep it small — 280 characters. It’s a caption, not a letter.');
	}

	const { item } = await getMutableItem(args.itemId, args.userId);
	if (item.type === 'emoji') reject('Stickers stay silent — no backs to write on.');
	const [comment] = await db
		.insert(schema.itemComments)
		.values({ itemId: item.id, authorId: args.userId, text })
		.returning();

	track({ event: 'comment_added', icon: '✏️', userId: args.userId });
	return comment;
}

export async function toggleReaction(args: { itemId: string; userId: string; emoji: string }) {
	const emoji = args.emoji.trim();
	if (!emoji || [...emoji].length > 4) reject('That’s not an emoji.');

	const { item } = await getMutableItem(args.itemId, args.userId);
	if (item.type === 'emoji') reject('Stickers stay silent — no reactions.');

	const [existing] = await db
		.select()
		.from(schema.itemReactions)
		.where(
			and(
				eq(schema.itemReactions.itemId, item.id),
				eq(schema.itemReactions.userId, args.userId),
				eq(schema.itemReactions.emoji, emoji),
			),
		);

	if (existing) {
		await db.delete(schema.itemReactions).where(eq(schema.itemReactions.id, existing.id));
		return { reacted: false };
	}

	await db.insert(schema.itemReactions).values({ itemId: item.id, userId: args.userId, emoji });
	track({ event: 'reaction_added', icon: emoji, userId: args.userId });
	return { reacted: true };
}

// ----------------------------------------------------------------------------
// Image items
// ----------------------------------------------------------------------------

const IMAGE_EXT_BY_MIME: Record<string, string> = {
	'image/png': 'png',
	'image/jpeg': 'jpg',
	'image/webp': 'webp',
	'image/gif': 'gif',
	'image/avif': 'avif',
};

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

const AUDIO_EXT_BY_MIME: Record<string, string> = {
	'audio/webm': 'webm',
	'audio/mp4': 'm4a',
	'audio/mpeg': 'mp3',
	'audio/ogg': 'ogg',
	'audio/wav': 'wav',
};

const MAX_AUDIO_BYTES = 5 * 1024 * 1024;
const MAX_AUDIO_SECONDS = 61;

/** Validate the client-computed waveform meta: a duration and 0..1 peaks. */
function parseAudioMeta(raw: string) {
	let parsed: { duration?: unknown; peaks?: unknown };
	try {
		parsed = JSON.parse(raw);
	} catch {
		reject('That voice note didn’t survive the trip.');
	}
	const duration = Number(parsed.duration);
	if (!Number.isFinite(duration) || duration <= 0 || duration > MAX_AUDIO_SECONDS) {
		reject('Voice notes stay short — under a minute.');
	}
	const peaks = Array.isArray(parsed.peaks)
		? parsed.peaks
				.slice(0, 96)
				.map((p) => Math.min(1, Math.max(0, Math.round(Number(p) * 100) / 100 || 0)))
		: [];
	return { duration: Math.round(duration * 10) / 10, peaks };
}

export async function createAudioItem(args: {
	spaceId: string;
	userId: string;
	file: File;
	meta: string;
	position?: DropPosition;
}) {
	await requireMember(args.spaceId, args.userId);
	const space = await getSpace(args.spaceId);
	if (!space) reject('Space not found.');

	const ext = AUDIO_EXT_BY_MIME[args.file.type.split(';')[0]];
	if (!ext) reject('That doesn’t sound like audio.');
	if (args.file.size === 0) reject('That recording looks empty.');
	if (args.file.size > MAX_AUDIO_BYTES) reject('Voice notes stay small — under 5MB.');
	const meta = parseAudioMeta(args.meta);

	const canvas = await getOrCreateTodayCanvas(args.spaceId, space.timezone);
	const placement = await nextPlacement(canvas.id, args.position);

	const [item] = await db
		.insert(schema.items)
		.values({
			canvasId: canvas.id,
			spaceId: args.spaceId,
			authorId: args.userId,
			type: 'audio',
			text: JSON.stringify(meta),
			...placement,
		})
		.returning();

	const key = `items/${item.id}/voice.${ext}`;
	await putObject(key, Buffer.from(await args.file.arrayBuffer()), args.file.type);
	await db.insert(schema.itemAssets).values({ itemId: item.id, kind: 'original', storageKey: key });

	track({ event: 'item_posted', icon: '🎙️', userId: args.userId, tags: { type: 'audio' } });
	return item;
}

export async function createImageItem(args: {
	spaceId: string;
	userId: string;
	file: File;
	position?: DropPosition;
}) {
	await requireMember(args.spaceId, args.userId);
	const space = await getSpace(args.spaceId);
	if (!space) reject('Space not found.');

	const ext = IMAGE_EXT_BY_MIME[args.file.type];
	if (!ext) reject('Photos only — png, jpg, webp, gif or avif.');
	if (args.file.size > MAX_IMAGE_BYTES) reject('Keep photos under 10MB.');
	if (args.file.size === 0) reject('That file looks empty.');

	const canvas = await getOrCreateTodayCanvas(args.spaceId, space.timezone);
	const placement = await nextPlacement(canvas.id, args.position);

	const [item] = await db
		.insert(schema.items)
		.values({
			canvasId: canvas.id,
			spaceId: args.spaceId,
			authorId: args.userId,
			type: 'image',
			...placement,
		})
		.returning();

	const key = `items/${item.id}/original.${ext}`;
	await putObject(key, Buffer.from(await args.file.arrayBuffer()), args.file.type);
	await db.insert(schema.itemAssets).values({ itemId: item.id, kind: 'original', storageKey: key });

	await enqueue('image.process', { itemId: item.id });
	track({ event: 'item_posted', icon: '🖼️', userId: args.userId, tags: { type: 'image' } });
	return item;
}
