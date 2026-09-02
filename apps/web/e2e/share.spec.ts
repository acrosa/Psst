import { expect, registerOntoCanvas, test } from './fixtures';

test.describe('sharing a day', () => {
	test('a shared day is readable by strangers — look, not touch — until unshared', async ({
		page,
		browser,
	}) => {
		await registerOntoCanvas(page);

		// Drop a note so there's something to look at.
		await page.getByTestId('composer-input').fill('a day worth showing');
		await page.getByRole('button', { name: /^drop$/i }).click();
		await expect(page.getByText('a day worth showing')).toBeVisible();

		// Share lives with the space, under its name.
		await page.getByRole('button', { name: /this space/i }).click();
		await page.getByRole('button', { name: /share this day/i }).click();
		const linkInput = page.getByTestId('share-link');
		await expect(linkInput).toHaveValue(/\/b\//);
		const shareUrl = await linkInput.inputValue();

		// A stranger (no session at all) can see the board…
		const strangerContext = await browser.newContext();
		const stranger = await strangerContext.newPage();
		await stranger.goto(shareUrl);
		await expect(stranger.getByText('a day worth showing')).toBeVisible();
		await expect(stranger.getByText(/made with/i)).toBeVisible();
		// …but nothing invites touching: no composer, no badges to flip.
		await expect(stranger.getByTestId('composer-input')).toHaveCount(0);

		// Stop sharing: the link dies (the revoke is a POST — give it its moment).
		await page.getByRole('button', { name: /stop sharing/i }).click();
		await expect
			.poll(async () => (await stranger.goto(shareUrl))?.status(), { timeout: 10_000 })
			.toBe(404);
		await strangerContext.close();
	});
});
