import { nowSeconds, withDb } from './db-helpers';
import { expect, generateTestUser, registerOntoCanvas, registerUser, test } from './fixtures';

const BASE = `http://localhost:${Number(process.env.E2E_PORT) || 3100}`;

test.describe('the core loop', () => {
	test('sign up → canvas ready → drop things → invite → partner joins, sees it all, writes back', async ({
		page,
		browser,
	}) => {
		test.slow(); // two browser contexts + cold route compiles
		// A signs up — no onboarding, no naming step: a canvas is already theirs.
		await registerUser(page);
		const spaceUrl = page.url();
		await expect(page.getByText(/drop something here/i)).toBeVisible();
		await expect(page.getByRole('banner').getByText(/'s corner/)).toBeVisible();

		// A drops a note and a link before anyone else is even here.
		await page.getByTestId('composer-input').fill('psst, welcome');
		await page.getByRole('button', { name: /^drop$/i }).click();
		await expect(page.getByText('psst, welcome')).toBeVisible();
		await page.getByTestId('composer-input').fill(`${BASE}/e2e/og-fixture`);
		await page.getByRole('button', { name: /^drop$/i }).click();

		// One button, one link.
		await page.getByRole('button', { name: /^invite$/i }).click();
		const linkInput = page.getByTestId('invite-link');
		await expect(linkInput).toHaveValue(/\/invite\//);
		const inviteUrl = await linkInput.inputValue();
		await page.keyboard.press('Escape');

		// B opens the invite in their own browser.
		const context = await browser.newContext();
		try {
			const partnerPage = await context.newPage();
			await partnerPage.goto(inviteUrl);
			await expect(partnerPage.getByText(/saved you a spot/i)).toBeVisible();

			// Tiny signup straight from the invite…
			await partnerPage.getByRole('link', { name: /sign up to join/i }).click();
			const partner = generateTestUser('partner');
			await partnerPage.getByLabel(/^name$/i).fill(partner.name);
			await partnerPage.getByLabel(/email/i).fill(partner.email);
			await partnerPage.getByLabel(/password/i).fill(partner.password);
			await partnerPage.getByRole('button', { name: /create account/i }).click();

			// …one tap to join, and B is standing on the same canvas.
			await partnerPage.waitForURL('**/invite/**');
			await partnerPage.getByRole('button', { name: /^join /i }).click();
			await partnerPage.waitForURL(spaceUrl);

			// B sees everything A left — including the unfurled postcard.
			await expect(partnerPage.getByText('psst, welcome')).toBeVisible();
			await expect(partnerPage.getByText('A Cozy Test Page')).toBeVisible({ timeout: 15_000 });

			// B flips A's note, reacts, and writes on the back.
			const partnerNote = partnerPage.locator('.react-flow__node', { hasText: 'psst, welcome' });
			await partnerNote.getByRole('button', { name: /flip to write on the back/i }).click();
			await partnerNote.getByRole('button', { name: /🫶/ }).click();
			await expect(partnerNote.getByRole('button', { name: /🫶/ })).toHaveAttribute(
				'aria-pressed',
				'true',
			);
			await partnerNote.getByPlaceholder(/write on the back/i).fill('love this');
			await partnerNote.getByPlaceholder(/write on the back/i).press('Enter');
			await expect(partnerNote.getByText('love this').first()).toBeVisible();

			// A flips the same card and watches B's reply arrive on its own (polling).
			const ownerNote = page.locator('.react-flow__node', { hasText: 'psst, welcome' });
			await ownerNote.getByRole('button', { name: /read the back/i }).click();
			await expect(ownerNote.getByText('love this').first()).toBeVisible({ timeout: 10_000 });
			await expect(ownerNote.getByText(`${partner.name}:`).first()).toBeVisible();
			await expect(ownerNote.getByRole('button', { name: /🫶/ })).toContainText('1');

			// Both members show up in settings.
			await page.goto(`${spaceUrl}/settings`);
			await expect(page.getByText(partner.name)).toBeVisible();
		} finally {
			await context.close();
		}
	});
});

test.describe('spaces & invites', () => {
	test('spaces list shows the starter space and can create another', async ({ page }) => {
		await registerOntoCanvas(page);

		await page.goto('/spaces');
		await expect(page.getByRole('link', { name: /'s corner/i })).toBeVisible();

		await page.getByRole('button', { name: /new space/i }).click();
		await page.getByLabel(/space name/i).fill('Berry Patch');
		await page.getByRole('button', { name: /^create$/i }).click();
		await page.waitForURL(/\/spaces\/[0-9a-f-]{36}$/);

		await page.goto('/spaces');
		await expect(page.getByRole('link', { name: /berry patch/i })).toBeVisible();
	});

	test('an invalid invite link gets a graceful page', async ({ page }) => {
		await page.goto('/invite/not-a-real-token');
		await expect(page.getByText(/wandered off/i)).toBeVisible();
		await expect(page.getByRole('link', { name: /go home/i })).toBeVisible();
	});

	test('an expired invite explains itself', async ({ page, browser }) => {
		await registerOntoCanvas(page);

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
