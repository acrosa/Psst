import { eq } from 'drizzle-orm';
import { db, schema } from '../../db/client.server';
import { sendMentionEmail } from '../../email.server';
import { appUrl } from '../../env.server';
import { findMentions } from '../../mentions';
import { sendPush, tokensForUsers } from '../../push.server';

const ITEM_VERBS: Record<string, string> = {
	link: 'dropped a link',
	note: 'left a note',
	image: 'dropped a photo',
	emoji: 'stuck a sticker',
	drawing: 'drew something',
	audio: 'left a voice note',
};

/**
 * psst — someone put something on the board. Notifies every member of the
 * space except the actor; reactions never notify. Members called by @name
 * get a direct nudge instead — and an email, unless they turned those off.
 */
export async function pushNotify(data: {
	itemId: string;
	kind: 'item' | 'comment';
	actorId: string;
	mentionText?: string;
}): Promise<void> {
	const [row] = await db
		.select({ item: schema.items, space: schema.spaces })
		.from(schema.items)
		.innerJoin(schema.spaces, eq(schema.items.spaceId, schema.spaces.id))
		.where(eq(schema.items.id, data.itemId));
	if (!row) return;

	const [actor] = await db.select().from(schema.users).where(eq(schema.users.id, data.actorId));
	const actorName = actor?.name?.split(/\s+/)[0] || 'Someone';

	const members = await db
		.select({
			id: schema.users.id,
			name: schema.users.name,
			email: schema.users.email,
			emailMentions: schema.users.emailMentions,
		})
		.from(schema.spaceMembers)
		.innerJoin(schema.users, eq(schema.spaceMembers.userId, schema.users.id))
		.where(eq(schema.spaceMembers.spaceId, row.space.id));

	const others = members.filter((m) => m.id !== data.actorId);
	const mentionedIds = new Set(data.mentionText ? findMentions(data.mentionText, others) : []);
	const mentioned = others.filter((m) => mentionedIds.has(m.id));
	const rest = others.filter((m) => !mentionedIds.has(m.id));

	const title = `${row.space.emoji} ${row.space.name}`;
	const payload = { spaceId: row.space.id };

	if (rest.length > 0) {
		const body =
			data.kind === 'comment'
				? `${actorName} wrote on the back of a card`
				: `${actorName} ${ITEM_VERBS[row.item.type] ?? 'added something'}`;
		await sendPush(await tokensForUsers(rest.map((m) => m.id)), { title, body, payload });
	}

	if (mentioned.length > 0) {
		await sendPush(await tokensForUsers(mentioned.map((m) => m.id)), {
			title,
			body: `${actorName} mentioned you`,
			payload,
		});

		const excerpt =
			(data.mentionText ?? '').length > 140
				? `${(data.mentionText ?? '').slice(0, 139)}…`
				: (data.mentionText ?? '');
		const url = new URL(`/spaces/${row.space.id}`, appUrl).toString();
		for (const member of mentioned) {
			if (!member.emailMentions) continue;
			await sendMentionEmail({
				to: member.email,
				actorName,
				spaceName: row.space.name,
				spaceEmoji: row.space.emoji,
				excerpt,
				url,
			});
		}
	}
}
