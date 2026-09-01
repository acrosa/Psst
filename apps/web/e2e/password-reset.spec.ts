import { expect, test } from './fixtures';
import { generateTestUser } from './helpers';

test.describe('forgot password', () => {
	test('asks for an email and says the same thing either way', async ({ page }) => {
		const person = generateTestUser('forgetful');

		// The way in is on the login page.
		await page.goto('/login');
		await page.getByRole('link', { name: /forgot it/i }).click();
		await page.waitForURL(/\/forgot-password$/);

		await page.getByLabel(/email/i).fill(person.email);
		await page.getByRole('button', { name: /send the link/i }).click();
		await expect(page.getByRole('heading', { name: /check your email/i })).toBeVisible();

		// Same reply for an address with no account — nothing is revealed.
		await page.goto('/forgot-password');
		await page.getByLabel(/email/i).fill('nobody-here@example.com');
		await page.getByRole('button', { name: /send the link/i }).click();
		await expect(page.getByRole('heading', { name: /check your email/i })).toBeVisible();
	});

	test('a spent link explains itself', async ({ page }) => {
		await page.goto('/reset-password');
		await expect(page.getByRole('heading', { name: /that link is spent/i })).toBeVisible();

		await page.goto('/reset-password?token=not-a-real-token');
		await page.getByLabel(/new password/i).fill('another-password-1');
		await page.getByRole('button', { name: /save it/i }).click();
		await expect(page.getByText(/expired or was already used/i)).toBeVisible();
	});
});
