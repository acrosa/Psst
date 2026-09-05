import { randomUUID } from 'node:crypto';
import { nowSeconds, withDb } from './db-helpers';
import { expect, registerOntoCanvas, test } from './fixtures';

/** 'YYYY-MM-DD' in UTC, n days from today (the browser runs in UTC too). */
function dayUTC(offset: number): string {
	return new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);
}

/** Last week's Monday and Wednesday, in UTC. */
function lastWeek() {
	const today = new Date(`${dayUTC(0)}T12:00:00Z`);
	const back = (today.getUTCDay() + 6) % 7;
	return { monday: dayUTC(-back - 7), wednesday: dayUTC(-back - 5) };
}

/**
 * A space that existed last week, with things on last Wednesday's board.
 * A fresh space is created today, so it is backdated: psst only writes about
 * weeks the space was there for.
 */
function fabricateLastWeek(spaceId: string, ownerEmail: string, count: number) {
	const { wednesday } = lastWeek();
	const canvasId = randomUUID();
	withDb((db) => {
		const userRow = db.prepare('SELECT id FROM users WHERE email = ?').get(ownerEmail) as
			| { id: string }
			| undefined;
		if (!userRow) throw new Error('owner not found in db');
		db.prepare('UPDATE spaces SET created_at = ? WHERE id = ?').run(
			nowSeconds() - 14 * 86_400,
			spaceId,
		);
		const t = nowSeconds() - 5 * 86_400;
		db.prepare('INSERT INTO canvases (id, space_id, date, created_at) VALUES (?, ?, ?, ?)').run(
			canvasId,
			spaceId,
			wednesday,
			t,
		);
		const insertItem = db.prepare(
			'INSERT INTO items (id, canvas_id, space_id, author_id, type, url, text, x, y, z, rotation, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
		);
		const things: Array<[string, string | null, string | null]> = [
			['note', null, 'a tiny cabin by the lake, saturday?'],
			['emoji', null, '🌈'],
			['link', 'https://example.com/cabin', null],
			['note', null, 'bring the radio'],
		];
		things.slice(0, count).forEach(([type, url, text], i) => {
			const id = randomUUID();
			insertItem.run(
				id,
				canvasId,
				spaceId,
				userRow.id,
				type,
				url,
				text,
				40 + i * 60,
				40,
				i + 1,
				0,
				t,
			);
			if (type === 'link') {
				db.prepare(
					'INSERT INTO item_unfurls (item_id, title, description, site_name, status) VALUES (?, ?, ?, ?, ?)',
				).run(id, 'A tiny cabin by the lake', 'Two nights, one canoe.', 'cabins.example', 'ok');
			}
		});
	});
}

function letterStatus(spaceId: string): string | undefined {
	return withDb(
		(db) =>
			(
				db.prepare('SELECT status FROM letters WHERE space_id = ?').get(spaceId) as
					| { status: string }
					| undefined
			)?.status,
	);
}

test.describe('the Sunday letter', () => {
	test('a letter about last week arrives on the board', async ({ page }) => {
		const { user: owner, spaceUrl } = await registerOntoCanvas(page);
		const spaceId = spaceUrl.split('/spaces/')[1];
		fabricateLastWeek(spaceId, owner.email, 4);

		// The first open of the week books the letter; polling shows it arrive.
		await page.reload();
		const letter = page.locator('.react-flow__node-letter');
		await expect(letter).toBeVisible({ timeout: 20_000 });
		await expect.poll(() => letterStatus(spaceId)).toBe('written');

		// psst signs it — the system user exists now.
		const psst = withDb((db) => db.prepare("SELECT name FROM users WHERE id = 'psst'").get()) as
			| { name: string }
			| undefined;
		expect(psst?.name).toBe('psst');

		// The back names its week and takes a note like any card.
		await letter.getByRole('button', { name: /flip to write on the back/i }).click();
		await expect(letter.getByText(/the week of/i)).toBeVisible();
		await expect(letter.getByText('psst', { exact: true })).toBeVisible();

		// Archived, it shows in the scrapbook as a letter.
		const yesterday = dayUTC(-1);
		const yesterdayId = randomUUID();
		withDb((db) => {
			db.prepare('INSERT INTO canvases (id, space_id, date, created_at) VALUES (?, ?, ?, ?)').run(
				yesterdayId,
				spaceId,
				yesterday,
				nowSeconds() - 86_400,
			);
			db.prepare("UPDATE items SET canvas_id = ? WHERE space_id = ? AND type = 'letter'").run(
				yesterdayId,
				spaceId,
			);
		});
		await page.getByRole('button', { name: /this space/i }).click();
		await page.getByRole('link', { name: /timeline/i }).click();
		await page.waitForURL('**/days');
		await expect(page.getByTitle('a letter from psst')).toBeVisible();
	});

	test('a quiet week stays silent', async ({ page }) => {
		const { user: owner, spaceUrl } = await registerOntoCanvas(page);
		const spaceId = spaceUrl.split('/spaces/')[1];
		fabricateLastWeek(spaceId, owner.email, 2);

		await page.reload();
		await expect.poll(() => letterStatus(spaceId), { timeout: 15_000 }).toBe('silent');
		await expect(page.locator('.react-flow__node-letter')).toHaveCount(0);
	});

	test('the owner can take a letter down', async ({ page }) => {
		const { user: owner, spaceUrl } = await registerOntoCanvas(page);
		const spaceId = spaceUrl.split('/spaces/')[1];
		fabricateLastWeek(spaceId, owner.email, 3);
		await page.reload();
		await expect(page.locator('.react-flow__node-letter')).toBeVisible({ timeout: 20_000 });

		const item = withDb(
			(db) =>
				db.prepare("SELECT id FROM items WHERE space_id = ? AND type = 'letter'").get(spaceId) as {
					id: string;
				},
		);
		const response = await page.request.post(spaceUrl, {
			form: { intent: 'delete-item', itemId: item.id },
		});
		expect(response.ok()).toBeTruthy();
		const row = withDb(
			(db) =>
				db.prepare('SELECT deleted_at FROM items WHERE id = ?').get(item.id) as {
					deleted_at: number | null;
				},
		);
		expect(row.deleted_at).not.toBeNull();
	});
});
