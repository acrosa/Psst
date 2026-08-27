import { expect, registerOntoCanvas, test } from './fixtures';

// 1×1 red PNG
const TINY_PNG_BASE64 =
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

test.describe('drop & paste onto the canvas', () => {
	test('a dropped image file lands as a print where it fell', async ({ page }) => {
		await registerOntoCanvas(page);

		const board = page.locator('.psst-board');
		await board.dispatchEvent('drop', {
			clientX: 400,
			clientY: 300,
			dataTransfer: await page.evaluateHandle((base64) => {
				const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
				const transfer = new DataTransfer();
				transfer.items.add(new File([bytes], 'dropped.png', { type: 'image/png' }));
				return transfer;
			}, TINY_PNG_BASE64),
		});

		await expect(page.locator('.react-flow__node img')).toBeVisible({ timeout: 10_000 });
	});

	test('pasted text becomes a slip on the board', async ({ page }) => {
		await registerOntoCanvas(page);

		// Paste with focus on the board (not an input) — the layer should catch it.
		await page.locator('.psst-board').click({ position: { x: 200, y: 200 } });
		await page.evaluate(() => {
			const transfer = new DataTransfer();
			transfer.setData('text/plain', 'psst, pasted straight in');
			window.dispatchEvent(new ClipboardEvent('paste', { clipboardData: transfer }));
		});

		await expect(page.getByText('psst, pasted straight in')).toBeVisible({ timeout: 10_000 });
	});

	test('paste inside the composer input stays a normal paste', async ({ page }) => {
		await registerOntoCanvas(page);

		const input = page.getByTestId('composer-input');
		await input.click();
		await input.evaluate((element) => {
			const transfer = new DataTransfer();
			transfer.setData('text/plain', 'typed, not dropped');
			element.dispatchEvent(
				new ClipboardEvent('paste', { clipboardData: transfer, bubbles: true }),
			);
		});

		// The layer must not have turned it into a board item.
		await page.waitForTimeout(1000);
		await expect(page.locator('.react-flow__node')).toHaveCount(0);
	});
});
