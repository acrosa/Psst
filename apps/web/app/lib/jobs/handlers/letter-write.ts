import { eq } from 'drizzle-orm';
import { addDays, formatWeek } from '../../dates';
import { db, schema } from '../../db/client.server';
import { sendLetterEmail } from '../../email.server';
import { appUrl } from '../../env.server';
import { composeLetterPage, hashStr } from '../../hand';
import { pageToPng } from '../../hand/render-png.server';
import { enqueue } from '../../jobs.server';
import { writeLetter } from '../../letter-writer.server';
import { track } from '../../metrics.server';
import { getOrCreateTodayCanvas } from '../../services/canvases.server';
import { createLetterItem } from '../../services/items.server';
import {
	type LetterData,
	SYSTEM_USER,
	ensureSystemUser,
	gatherWeek,
	getLetter,
	markLetter,
	weekIsQuiet,
} from '../../services/letters.server';
import { publicUrl, putObject } from '../../storage.server';

/**
 * psst — write last week's letter for a space. Reads the week, asks the
 * writer for the words, puts the letter on today's board, then mails and
 * nudges the members. Once the item exists the row is `written`; the picture
 * and the post are best-effort so a retry never writes the week twice.
 */
export async function letterWrite(data: { spaceId: string; weekStart: string }): Promise<void> {
	const row = await getLetter(data.spaceId, data.weekStart);
	if (!row || row.status === 'written' || row.status === 'silent') return;
	const [space] = await db.select().from(schema.spaces).where(eq(schema.spaces.id, data.spaceId));
	if (!space) return;
	await markLetter(row.id, { attempts: row.attempts + 1 });

	const weekEnd = addDays(data.weekStart, 6);
	const digest = await gatherWeek(space.id, data.weekStart, weekEnd);
	if (weekIsQuiet(digest)) {
		await markLetter(row.id, { status: 'silent' });
		return;
	}

	let words: Awaited<ReturnType<typeof writeLetter>>;
	try {
		words = await writeLetter(digest, { spaceName: space.name });
	} catch (error) {
		await markLetter(row.id, { status: 'failed' });
		throw error;
	}
	if (!words) {
		await markLetter(row.id, { status: 'silent' });
		return;
	}

	await ensureSystemUser();
	const canvas = await getOrCreateTodayCanvas(space.id, space.timezone);
	const letter: LetterData = {
		v: 1,
		weekStart: data.weekStart,
		weekEnd,
		seed: hashStr(`${space.id}|${data.weekStart}`),
		...words,
	};
	const item = await createLetterItem({
		spaceId: space.id,
		canvasId: canvas.id,
		text: JSON.stringify(letter),
	});
	await markLetter(row.id, { status: 'written', itemId: item.id });
	track({ event: 'letter_written', icon: '✉️', userId: SYSTEM_USER.id, tags: { space: space.id } });

	// From here on, sugar: a picture for the post, the post, a nudge.
	try {
		const page = composeLetterPage({
			dateLabel: formatWeek(data.weekStart),
			greeting: letter.greeting,
			lines: letter.lines,
			close: letter.close,
			sign: letter.sign,
			seed: letter.seed,
		});
		const png = pageToPng(page, 1200, 1500, {
			ink: '#40382f',
			paper: '#fffdf8',
			crease: '#e7dfcf',
		});
		const key = `letters/${item.id}.png`;
		await putObject(key, png, 'image/png');
		const imageUrl = new URL(publicUrl(key), appUrl).toString();
		const boardUrl = new URL(`/spaces/${space.id}`, appUrl).toString();

		const members = await db
			.select({ email: schema.users.email, emailMentions: schema.users.emailMentions })
			.from(schema.spaceMembers)
			.innerJoin(schema.users, eq(schema.spaceMembers.userId, schema.users.id))
			.where(eq(schema.spaceMembers.spaceId, space.id));
		await Promise.all(
			members
				.filter((m) => m.emailMentions)
				.map((m) =>
					sendLetterEmail({
						to: m.email,
						spaceName: space.name,
						spaceEmoji: space.emoji,
						imageUrl,
						lines: [letter.greeting, ...letter.lines, letter.close, `— ${letter.sign}`],
						url: boardUrl,
					}),
				),
		);
	} catch (error) {
		console.error('[letters] the letter is on the board, but the post failed:', error);
	}

	await enqueue('push.notify', { itemId: item.id, kind: 'item', actorId: SYSTEM_USER.id });
}
