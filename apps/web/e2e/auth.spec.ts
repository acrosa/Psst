import { expect, generateTestUser, loginUser, registerUser, test } from './fixtures';

test.describe('auth', () => {
	test('registers a new account and lands on a ready canvas', async ({ page }) => {
		const user = await registerUser(page);

		// Signup auto-creates the first space — straight onto its board.
		await expect(page).toHaveURL(/\/spaces\/[0-9a-f-]{36}$/);
		await expect(page.getByRole('banner').getByText(/'s corner/)).toBeVisible();
		await expect(page.getByText(/drop something here/i)).toBeVisible();
		await expect(page.getByRole('button', { name: /account menu/i })).toBeVisible();

		// Header shows who's signed in (desktop viewport)
		await expect(page.getByText(user.name)).toBeVisible();
	});

	test('rejects a duplicate email with a friendly error', async ({ page }) => {
		const user = await registerUser(page);

		// Sign out, then try to register the same email again
		await page.getByRole('button', { name: /account menu/i }).click();
		await page.getByRole('button', { name: /sign out/i }).click();
		await page.waitForURL('**/');

		await page.goto('/register');
		await page.getByLabel(/name/i).fill(user.name);
		await page.getByLabel(/email/i).fill(user.email);
		await page.getByLabel(/password/i).fill(user.password);
		await page.getByRole('button', { name: /create account/i }).click();

		await expect(page.getByRole('alert')).toBeVisible();
		await expect(page).toHaveURL(/\/register/);
	});

	test('signs in and out', async ({ page }) => {
		const user = await registerUser(page);

		await page.getByRole('button', { name: /account menu/i }).click();
		await page.getByRole('button', { name: /sign out/i }).click();
		await page.waitForURL('**/');
		await expect(page.getByRole('link', { name: /start a canvas/i })).toBeVisible();

		await loginUser(page, user);
		await expect(page).toHaveURL(/\/(spaces|onboarding)$/);
	});

	test('rejects a wrong password', async ({ page }) => {
		const user = await registerUser(page);
		await page.getByRole('button', { name: /account menu/i }).click();
		await page.getByRole('button', { name: /sign out/i }).click();
		await page.waitForURL('**/');

		await page.goto('/login');
		await page.getByLabel(/email/i).fill(user.email);
		await page.getByLabel(/password/i).fill('not-the-password');
		await page.getByRole('button', { name: /^sign in$/i }).click();

		await expect(page.getByRole('alert')).toBeVisible();
		await expect(page).toHaveURL(/\/login/);
	});

	test('redirects a signed-out visitor from /spaces to login', async ({ page }) => {
		await page.goto('/spaces');
		await page.waitForURL('**/login**');
		await expect(page.getByRole('button', { name: /^sign in$/i })).toBeVisible();
	});

	test('landing page redirects signed-in users into the app', async ({ page }) => {
		await registerUser(page);
		await page.goto('/');
		await page.waitForURL(/\/(spaces|onboarding)$/);
	});

	test('health endpoint responds', async ({ request }) => {
		const response = await request.get('/health');
		expect(response.ok()).toBeTruthy();
		expect(await response.json()).toEqual({ ok: true });
	});

	test('unique users do not collide', async () => {
		const a = generateTestUser();
		const b = generateTestUser();
		expect(a.email).not.toEqual(b.email);
	});
});
