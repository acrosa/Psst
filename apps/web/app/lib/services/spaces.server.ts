import { and, count, eq, inArray, isNull } from 'drizzle-orm';
import { localDate } from '../dates';
import { db, schema } from '../db/client.server';
import { track } from '../metrics.server';

/** Spaces stay intimate — hard cap on membership. */
export const MAX_SPACE_MEMBERS = 8;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type SpaceMemberInfo = {
	id: string;
	name: string | null;
	image: string | null;
	role: 'owner' | 'member';
};

export type SpaceSummary = {
	id: string;
	name: string;
	emoji: string;
	timezone: string;
	role: 'owner' | 'member';
	members: SpaceMemberInfo[];
	todayCount: number;
};

export async function listSpacesForUser(userId: string): Promise<SpaceSummary[]> {
	const memberships = await db
		.select({ space: schema.spaces, role: schema.spaceMembers.role })
		.from(schema.spaceMembers)
		.innerJoin(schema.spaces, eq(schema.spaceMembers.spaceId, schema.spaces.id))
		.where(eq(schema.spaceMembers.userId, userId))
		.orderBy(schema.spaceMembers.joinedAt);

	if (memberships.length === 0) return [];

	const spaceIds = memberships.map((m) => m.space.id);
	const memberRows = await db
		.select({
			spaceId: schema.spaceMembers.spaceId,
			role: schema.spaceMembers.role,
			id: schema.users.id,
			name: schema.users.name,
			image: schema.users.image,
		})
		.from(schema.spaceMembers)
		.innerJoin(schema.users, eq(schema.spaceMembers.userId, schema.users.id))
		.where(inArray(schema.spaceMembers.spaceId, spaceIds))
		.orderBy(schema.spaceMembers.joinedAt);

	const summaries: SpaceSummary[] = [];
	for (const { space, role } of memberships) {
		// Each space has its own timezone, so "today" is computed per space.
		const today = localDate(space.timezone);
		const [row] = await db
			.select({ value: count() })
			.from(schema.items)
			.innerJoin(schema.canvases, eq(schema.items.canvasId, schema.canvases.id))
			.where(
				and(
					eq(schema.canvases.spaceId, space.id),
					eq(schema.canvases.date, today),
					isNull(schema.items.deletedAt),
				),
			);

		summaries.push({
			id: space.id,
			name: space.name,
			emoji: space.emoji,
			timezone: space.timezone,
			role,
			members: memberRows
				.filter((m) => m.spaceId === space.id)
				.map(({ id, name, image, role: memberRole }) => ({ id, name, image, role: memberRole })),
			todayCount: row?.value ?? 0,
		});
	}
	return summaries;
}

export async function createSpace(args: {
	userId: string;
	name: string;
	emoji: string;
	timezone: string;
}) {
	const [space] = await db
		.insert(schema.spaces)
		.values({
			name: args.name.trim(),
			emoji: args.emoji,
			timezone: args.timezone,
			createdBy: args.userId,
		})
		.returning();

	await db
		.insert(schema.spaceMembers)
		.values({ spaceId: space.id, userId: args.userId, role: 'owner' });

	track({
		event: 'space_created',
		icon: space.emoji,
		userId: args.userId,
		description: space.name,
	});
	return space;
}

export async function getSpace(spaceId: string) {
	if (!UUID_RE.test(spaceId)) return null;
	const [space] = await db.select().from(schema.spaces).where(eq(schema.spaces.id, spaceId));
	return space ?? null;
}

export async function getMembership(spaceId: string, userId: string) {
	if (!UUID_RE.test(spaceId)) return null;
	const [membership] = await db
		.select()
		.from(schema.spaceMembers)
		.where(and(eq(schema.spaceMembers.spaceId, spaceId), eq(schema.spaceMembers.userId, userId)));
	return membership ?? null;
}

/**
 * The canvas URL is a capability: a signed-in visitor who has the link joins
 * on arrival (spaces stay tiny — the 8-seat cap still applies). Deliberate
 * sharing model — revoke by nothing yet; invites remain the polite path.
 */
export async function ensureMember(spaceId: string, userId: string) {
	const existing = await getMembership(spaceId, userId);
	if (existing) return existing;

	const space = await getSpace(spaceId);
	if (!space) throw new Response('Not found', { status: 404 });

	const seats = await countSpaceMembers(spaceId);
	if (seats >= 8) {
		throw new Response('This corner is full — spaces stay tiny.', { status: 403 });
	}

	await db.insert(schema.spaceMembers).values({ spaceId, userId, role: 'member' });
	track({ event: 'joined_via_link', icon: '🚪', userId, tags: { space: space.name } });
	const membership = await getMembership(spaceId, userId);
	if (!membership) throw new Response('Not found', { status: 404 });
	return membership;
}

/** Membership guard for loaders/actions — 404 (not 403) to avoid leaking existence. */
export async function requireMember(spaceId: string, userId: string) {
	const membership = await getMembership(spaceId, userId);
	if (!membership) {
		throw new Response('Not found', { status: 404 });
	}
	return membership;
}

export async function getSpaceMembers(spaceId: string): Promise<SpaceMemberInfo[]> {
	return db
		.select({
			id: schema.users.id,
			name: schema.users.name,
			image: schema.users.image,
			role: schema.spaceMembers.role,
		})
		.from(schema.spaceMembers)
		.innerJoin(schema.users, eq(schema.spaceMembers.userId, schema.users.id))
		.where(eq(schema.spaceMembers.spaceId, spaceId))
		.orderBy(schema.spaceMembers.joinedAt);
}

export async function countSpaceMembers(spaceId: string): Promise<number> {
	const [row] = await db
		.select({ value: count() })
		.from(schema.spaceMembers)
		.where(eq(schema.spaceMembers.spaceId, spaceId));
	return row?.value ?? 0;
}

export async function updateSpace(
	spaceId: string,
	patch: Partial<{ name: string; emoji: string; timezone: string }>,
) {
	const [space] = await db
		.update(schema.spaces)
		.set(patch)
		.where(eq(schema.spaces.id, spaceId))
		.returning();
	return space;
}

export async function leaveSpace(spaceId: string, userId: string) {
	await db
		.delete(schema.spaceMembers)
		.where(and(eq(schema.spaceMembers.spaceId, spaceId), eq(schema.spaceMembers.userId, userId)));
}
