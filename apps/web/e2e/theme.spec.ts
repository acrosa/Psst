import { expect, registerOntoCanvas, test } from './fixtures';

test.describe('theme', () => {
	test('follows the device preference, live', async ({ page }) => {
		await page.emulateMedia({ colorScheme: 'dark' });
		await registerOntoCanvas(page);
		await expect(page.locator('html')).toHaveClass(/dark/);

		// The device flips to light while the app is open — so does the board.
		await page.emulateMedia({ colorScheme: 'light' });
		await expect(page.locator('html')).not.toHaveClass(/dark/);

		// And it holds across a reload.
		await page.reload();
		await expect(page.locator('html')).not.toHaveClass(/dark/);
	});
});
