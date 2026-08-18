import { nowSeconds, withDb } from './db-helpers';
import { createSpaceViaOnboarding, expect, generateTestUser, registerUser, test } from './fixtures';

test.describe('spaces & invites', () => {
	test('golden path: sign up → create a space → invite → partner joins the same canvas', async ({
		page,
		browser,
	}) => {
		await registerUser(page);
		const spaceUrl = await createSpaceViaOnboarding(page, 'Sunday Corner');
		await expect(page.getByRole('banner').getByText('Sunday Corner')).toBeVisible();

		// One button, one link
		await page.getByRole('button', { name: /^invite$/i }).click();
		const linkInput = page.getByTestId('invite-link');
		await expect(linkInput).toHaveValue(/\/invite\//);
		const inviteUrl = await linkInput.inputValue();

		// The partner opens the link in their own browser
		const context = await browser.newContext();
		try {
			const partnerPage = await context.newPage();
			await partnerPage.goto(inviteUrl);
			await expect(partnerPage.getByText(/saved you a spot/i)).toBeVisible();
			await expect(partnerPage.getByText('Sunday Corner', { exact: true })).toBeVisible();

			// Tiny signup, straight from the invite
			await partnerPage.getByRole('link', { name: /sign up to join/i }).click();
			const partner = generateTestUser('partner');
			await partnerPage.getByLabel(/^name$/i).fill(partner.name);
			await partnerPage.getByLabel(/email/i).fill(partner.email);
			await partnerPage.getByLabel(/password/i).fill(partner.password);
			await partnerPage.getByRole('button', { name: /create account/i }).click();

			// …lands back on the invite, one tap to join, straight onto the canvas
			await partnerPage.waitForURL('**/invite/**');
			await partnerPage.getByRole('button', { name: /^join /i }).click();
			await partnerPage.waitForURL(spaceUrl);
			await expect(partnerPage.getByRole('banner').getByText('Sunday Corner')).toBeVisible();

			// The owner sees both members in settings
			await page.goto(`${spaceUrl}/settings`);
			await expect(page.getByText(partner.name)).toBeVisible();
		} finally {
			await context.close();
		}
	});

	test('spaces list shows cards and can create another space', async ({ page }) => {
		await registerUser(page);
		await createSpaceViaOnboarding(page, 'First Corner');

		await page.goto('/spaces');
		await expect(page.getByRole('link', { name: /first corner/i })).toBeVisible();

		await page.getByRole('button', { name: /new space/i }).click();
		await page.getByLabel(/space name/i).fill('Second Corner');
		await page.getByRole('button', { name: /^create$/i }).click();
		await page.waitForURL(/\/spaces\/[0-9a-f-]{36}$/);

		await page.goto('/spaces');
		await expect(page.getByRole('link', { name: /second corner/i })).toBeVisible();
	});

	test('an invalid invite link gets a graceful page', async ({ page }) => {
		await page.goto('/invite/not-a-real-token');
		await expect(page.getByText(/wandered off/i)).toBeVisible();
		await expect(page.getByRole('link', { name: /go home/i })).toBeVisible();
	});

	test('an expired invite explains itself', async ({ page, browser }) => {
		await registerUser(page);
		await createSpaceViaOnboarding(page, 'Fleeting Corner');

		await page.getByRole('button', { name: /^invite$/i }).click();
		const linkInput = page.getByTestId('invite-link');
		await expect(linkInput).toHaveValue(/\/invite\//);
		const inviteUrl = await linkInput.inputValue();
		const token = inviteUrl.split('/invite/')[1];

		withDb((db) =>
			db
				.prepare('UPDATE invites SET expires_at = ? WHERE token = ?')
				.run(nowSeconds() - 3600, token),
		);

		const context = await browser.newContext();
		try {
			const strangerPage = await context.newPage();
			await strangerPage.goto(inviteUrl);
			await expect(strangerPage.getByText(/invite expired/i)).toBeVisible();
		} finally {
			await context.close();
		}
	});
});
