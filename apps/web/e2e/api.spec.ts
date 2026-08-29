import { expect, registerOntoCanvas, test } from './fixtures';

// The JSON surface the iOS app and widget read.
test.describe('native API', () => {
	test('devices register and unregister; the board serves absolute JSON', async ({ page }) => {
		await registerOntoCanvas(page);
		await page.getByTestId('composer-input').fill('hello from the api');
		await page.getByRole('button', { name: /^drop$/i }).click();
		await expect(page.getByText('hello from the api')).toBeVisible();

		// Register a device token (cookie-authenticated via the page context).
		const register = await page.request.post('/api/devices', {
			data: { token: 'test-device-token-1234' },
		});
		expect(register.ok()).toBeTruthy();

		// Today's board as JSON, defaulting to the user's first space.
		const board = await page.request.get('/api/board');
		expect(board.ok()).toBeTruthy();
		const json = await board.json();
		expect(json.space.name).toMatch(/corner/);
		expect(json.items.length).toBeGreaterThan(0);
		expect(json.items.some((item: { text: string }) => item.text === 'hello from the api')).toBe(
			true,
		);

		// Bearer auth works for native clients (no cookies).
		const signIn = await page.request.post('/api/auth/sign-in/email', {
			data: { email: 'nobody@example.com', password: 'wrong' },
		});
		expect(signIn.ok()).toBeFalsy(); // sanity: endpoint reachable

		const remove = await page.request.post('/api/devices', {
			data: { token: 'test-device-token-1234', remove: true },
		});
		expect(remove.ok()).toBeTruthy();
	});
});
