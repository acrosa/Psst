import { and, asc, eq, ne } from 'drizzle-orm';
import { db, schema } from '~/lib/db/client.server';
import { SYSTEM_USER } from './letters.server';

/**
 * Delete an account and everything only it holds: authored drops (with
 * their threads, reactions and files), comments, reactions, devices,
 * sessions. Spaces stay with their other members — creatorship passes to
 * the longest-standing one — and a space nobody is left in goes too.
 */
export async function deleteAccount(userId: string) {
	if (userId === SYSTEM_USER.id) throw new Error('The system user cannot be deleted');

	const memberships = await db
		.select({ spaceId: schema.spaceMembers.spaceId })
		.from(schema.spaceMembers)
		.where(eq(schema.spaceMembers.userId, userId));
	const created = await db
		.select({ id: schema.spaces.id })
		.from(schema.spaces)
		.where(eq(schema.spaces.createdBy, userId));
	const spaceIds = new Set([...memberships.map((m) => m.spaceId), ...created.map((s) => s.id)]);

	for (const spaceId of spaceIds) {
		const [heir] = await db
			.select({ userId: schema.spaceMembers.userId })
			.from(schema.spaceMembers)
			.where(and(eq(schema.spaceMembers.spaceId, spaceId), ne(schema.spaceMembers.userId, userId)))
			.orderBy(asc(schema.spaceMembers.joinedAt))
			.limit(1);
		if (!heir) {
			await db.delete(schema.spaces).where(eq(schema.spaces.id, spaceId));
			continue;
		}
		await db
			.update(schema.spaces)
			.set({ createdBy: heir.userId })
			.where(and(eq(schema.spaces.id, spaceId), eq(schema.spaces.createdBy, userId)));
		await db
			.update(schema.spaceMembers)
			.set({ role: 'owner' })
			.where(
				and(eq(schema.spaceMembers.spaceId, spaceId), eq(schema.spaceMembers.userId, heir.userId)),
			);
	}

	await db.delete(schema.itemReactions).where(eq(schema.itemReactions.userId, userId));
	await db.delete(schema.itemComments).where(eq(schema.itemComments.authorId, userId));
	await db.delete(schema.items).where(eq(schema.items.authorId, userId));
	await db
		.update(schema.invites)
		.set({ acceptedBy: null })
		.where(eq(schema.invites.acceptedBy, userId));
	await db.delete(schema.invites).where(eq(schema.invites.createdBy, userId));
	await db.delete(schema.spaceMembers).where(eq(schema.spaceMembers.userId, userId));
	await db.delete(schema.pushDevices).where(eq(schema.pushDevices.userId, userId));
	await db.delete(schema.sessions).where(eq(schema.sessions.userId, userId));
	await db.delete(schema.accounts).where(eq(schema.accounts.userId, userId));
	await db.delete(schema.users).where(eq(schema.users.id, userId));
}
