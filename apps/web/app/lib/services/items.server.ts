import { and, desc, eq, isNull, max } from 'drizzle-orm';
import { localDate } from '../dates';
import { db, schema } from '../db/client.server';
import { enqueue } from '../jobs.server';
import { track } from '../metrics.server';
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

/** Gentle auto-placement: near the last item, with a little scatter. */
async function nextPlacement(canvasId: string) {
	const [last] = await db
		.select({ x: schema.items.x, y: schema.items.y, z: schema.items.z })
		.from(schema.items)
		.where(and(eq(schema.items.canvasId, canvasId), isNull(schema.items.deletedAt)))
		.orderBy(desc(schema.items.createdAt))
		.limit(1);

	const scatter = () => Math.round((Math.random() - 0.5) * 120);
	const base = last ? { x: last.x + 60, y: last.y + 40 } : { x: 0, y: 0 };
	const [top] = await db
		.select({ z: max(schema.items.z) })
		.from(schema.items)
		.where(eq(schema.items.canvasId, canvasId));

	return {
		x: base.x + scatter(),
		y: base.y + scatter(),
		z: (top?.z ?? 0) + 1,
		rotation: Math.round((Math.random() * 6 - 3) * 10) / 10,
	};
}

export type CreateItemInput = {
	spaceId: string;
	userId: string;
	kind: 'link' | 'note' | 'emoji';
	content: string;
};

export async function createItem({ spaceId, userId, kind, content }: CreateItemInput) {
	await requireMember(spaceId, userId);
	const space = await getSpace(spaceId);
	if (!space) reject('Space not found.');

	const canvas = await getOrCreateTodayCanvas(spaceId, space.timezone);
	const placement = await nextPlacement(canvas.id);

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
