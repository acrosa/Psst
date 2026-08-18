import { and, desc, eq, inArray, isNull } from 'drizzle-orm';
import { localDate } from '../dates';
import { db, schema } from '../db/client.server';

/**
 * Canvases are created lazily: touching a space today materializes the row for
 * (space, today-in-space-tz). A canvas whose date is in the past is archived —
 * frozen — purely by definition.
 */
export async function getOrCreateTodayCanvas(spaceId: string, timezone: string) {
	const today = localDate(timezone);
	const existing = await getCanvasByDate(spaceId, today);
	if (existing) return existing;

	try {
		const [canvas] = await db.insert(schema.canvases).values({ spaceId, date: today }).returning();
		return canvas;
	} catch {
		// Unique(space, date) race with a concurrent request — take theirs.
		const canvas = await getCanvasByDate(spaceId, today);
		if (!canvas) throw new Error('Failed to create today’s canvas');
		return canvas;
	}
}

export async function getCanvasByDate(spaceId: string, date: string) {
	const [canvas] = await db
		.select()
		.from(schema.canvases)
		.where(and(eq(schema.canvases.spaceId, spaceId), eq(schema.canvases.date, date)));
	return canvas ?? null;
}

export function isCanvasToday(canvas: { date: string }, timezone: string): boolean {
	return canvas.date === localDate(timezone);
}

// ----------------------------------------------------------------------------
// Board payload — everything a canvas page needs, shaped for the client.
// ----------------------------------------------------------------------------

export type BoardComment = {
	id: string;
	authorId: string;
	authorName: string | null;
	text: string;
	createdAt: string;
};

export type BoardReaction = { emoji: string; userId: string };

export type BoardUnfurl = {
	title: string | null;
	description: string | null;
	imageUrl: string | null;
	faviconUrl: string | null;
	siteName: string | null;
	status: 'pending' | 'ok' | 'failed';
};

export type BoardAsset = {
	kind: 'original' | 'thumb';
	url: string;
	width: number | null;
	height: number | null;
	blurhash: string | null;
};

export type BoardItem = {
	id: string;
	type: 'link' | 'note' | 'image' | 'emoji';
	url: string | null;
	text: string | null;
	x: number;
	y: number;
	z: number;
	rotation: number;
	authorId: string;
	authorName: string | null;
	createdAt: string;
	unfurl: BoardUnfurl | null;
	assets: BoardAsset[];
	comments: BoardComment[];
	reactions: BoardReaction[];
};

export async function getBoardItems(canvasId: string, assetUrl: (key: string) => string) {
	const rows = await db
		.select({
			item: schema.items,
			authorName: schema.users.name,
		})
		.from(schema.items)
		.innerJoin(schema.users, eq(schema.items.authorId, schema.users.id))
		.where(and(eq(schema.items.canvasId, canvasId), isNull(schema.items.deletedAt)))
		.orderBy(schema.items.z, schema.items.createdAt);

	if (rows.length === 0) return [] as BoardItem[];

	const itemIds = rows.map((r) => r.item.id);

	const [unfurls, comments, reactions, assets] = await Promise.all([
		db.select().from(schema.itemUnfurls).where(inArray(schema.itemUnfurls.itemId, itemIds)),
		db
			.select({
				id: schema.itemComments.id,
				itemId: schema.itemComments.itemId,
				authorId: schema.itemComments.authorId,
				authorName: schema.users.name,
				text: schema.itemComments.text,
				createdAt: schema.itemComments.createdAt,
			})
			.from(schema.itemComments)
			.innerJoin(schema.users, eq(schema.itemComments.authorId, schema.users.id))
			.where(inArray(schema.itemComments.itemId, itemIds))
			.orderBy(schema.itemComments.createdAt),
		db
			.select({
				itemId: schema.itemReactions.itemId,
				emoji: schema.itemReactions.emoji,
				userId: schema.itemReactions.userId,
			})
			.from(schema.itemReactions)
			.where(inArray(schema.itemReactions.itemId, itemIds)),
		db
			.select()
			.from(schema.itemAssets)
			.where(inArray(schema.itemAssets.itemId, itemIds))
			.orderBy(schema.itemAssets.createdAt),
	]);

	const unfurlByItem = new Map(unfurls.map((u) => [u.itemId, u]));

	return rows.map(({ item, authorName }): BoardItem => {
		const unfurl = unfurlByItem.get(item.id);
		return {
			id: item.id,
			type: item.type,
			url: item.url,
			text: item.text,
			x: item.x,
			y: item.y,
			z: item.z,
			rotation: item.rotation,
			authorId: item.authorId,
			authorName,
			createdAt: item.createdAt.toISOString(),
			unfurl: unfurl
				? {
						title: unfurl.title,
						description: unfurl.description,
						imageUrl: unfurl.imageUrl,
						faviconUrl: unfurl.faviconUrl,
						siteName: unfurl.siteName,
						status: unfurl.status,
					}
				: null,
			assets: assets
				.filter((a) => a.itemId === item.id)
				.map((a) => ({
					kind: a.kind,
					url: assetUrl(a.storageKey),
					width: a.width,
					height: a.height,
					blurhash: a.blurhash,
				})),
			comments: comments
				.filter((c) => c.itemId === item.id)
				.map((c) => ({
					id: c.id,
					authorId: c.authorId,
					authorName: c.authorName,
					text: c.text,
					createdAt: c.createdAt.toISOString(),
				})),
			reactions: reactions
				.filter((r) => r.itemId === item.id)
				.map((r) => ({ emoji: r.emoji, userId: r.userId })),
		};
	});
}

/** Archived days for the timeline, newest first (today excluded by caller). */
export async function listCanvases(
	spaceId: string,
	opts: { before?: string; limit?: number } = {},
) {
	const limit = Math.min(opts.limit ?? 30, 60);
	const before = opts.before;
	const rows = await db
		.select()
		.from(schema.canvases)
		.where(eq(schema.canvases.spaceId, spaceId))
		.orderBy(desc(schema.canvases.date))
		.limit(200);
	// date is a lexicographically sortable YYYY-MM-DD string
	const filtered = before ? rows.filter((c) => c.date < before) : rows;
	return filtered.slice(0, limit);
}

// ----------------------------------------------------------------------------
// Timeline previews — a peek at each archived day for the scrapbook list.
// ----------------------------------------------------------------------------

export type DayPeek =
	| { type: 'note'; text: string }
	| { type: 'emoji'; emoji: string }
	| { type: 'link' | 'image'; imageUrl: string | null };

export type TimelineDay = {
	date: string;
	count: number;
	peeks: DayPeek[];
};

export async function getTimelinePreviews(
	canvases: Array<{ id: string; date: string }>,
	assetUrl: (key: string) => string,
): Promise<TimelineDay[]> {
	if (canvases.length === 0) return [];

	const canvasIds = canvases.map((c) => c.id);
	const rows = await db
		.select()
		.from(schema.items)
		.where(and(inArray(schema.items.canvasId, canvasIds), isNull(schema.items.deletedAt)))
		.orderBy(desc(schema.items.z));

	const itemIds = rows.map((r) => r.id);
	const [unfurls, assets] =
		itemIds.length > 0
			? await Promise.all([
					db
						.select({ itemId: schema.itemUnfurls.itemId, imageUrl: schema.itemUnfurls.imageUrl })
						.from(schema.itemUnfurls)
						.where(inArray(schema.itemUnfurls.itemId, itemIds)),
					db
						.select({
							itemId: schema.itemAssets.itemId,
							kind: schema.itemAssets.kind,
							storageKey: schema.itemAssets.storageKey,
						})
						.from(schema.itemAssets)
						.where(inArray(schema.itemAssets.itemId, itemIds)),
				])
			: [[], []];

	const unfurlImage = new Map(unfurls.map((u) => [u.itemId, u.imageUrl]));
	const thumbByItem = new Map<string, string>();
	for (const asset of assets) {
		if (asset.kind === 'thumb' || !thumbByItem.has(asset.itemId)) {
			thumbByItem.set(asset.itemId, asset.storageKey);
		}
	}

	return canvases.map((canvas) => {
		const dayItems = rows.filter((item) => item.canvasId === canvas.id);
		return {
			date: canvas.date,
			count: dayItems.length,
			peeks: dayItems.slice(0, 6).map((item): DayPeek => {
				if (item.type === 'note') {
					return { type: 'note', text: (item.text ?? '').slice(0, 60) };
				}
				if (item.type === 'emoji') {
					return { type: 'emoji', emoji: item.text ?? '✨' };
				}
				if (item.type === 'image') {
					const key = thumbByItem.get(item.id);
					return { type: 'image', imageUrl: key ? assetUrl(key) : null };
				}
				return { type: 'link', imageUrl: unfurlImage.get(item.id) ?? null };
			}),
		};
	});
}
