import { acceptUser } from './db-helpers';
import { expect, test } from './fixtures';
import { fillSettled, generateTestUser } from './helpers';

test.describe('the waitlist', () => {
	test('a fresh signup waits at the door until an admin lets them in', async ({
		page,
		browser,
	}) => {
		// Sign up without the helper — this person stays waiting.
		const waiting = generateTestUser('waiting');
		await page.goto('/register');
		await fillSettled(page, page.getByLabel(/^name$/i), waiting.name);
		await page.getByLabel(/email/i).fill(waiting.email);
		await page.getByLabel(/password/i).fill(waiting.password);
		await page.getByRole('button', { name: /create account/i }).click();

		// Held at the rope, and the product stays closed.
		await page.waitForURL(/\/waitlist$/);
		await expect(page.getByRole('heading', { name: /on the list/i })).toBeVisible();
		await page.goto('/spaces');
		await page.waitForURL(/\/waitlist$/);

		// An admin (fixed allow-listed email) opens the door from /admin.
		const adminContext = await browser.newContext();
		const adminPage = await adminContext.newPage();
		const adminEmail = 'alejandro.crosa@gmail.com';
		const adminPassword = 'AdminPassword123!';
		// The allow-listed email is fixed, so the account may exist from a
		// prior run — sign in first, register only when that fails.
		await adminPage.goto('/login');
		await adminPage.getByLabel(/email/i).fill(adminEmail);
		await adminPage.getByLabel(/password/i).fill(adminPassword);
		await adminPage.getByRole('button', { name: /^sign in$/i }).click();
		const outcome = await Promise.race([
			adminPage.waitForURL(/\/spaces/).then(() => 'in' as const),
			adminPage
				.getByText(/sign in failed|invalid email or password/i)
				.waitFor()
				.then(() => 'register' as const),
		]);
		if (outcome === 'register') {
			await adminPage.goto('/register');
			await fillSettled(adminPage, adminPage.getByLabel(/^name$/i), 'Ale Admin');
			await adminPage.getByLabel(/email/i).fill(adminEmail);
			await adminPage.getByLabel(/password/i).fill(adminPassword);
			await adminPage.getByRole('button', { name: /create account/i }).click();
			// Admins bypass the rope entirely — straight onto their canvas.
			await adminPage.waitForURL(/\/spaces\/[0-9a-f-]{36}$/);
		}

		await adminPage.goto('/admin');
		await expect(adminPage.getByRole('heading', { name: /the door/i })).toBeVisible();
		const row = adminPage.locator('li', { hasText: waiting.email });
		await row.getByRole('button', { name: /let in/i }).click();
		// Accepted: the person moves to the "Inside" list — no button left.
		await expect(row.getByRole('button', { name: /let in/i })).toHaveCount(0);
		await adminContext.close();

		// The waiting page notices and walks them in.
		await page.goto('/spaces');
		await expect(page.getByRole('heading', { name: /your spaces/i })).toBeVisible();
	});

	test('the admin door is invisible to regular people', async ({ page }) => {
		const person = generateTestUser('civilian');
		await page.goto('/register');
		await fillSettled(page, page.getByLabel(/^name$/i), person.name);
		await page.getByLabel(/email/i).fill(person.email);
		await page.getByLabel(/password/i).fill(person.password);
		await page.getByRole('button', { name: /create account/i }).click();
		await page.waitForURL(/\/waitlist$/);
		acceptUser(person.email);

		const response = await page.goto('/admin');
		expect(response?.status()).toBe(404);
	});
});
