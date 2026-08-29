import { eq } from 'drizzle-orm';
import { db, schema } from '../../db/client.server';
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
 * space except the actor; reactions never notify.
 */
export async function pushNotify(data: {
	itemId: string;
	kind: 'item' | 'comment';
	actorId: string;
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
		.select({ userId: schema.spaceMembers.userId })
		.from(schema.spaceMembers)
		.where(eq(schema.spaceMembers.spaceId, row.space.id));
	const others = members.map((m) => m.userId).filter((id) => id !== data.actorId);
	const tokens = await tokensForUsers(others);

	const body =
		data.kind === 'comment'
			? `${actorName} wrote on the back of a card`
			: `${actorName} ${ITEM_VERBS[row.item.type] ?? 'added something'}`;

	await sendPush(tokens, {
		title: `${row.space.emoji} ${row.space.name}`,
		body,
		payload: { spaceId: row.space.id },
	});
}
