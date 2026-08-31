import crypto from 'node:crypto';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { db, schema } from '../db/client.server';
import { sendInviteEmail } from '../email.server';
import { appUrl } from '../env.server';
import { track } from '../metrics.server';
import {
	MAX_SPACE_MEMBERS,
	countSpaceMembers,
	getMembership,
	requireMember,
} from './spaces.server';

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export async function createInvite(args: { spaceId: string; userId: string; email?: string }) {
	await requireMember(args.spaceId, args.userId);

	const token = crypto.randomBytes(24).toString('base64url');
	const email = args.email?.trim() || null;

	const [invite] = await db
		.insert(schema.invites)
		.values({
			spaceId: args.spaceId,
			token,
			email,
			createdBy: args.userId,
			expiresAt: new Date(Date.now() + INVITE_TTL_MS),
		})
		.returning();

	const url = `${appUrl}/invite/${token}`;

	if (email) {
		const [space] = await db.select().from(schema.spaces).where(eq(schema.spaces.id, args.spaceId));
		const [inviter] = await db
			.select({ name: schema.users.name })
			.from(schema.users)
			.where(eq(schema.users.id, args.userId));
		await sendInviteEmail({
			to: email,
			inviterName: inviter?.name ?? null,
			spaceName: space?.name ?? 'a space',
			spaceEmoji: space?.emoji ?? '🤫',
			url,
		});
	}

	track({
		event: 'invite_created',
		icon: '💌',
		userId: args.userId,
		tags: { emailed: Boolean(email) },
	});
	return { invite, url };
}

export type InviteLookup =
	| {
			status: 'ok';
			invite: typeof schema.invites.$inferSelect;
			space: { id: string; name: string; emoji: string };
			inviterName: string | null;
	  }
	| { status: 'invalid' | 'expired' | 'used' };

export async function getInviteByToken(token: string): Promise<InviteLookup> {
	if (!token || token.length > 64) return { status: 'invalid' };

	const [row] = await db
		.select({
			invite: schema.invites,
			space: { id: schema.spaces.id, name: schema.spaces.name, emoji: schema.spaces.emoji },
			inviterName: schema.users.name,
		})
		.from(schema.invites)
		.innerJoin(schema.spaces, eq(schema.invites.spaceId, schema.spaces.id))
		.innerJoin(schema.users, eq(schema.invites.createdBy, schema.users.id))
		.where(eq(schema.invites.token, token));

	if (!row) return { status: 'invalid' };
	if (row.invite.acceptedAt) return { status: 'used' };
	if (row.invite.expiresAt.getTime() < Date.now()) return { status: 'expired' };
	return { status: 'ok', invite: row.invite, space: row.space, inviterName: row.inviterName };
}

export type AcceptResult =
	| { status: 'joined' | 'already-member'; spaceId: string }
	| { status: 'invalid' | 'expired' | 'used' | 'full' };

const INVITE_NEXT_RE = /^\/invite\/([^/?#]+)/;

/** Pull an invite token out of a same-origin `next` path, if one is there. */
export function inviteTokenFromNext(next: string): string | null {
	const token = INVITE_NEXT_RE.exec(next)?.[1];
	return token && token.length > 0 ? token : null;
}

/**
 * After signup / login / OAuth, consume `next` when it points at an invite
 * and return the canvas to land on. Sad outcomes (invalid, expired, used,
 * full) send the user back to the invite page so they see the friendly copy
 * instead of a random space or a 404. Viewing the invite URL itself is a
 * GET and never reaches this — only an authenticated accept consumes.
 */
export async function completeInviteIfPresent(next: string, userId: string): Promise<string> {
	const token = inviteTokenFromNext(next);
	if (!token) return next;

	const result = await acceptInvite({ token, userId });
	if (result.status === 'joined' || result.status === 'already-member') {
		return `/spaces/${result.spaceId}`;
	}
	return `/invite/${token}`;
}

export async function acceptInvite(args: { token: string; userId: string }): Promise<AcceptResult> {
	const lookup = await getInviteByToken(args.token);
	if (lookup.status !== 'ok') return { status: lookup.status };

	const { invite, space } = lookup;

	// Already in? The invite stays unconsumed for whoever it was meant for.
	const existing = await getMembership(space.id, args.userId);
	if (existing) return { status: 'already-member', spaceId: space.id };

	if ((await countSpaceMembers(space.id)) >= MAX_SPACE_MEMBERS) {
		return { status: 'full' };
	}

	await db.insert(schema.spaceMembers).values({
		spaceId: space.id,
		userId: args.userId,
		role: 'member',
	});
	await db
		.update(schema.invites)
		.set({ acceptedBy: args.userId, acceptedAt: new Date() })
		.where(eq(schema.invites.id, invite.id));

	track({ event: 'invite_accepted', icon: '🎉', userId: args.userId, tags: { space: space.name } });
	// An invite from someone inside is a hand at the door — being let in by a
	// member counts as being let in (the waitlist gates cold signups only).
	await db
		.update(schema.users)
		.set({ acceptedAt: new Date() })
		.where(and(eq(schema.users.id, args.userId), isNull(schema.users.acceptedAt)));

	return { status: 'joined', spaceId: space.id };
}

/** Pending (unaccepted, unexpired) invites for the settings page. */
export async function listPendingInvites(spaceId: string) {
	return db
		.select({
			id: schema.invites.id,
			token: schema.invites.token,
			email: schema.invites.email,
			expiresAt: schema.invites.expiresAt,
			createdAt: schema.invites.createdAt,
		})
		.from(schema.invites)
		.where(
			and(
				eq(schema.invites.spaceId, spaceId),
				isNull(schema.invites.acceptedAt),
				gt(schema.invites.expiresAt, new Date()),
			),
		)
		.orderBy(schema.invites.createdAt);
}

export async function revokeInvite(inviteId: string, spaceId: string) {
	await db
		.delete(schema.invites)
		.where(and(eq(schema.invites.id, inviteId), eq(schema.invites.spaceId, spaceId)));
}
