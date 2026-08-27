import type { Page } from '@playwright/test';
import { expect, loginUser, registerOntoCanvas, registerUser, test } from './fixtures';

const BASE = `http://localhost:${Number(process.env.E2E_PORT) || 3100}`;

async function dropNote(page: Page, text: string) {
	await page.getByTestId('composer-input').fill(text);
	await page.getByRole('button', { name: /^drop$/i }).click();
	await expect(page.getByText(text)).toBeVisible();
}

/** The React Flow node wrapper for the item containing `text`. */
function nodeFor(page: Page, text: string) {
	return page.locator('.react-flow__node', { hasText: text });
}

test.describe('the daily canvas', () => {
	test('a note lands on the board as a paper slip', async ({ page }) => {
		await registerOntoCanvas(page);

		await expect(page.getByText(/drop something here/i)).toBeVisible();
		await dropNote(page, 'hello little board');
		await expect(page.getByText(/drop something here/i)).toBeHidden();
	});

	test('a link unfurls into a postcard', async ({ page }) => {
		await registerOntoCanvas(page);

		await page.getByTestId('composer-input').fill(`${BASE}/e2e/og-fixture`);
		await page.getByRole('button', { name: /^drop$/i }).click();

		// Unfurl runs inline in the background; the next poll paints the postcard.
		await expect(page.getByText('A Cozy Test Page')).toBeVisible({ timeout: 15_000 });
		await expect(page.getByText('Cozy Fixtures')).toBeVisible();
	});

	test('dragging an item keeps its place across a reload', async ({ page }) => {
		await registerOntoCanvas(page);
		await dropNote(page, 'drag me somewhere nice');

		const node = nodeFor(page, 'drag me somewhere nice');
		const before = await node.evaluate((el) => el.style.transform);

		const box = await node.boundingBox();
		if (!box) throw new Error('note node has no bounding box');
		await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
		await page.mouse.down();
		await page.mouse.move(box.x + box.width / 2 + 140, box.y + box.height / 2 + 90, { steps: 12 });
		await page.mouse.up();

		const after = await node.evaluate((el) => el.style.transform);
		expect(after).not.toEqual(before);

		// Give the position PATCH a beat, then verify the server kept it.
		await page.waitForTimeout(500);
		await page.reload();
		const persisted = nodeFor(page, 'drag me somewhere nice');
		await expect(persisted).toBeVisible();
		const restored = await persisted.evaluate((el) => el.style.transform);

		const parse = (t: string) => (t.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);
		const [ax, ay] = parse(after);
		const [rx, ry] = parse(restored);
		expect(Math.abs(ax - rx)).toBeLessThan(2);
		expect(Math.abs(ay - ry)).toBeLessThan(2);
	});

	test('flip a card to write on the back and react', async ({ page }) => {
		const { user } = await registerOntoCanvas(page);
		await dropNote(page, 'flip me over');

		await nodeFor(page, 'flip me over').click();
		await expect(page.getByText(/nothing on the back yet/i)).toBeVisible();

		// Small thread on the back
		await page.getByPlaceholder(/write on the back/i).fill('so true');
		await page.getByPlaceholder(/write on the back/i).press('Enter');
		await expect(page.getByText('so true').first()).toBeVisible();
		await expect(page.getByText(`${user.name}:`).first()).toBeVisible();

		// Reaction toggles on…
		const heart = page.getByRole('button', { name: '🫶', exact: false }).first();
		await heart.click();
		await expect(heart).toHaveAttribute('aria-pressed', 'true');

		// …and off
		await heart.click();
		await expect(heart).toHaveAttribute('aria-pressed', 'false');
	});

	test('the caption badge flips the card and wears the thread', async ({ page }) => {
		await registerOntoCanvas(page);
		await dropNote(page, 'talk about me');

		const node = nodeFor(page, 'talk about me');

		// Quiet card: the chat chip is there, countless, offering the flip.
		await node.getByRole('button', { name: /flip to write on the back/i }).click();
		await page.getByPlaceholder(/write on the back/i).fill('gladly');
		await page.getByPlaceholder(/write on the back/i).press('Enter');
		await expect(page.getByText('gladly').first()).toBeVisible();
		await page.getByRole('button', { name: '🫶', exact: false }).first().click();

		// Back over (click the postmark corner) — the caption wears the thread.
		await node.click({ position: { x: 24, y: 16 } });
		const badges = node.getByRole('button', { name: /read the back — 1 note/i });
		await expect(badges).toBeVisible();
		await expect(badges).toContainText('1');
		await expect(badges).toContainText('🫶');
	});

	test('option reveals a resize handle; dragging it resizes the card and it sticks', async ({
		page,
	}) => {
		await registerOntoCanvas(page);
		await dropNote(page, 'make me bigger');

		const node = nodeFor(page, 'make me bigger');
		const card = node.locator('.group').first();
		const widthOf = () => card.evaluate((el) => Number.parseFloat((el as HTMLElement).style.width));
		const before = await widthOf();

		// The handle only shows while Option (Alt) is held and the card is hovered.
		await expect(node.getByTestId('resize-handle')).toBeHidden();
		await node.hover();
		await page.keyboard.down('Alt');
		const handle = node.getByTestId('resize-handle');
		await expect(handle).toBeVisible();

		const box = await handle.boundingBox();
		if (!box) throw new Error('resize handle has no bounding box');
		await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
		await page.mouse.down();
		await page.mouse.move(box.x + 70, box.y + 70, { steps: 8 });
		await page.mouse.up();
		await page.keyboard.up('Alt');

		const after = await widthOf();
		expect(after).toBeGreaterThan(before + 20);

		// The new size round-trips through the server.
		await page.waitForTimeout(500);
		await page.reload();
		const persisted = nodeFor(page, 'make me bigger').locator('.group').first();
		const restored = await persisted.evaluate((el) =>
			Number.parseFloat((el as HTMLElement).style.width),
		);
		expect(Math.abs(restored - after)).toBeLessThan(2);
	});

	test('a postcard wears a visit button that opens the link', async ({ page }) => {
		await registerOntoCanvas(page);

		await page.getByTestId('composer-input').fill(`${BASE}/e2e/og-fixture`);
		await page.getByRole('button', { name: /^drop$/i }).click();

		const visit = page.getByRole('link', { name: /visit/i });
		await expect(visit).toBeVisible({ timeout: 15_000 });
		await expect(visit).toHaveAttribute('href', `${BASE}/e2e/og-fixture`);
		await expect(visit).toHaveAttribute('target', '_blank');
	});

	test('double-tap likes a card', async ({ page }) => {
		await registerOntoCanvas(page);
		await dropNote(page, 'double tap me');

		const node = nodeFor(page, 'double tap me');
		await node.dblclick();

		// The caption row wears the heart (and the card did not flip).
		await expect(node.getByRole('button', { name: /flip to write on the back/i })).toContainText(
			'🫶',
		);
	});

	test('emoji stickers drop from the tray', async ({ page }) => {
		await registerOntoCanvas(page);

		await page.getByRole('button', { name: /sticker tray/i }).click();
		await page.getByRole('button', { name: /drop 🐸 sticker/i }).click();

		await expect(page.locator('.react-flow__node').getByText('🐸')).toBeVisible();
	});

	test('authors can take their things back off the board', async ({ page }) => {
		await registerOntoCanvas(page);
		await dropNote(page, 'a fleeting thought');

		await nodeFor(page, 'a fleeting thought').click();
		await page.getByRole('button', { name: /remove from the board/i }).click();

		// The soft confirmation modal, not a browser alert.
		await expect(page.getByText(/take this off the board\?/i)).toBeVisible();
		await page.getByRole('button', { name: /take it off/i }).click();

		await expect(page.getByText('a fleeting thought')).toBeHidden();
		await expect(page.getByText(/drop something here/i)).toBeVisible();
	});

	test('a second window sees new items through ambient polling', async ({ page, browser }) => {
		const { user: owner, spaceUrl } = await registerOntoCanvas(page);

		const context = await browser.newContext();
		try {
			const otherPage = await context.newPage();
			await loginUser(otherPage, owner);
			await otherPage.goto(spaceUrl);
			await expect(otherPage.getByText(/drop something here/i)).toBeVisible();

			await dropNote(page, 'psst, over here');

			// Poll interval in tests is 2s — the other window catches up on its own.
			await expect(otherPage.getByText('psst, over here')).toBeVisible({ timeout: 10_000 });
		} finally {
			await context.close();
		}
	});
});
