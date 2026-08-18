import { expect, registerOntoCanvas, test } from './fixtures';

// 1×1 red PNG
const TINY_PNG = Buffer.from(
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
	'base64',
);

test.describe('image items', () => {
	test('a photo lands as a print, then gets a processed thumb', async ({ page }) => {
		await registerOntoCanvas(page);

		await page
			.locator('input[type="file"]')
			.setInputFiles({ name: 'tiny.png', mimeType: 'image/png', buffer: TINY_PNG });

		const photo = page.locator('.react-flow__node img');
		await expect(photo).toBeVisible({ timeout: 10_000 });

		const initialSrc = await photo.getAttribute('src');
		expect(initialSrc).toContain('/files/');

		// image.process (inline) makes a webp thumb + blurhash; polling swaps it in.
		await expect(async () => {
			const src = await page.locator('.react-flow__node img').getAttribute('src');
			expect(src).toContain('-thumb.webp');
		}).toPass({ timeout: 15_000 });

		// The stored file actually serves.
		const src = await page.locator('.react-flow__node img').getAttribute('src');
		const response = await page.request.get(src as string);
		expect(response.ok()).toBeTruthy();
		expect(response.headers()['content-type']).toContain('image/webp');
	});

	test('non-image files are turned away kindly', async ({ page }) => {
		await registerOntoCanvas(page);

		await page.locator('input[type="file"]').setInputFiles({
			name: 'notes.txt',
			mimeType: 'text/plain',
			buffer: Buffer.from('not a photo'),
		});

		await expect(page.getByText(/photos only/i)).toBeVisible();
	});
});
