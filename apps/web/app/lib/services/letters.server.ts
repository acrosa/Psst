import { and, eq, gte, inArray, isNull, lte, ne } from 'drizzle-orm';
import { addDays, localDate, weekStart } from '../dates';
import { db, schema } from '../db/client.server';
import type { Letter } from '../db/schema';
import type { LetterData } from '../letter';

export type { LetterData };

/**
 * The Sunday letter. Once a week psst reads a space's board and writes the
 * group a short letter in its own hand. The trigger is lazy, like the daily
 * canvas: the first open of a new week books a `letters` row for the week
 * before and queues the writing; nothing waits, the board's polling shows
 * the letter arrive. The letter itself is an ordinary item authored by the
 * system user, so it drags, flips, archives and mails like anything else.
 */

export const SYSTEM_USER = { id: 'psst', email: 'letters@psst.you', name: 'psst' } as const;

const MAX_ATTEMPTS = 3;
const MIN_ITEMS = 3;

/** The account psst signs with. Created on first need, never signs in. */
export async function ensureSystemUser(): Promise<void> {
	const [existing] = await db
		.select({ id: schema.users.id })
		.from(schema.users)
		.where(eq(schema.users.id, SYSTEM_USER.id));
	if (existing) return;
	try {
		await db.insert(schema.users).values({
			...SYSTEM_USER,
			emailVerified: true,
			emailMentions: false,
			acceptedAt: new Date(),
		});
	} catch {
		// Two writers raced for the same row — theirs is as good as ours.
	}
}

/** The Monday–Sunday just gone, in the space's timezone. */
export function previousWeek(timezone: string): { weekStart: string; weekEnd: string } {
	const start = addDays(weekStart(localDate(timezone)), -7);
	return { weekStart: start, weekEnd: addDays(start, 6) };
}

// Weeks already written or waived, so the polled loader costs nothing after
// the first look.
const settled = new Map<string, string>();

/**
 * Book last week's letter for a space if it isn't booked yet and queue the
 * writing. Cheap enough to call on every loader hit.
 */
export async function ensureWeeklyLetter(space: {
	id: string;
	timezone: string;
	createdAt: Date | null;
}): Promise<void> {
	const { weekStart: start, weekEnd } = previousWeek(space.timezone);
	if (settled.get(space.id) === start) return;
	// A space that didn't exist that week has nothing to be told about it.
	if (space.createdAt && localDate(space.timezone, space.createdAt) > weekEnd) return;

	const [row] = await db
		.select()
		.from(schema.letters)
		.where(and(eq(schema.letters.spaceId, space.id), eq(schema.letters.weekStart, start)));

	if (row?.status === 'written' || row?.status === 'silent') {
		settled.set(space.id, start);
		return;
	}
	if (row?.status === 'pending') return; // in flight
	if (row?.status === 'failed') {
		if (row.attempts >= MAX_ATTEMPTS) {
			settled.set(space.id, start);
			return;
		}
		const retried = await db
			.update(schema.letters)
			.set({ status: 'pending', updatedAt: new Date() })
			.where(and(eq(schema.letters.id, row.id), eq(schema.letters.status, 'failed')))
			.returning({ id: schema.letters.id });
		if (retried.length === 0) return; // someone else took it
		await queueWrite(space.id, start);
		return;
	}

	try {
		await db.insert(schema.letters).values({ spaceId: space.id, weekStart: start });
	} catch {
		return; // unique(space, week) race — the other request queued it
	}
	await queueWrite(space.id, start);
}

async function queueWrite(spaceId: string, start: string) {
	// Imported late: the jobs registry imports the handler, which imports us.
	const { enqueue } = await import('../jobs.server');
	await enqueue('letter.write', { spaceId, weekStart: start });
}

export async function getLetter(spaceId: string, start: string) {
	const [row] = await db
		.select()
		.from(schema.letters)
		.where(and(eq(schema.letters.spaceId, spaceId), eq(schema.letters.weekStart, start)));
	return row ?? null;
}

export async function markLetter(
	id: string,
	patch: Partial<Pick<Letter, 'status' | 'attempts' | 'itemId'>>,
): Promise<void> {
	await db
		.update(schema.letters)
		.set({ ...patch, updatedAt: new Date() })
		.where(eq(schema.letters.id, id));
}

// ----------------------------------------------------------------------------
// The week, read back — what the writer gets to see.
// ----------------------------------------------------------------------------

export type DigestItem = {
	author: string;
	type: string;
	title?: string;
	description?: string;
	site?: string;
	text?: string;
	comments: Array<{ author: string; text: string }>;
	reactions: Record<string, number>;
};

export type WeekDigest = {
	weekStart: string;
	weekEnd: string;
	days: Array<{ date: string; items: DigestItem[] }>;
	itemCount: number;
	memberNames: string[];
};

function firstName(name: string | null): string {
	return name?.trim().split(/\s+/)[0] || 'someone';
}

function clip(text: string | null | undefined, max: number): string | undefined {
	const t = text?.replace(/\s+/g, ' ').trim();
	if (!t) return undefined;
	return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

/** Everything the group put on the board that week — no ids, no links. */
export async function gatherWeek(
	spaceId: string,
	start: string,
	weekEnd: string,
): Promise<WeekDigest> {
	const members = await db
		.select({ name: schema.users.name })
		.from(schema.spaceMembers)
		.innerJoin(schema.users, eq(schema.spaceMembers.userId, schema.users.id))
		.where(eq(schema.spaceMembers.spaceId, spaceId));
	const memberNames = members.map((m) => firstName(m.name));

	const canvases = await db
		.select({ id: schema.canvases.id, date: schema.canvases.date })
		.from(schema.canvases)
		.where(
			and(
				eq(schema.canvases.spaceId, spaceId),
				gte(schema.canvases.date, start),
				lte(schema.canvases.date, weekEnd),
			),
		)
		.orderBy(schema.canvases.date);
	const empty: WeekDigest = { weekStart: start, weekEnd, days: [], itemCount: 0, memberNames };
	if (canvases.length === 0) return empty;

	const rows = await db
		.select({ item: schema.items, authorName: schema.users.name })
		.from(schema.items)
		.innerJoin(schema.users, eq(schema.items.authorId, schema.users.id))
		.where(
			and(
				inArray(
					schema.items.canvasId,
					canvases.map((c) => c.id),
				),
				isNull(schema.items.deletedAt),
				// Last week's letter is not part of the week it sat on.
				ne(schema.items.type, 'letter'),
				ne(schema.items.authorId, SYSTEM_USER.id),
			),
		)
		.orderBy(schema.items.createdAt);
	if (rows.length === 0) return empty;

	const itemIds = rows.map((r) => r.item.id);
	const [unfurls, comments, reactions] = await Promise.all([
		db.select().from(schema.itemUnfurls).where(inArray(schema.itemUnfurls.itemId, itemIds)),
		db
			.select({
				itemId: schema.itemComments.itemId,
				text: schema.itemComments.text,
				authorName: schema.users.name,
			})
			.from(schema.itemComments)
			.innerJoin(schema.users, eq(schema.itemComments.authorId, schema.users.id))
			.where(inArray(schema.itemComments.itemId, itemIds))
			.orderBy(schema.itemComments.createdAt),
		db
			.select({ itemId: schema.itemReactions.itemId, emoji: schema.itemReactions.emoji })
			.from(schema.itemReactions)
			.where(inArray(schema.itemReactions.itemId, itemIds)),
	]);
	const unfurlByItem = new Map(unfurls.map((u) => [u.itemId, u]));

	const days = canvases.map((canvas) => ({
		date: canvas.date,
		items: rows
			.filter((r) => r.item.canvasId === canvas.id)
			.map((r): DigestItem => {
				const unfurl = unfurlByItem.get(r.item.id);
				const counts: Record<string, number> = {};
				for (const reaction of reactions) {
					if (reaction.itemId === r.item.id) {
						counts[reaction.emoji] = (counts[reaction.emoji] ?? 0) + 1;
					}
				}
				const isText = r.item.type === 'note' || r.item.type === 'emoji';
				return {
					author: firstName(r.authorName),
					type: r.item.type,
					title: clip(unfurl?.title, 120),
					description: clip(unfurl?.description, 160),
					site: clip(unfurl?.siteName, 40),
					text: isText ? clip(r.item.text, 200) : undefined,
					comments: comments
						.filter((c) => c.itemId === r.item.id)
						.map((c) => ({ author: firstName(c.authorName), text: clip(c.text, 140) ?? '' })),
					reactions: counts,
				};
			}),
	}));

	return { weekStart: start, weekEnd, days, itemCount: rows.length, memberNames };
}

/** Fewer than this and the week stays quiet — a letter about nothing is noise. */
export function weekIsQuiet(digest: WeekDigest): boolean {
	return digest.itemCount < MIN_ITEMS;
}
