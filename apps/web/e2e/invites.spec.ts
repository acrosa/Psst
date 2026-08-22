import { inviteAcceptedAt, inviteTokenFromUrl, nowSeconds, withDb } from './db-helpers';
import {
	copyInviteLink,
	expect,
	generateTestUser,
	registerOntoCanvas,
	registerUser,
	submitLoginForm,
	submitRegisterForm,
	test,
} from './fixtures';

const BASE = `http://localhost:${Number(process.env.E2E_PORT) || 3100}`;
const SPACE_URL = /\/spaces\/[0-9a-f-]{36}$/;

test.describe('the core loop', () => {
	test('sign up → canvas ready → drop things → invite → partner joins, sees it all, writes back', async ({
		page,
		browser,
	}) => {
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
		const inviteUrl = await copyInviteLink(page);

		// B opens the invite in their own browser.
		const context = await browser.newContext();
		try {
			const partnerPage = await context.newPage();
			await partnerPage.goto(inviteUrl);
			await expect(partnerPage.getByText(/saved you a spot/i)).toBeVisible();

			// Tiny signup straight from the invite — then straight onto the board.
			// No second Join click.
			await partnerPage.getByRole('link', { name: /sign up to join/i }).click();
			const partner = generateTestUser('partner');
			await submitRegisterForm(partnerPage, partner);
			await partnerPage.waitForURL(spaceUrl);
			await expect(partnerPage.getByRole('button', { name: /^join /i })).toHaveCount(0);

			// B sees everything A left — including the unfurled postcard.
			await expect(partnerPage.getByText('psst, welcome')).toBeVisible();
			await expect(partnerPage.getByText('A Cozy Test Page')).toBeVisible({ timeout: 15_000 });

			// B flips A's note, reacts, and writes on the back.
			const partnerNote = partnerPage.locator('.react-flow__node', { hasText: 'psst, welcome' });
			await partnerNote.click();
			await partnerNote.getByRole('button', { name: /🫶/ }).click();
			await expect(partnerNote.getByRole('button', { name: /🫶/ })).toHaveAttribute(
				'aria-pressed',
				'true',
			);
			await partnerNote.getByPlaceholder(/write on the back/i).fill('love this');
			await partnerNote.getByPlaceholder(/write on the back/i).press('Enter');
			await expect(partnerNote.getByText('love this')).toBeVisible();

			// A flips the same card and watches B's reply arrive on its own (polling).
			const ownerNote = page.locator('.react-flow__node', { hasText: 'psst, welcome' });
			await ownerNote.click();
			await expect(ownerNote.getByText('love this')).toBeVisible({ timeout: 10_000 });
			await expect(ownerNote.getByText(`${partner.name}:`)).toBeVisible();
			await expect(ownerNote.getByRole('button', { name: /🫶/ })).toContainText('1');

			// Both members show up in settings.
			await page.goto(`${spaceUrl}/settings`);
			await expect(page.getByText(partner.name)).toBeVisible();
		} finally {
			await context.close();
		}
	});
});

test.describe('invite auto-join', () => {
	test('an existing user signs in via the invite link and lands on the canvas', async ({
		page,
		browser,
	}) => {
		await registerOntoCanvas(page);
		const spaceUrl = page.url();
		const inviteUrl = await copyInviteLink(page);

		const partnerContext = await browser.newContext();
		try {
			const partnerPage = await partnerContext.newPage();
			const partner = await registerUser(partnerPage);
			const partnerSpaceUrl = partnerPage.url();
			await partnerPage.getByRole('button', { name: /sign out/i }).click();
			await partnerPage.waitForURL('**/');

			await partnerPage.goto(inviteUrl);
			await partnerPage.getByRole('link', { name: /i already have an account/i }).click();
			await submitLoginForm(partnerPage, partner);
			await partnerPage.waitForURL(spaceUrl);
			await expect(partnerPage.getByRole('button', { name: /^join /i })).toHaveCount(0);
			expect(partnerPage.url()).not.toEqual(partnerSpaceUrl);
		} finally {
			await partnerContext.close();
		}
	});

	test('already-a-member signing in via the invite is a no-op redirect to the canvas', async ({
		page,
	}) => {
		const owner = await registerUser(page);
		const spaceUrl = page.url();
		const inviteUrl = await copyInviteLink(page);
		const token = inviteTokenFromUrl(inviteUrl);
		expect(inviteAcceptedAt(token)).toBeNull();

		await page.getByRole('button', { name: /sign out/i }).click();
		await page.waitForURL('**/');

		await page.goto(inviteUrl);
		await page.getByRole('link', { name: /i already have an account/i }).click();
		await submitLoginForm(page, owner);
		await page.waitForURL(spaceUrl);
		await expect(page.getByRole('button', { name: /^join /i })).toHaveCount(0);

		// Already-member must not consume the seat.
		expect(inviteAcceptedAt(token)).toBeNull();
	});

	test('an expired invite still shows the sad state after signup', async ({ page, browser }) => {
		await registerOntoCanvas(page);
		const inviteUrl = await copyInviteLink(page);
		const token = inviteTokenFromUrl(inviteUrl);

		const context = await browser.newContext();
		try {
			const strangerPage = await context.newPage();
			await strangerPage.goto(inviteUrl);
			await strangerPage.getByRole('link', { name: /sign up to join/i }).click();
			await expect(strangerPage.getByRole('button', { name: /create account/i })).toBeVisible();

			withDb((db) =>
				db
					.prepare('UPDATE invites SET expires_at = ? WHERE token = ?')
					.run(nowSeconds() - 3600, token),
			);

			await submitRegisterForm(strangerPage, generateTestUser('late'));
			await expect(strangerPage.getByText(/invite expired/i)).toBeVisible();
			await expect(strangerPage).not.toHaveURL(SPACE_URL);
		} finally {
			await context.close();
		}
	});

	test('a used invite still shows the sad state after signup', async ({ page, browser }) => {
		await registerOntoCanvas(page);
		const inviteUrl = await copyInviteLink(page);
		const token = inviteTokenFromUrl(inviteUrl);

		const firstContext = await browser.newContext();
		try {
			const firstPage = await firstContext.newPage();
			await firstPage.goto(inviteUrl);
			await firstPage.getByRole('link', { name: /sign up to join/i }).click();
			await submitRegisterForm(firstPage, generateTestUser('first-seat'));
			await firstPage.waitForURL(SPACE_URL);
			expect(inviteAcceptedAt(token)).not.toBeNull();
		} finally {
			await firstContext.close();
		}

		const lateContext = await browser.newContext();
		try {
			const latePage = await lateContext.newPage();
			await latePage.goto(`/register?next=${encodeURIComponent(`/invite/${token}`)}`);
			await submitRegisterForm(latePage, generateTestUser('second-seat'));
			await expect(latePage.getByText(/already used/i)).toBeVisible();
			await expect(latePage).not.toHaveURL(SPACE_URL);
		} finally {
			await lateContext.close();
		}
	});

	test('Google-style /auth/continue accepts the invite without a Join click', async ({
		page,
		browser,
	}) => {
		await registerOntoCanvas(page);
		const spaceUrl = page.url();
		const inviteUrl = await copyInviteLink(page);
		const token = inviteTokenFromUrl(inviteUrl);

		const partnerContext = await browser.newContext();
		try {
			const partnerPage = await partnerContext.newPage();
			await registerUser(partnerPage);

			await partnerPage.goto(`/auth/continue?next=${encodeURIComponent(`/invite/${token}`)}`);
			await partnerPage.waitForURL(spaceUrl);
			await expect(partnerPage.getByRole('button', { name: /^join /i })).toHaveCount(0);
			expect(inviteAcceptedAt(token)).not.toBeNull();
		} finally {
			await partnerContext.close();
		}
	});

	test('viewing an invite does not consume it', async ({ page, browser }) => {
		await registerOntoCanvas(page);
		const inviteUrl = await copyInviteLink(page);
		const token = inviteTokenFromUrl(inviteUrl);

		const context = await browser.newContext();
		try {
			const strangerPage = await context.newPage();
			await strangerPage.goto(inviteUrl);
			await expect(strangerPage.getByText(/saved you a spot/i)).toBeVisible();
			expect(inviteAcceptedAt(token)).toBeNull();
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
		await page.waitForURL(SPACE_URL);

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

		const inviteUrl = await copyInviteLink(page);
		const token = inviteTokenFromUrl(inviteUrl);

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
