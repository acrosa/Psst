import { randomUUID } from 'node:crypto';
import { nowSeconds, withDb } from './db-helpers';
import { expect, registerOntoCanvas, test } from './fixtures';

function yesterdayUTC(): string {
	return new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
}

test.describe('the timeline', () => {
	test('archived days appear in the scrapbook and stay frozen', async ({ page }) => {
		const { user: owner, spaceUrl } = await registerOntoCanvas(page);
		const spaceId = spaceUrl.split('/spaces/')[1];

		// Something on today's board, through the UI
		await page.getByTestId('composer-input').fill('today thought');
		await page.getByRole('button', { name: /^drop$/i }).click();
		await expect(page.getByText('today thought')).toBeVisible();

		// Fabricate yesterday directly in the database (the UI can't reach the past)
		const yesterday = yesterdayUTC();
		const canvasId = randomUUID();
		const noteId = randomUUID();
		withDb((db) => {
			const userRow = db.prepare('SELECT id FROM users WHERE email = ?').get(owner.email) as
				| { id: string }
				| undefined;
			if (!userRow) throw new Error('owner not found in db');
			const t = nowSeconds() - 86_400;
			db.prepare('INSERT INTO canvases (id, space_id, date, created_at) VALUES (?, ?, ?, ?)').run(
				canvasId,
				spaceId,
				yesterday,
				t,
			);
			const insertItem = db.prepare(
				'INSERT INTO items (id, canvas_id, space_id, author_id, type, text, x, y, z, rotation, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
			);
			insertItem.run(
				noteId,
				canvasId,
				spaceId,
				userRow.id,
				'note',
				'a yesterday thought',
				40,
				40,
				1,
				-1.5,
				t,
			);
			insertItem.run(randomUUID(), canvasId, spaceId, userRow.id, 'emoji', '🌈', 220, 90, 2, 2, t);
		});

		// The scrapbook lists yesterday (and not today)
		await page.getByRole('link', { name: /timeline/i }).click();
		await page.waitForURL('**/days');
		await expect(page.getByText('2 things')).toBeVisible();
		await expect(page.getByText('a yesterday thought')).toBeVisible();
		await expect(page.getByText('today thought')).toBeHidden();

		// Open the archived day — left exactly as it was
		await page.getByText('2 things').click();
		await page.waitForURL(`**/days/${yesterday}`);
		await expect(page.getByText('a yesterday thought')).toBeVisible();
		await expect(page.getByText('🌈')).toBeVisible();
		await expect(page.getByText(/left as it was/i)).toBeVisible();

		// Frozen: no composer, and card backs are read-only
		await expect(page.getByTestId('composer-input')).toHaveCount(0);
		const noteNode = page.locator('.react-flow__node', { hasText: 'a yesterday thought' });
		await noteNode.click();
		await expect(noteNode.getByText(/nothing on the back yet/i)).toBeVisible();
		await expect(page.getByPlaceholder(/write on the back/i)).toHaveCount(0);

		// Server-side guard: a move against an archived item is rejected
		await page.request.post(spaceUrl, {
			form: { intent: 'move-item', itemId: noteId, x: '999', y: '999' },
		});
		const row = withDb(
			(db) => db.prepare('SELECT x FROM items WHERE id = ?').get(noteId) as { x: number },
		);
		expect(row.x).toBe(40);
	});

	test('an empty scrapbook explains itself', async ({ page }) => {
		await registerOntoCanvas(page);

		await page.getByRole('link', { name: /timeline/i }).click();
		await page.waitForURL('**/days');
		await expect(page.getByText(/no pages yet/i)).toBeVisible();

		// Back to today
		await page.getByRole('link', { name: /back to today/i }).click();
		await expect(page.getByText(/drop something here/i)).toBeVisible();
	});
});
