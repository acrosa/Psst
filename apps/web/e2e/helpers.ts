import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

export interface TestUser {
	email: string;
	password: string;
	name: string;
}

let counter = 0;

/** Unique credentials per test. */
export function generateTestUser(prefix = 'test'): TestUser {
	counter += 1;
	const unique = `${Date.now().toString(36)}-${counter}-${Math.random().toString(36).slice(2, 8)}`;
	return {
		email: `${prefix}-${unique}@example.com`,
		password: 'TestPassword123!',
		name: `Test ${prefix} ${counter}`,
	};
}

/**
 * Register a new user through the UI. Signup auto-creates their first space,
 * so a fresh user lands directly on its canvas (/spaces/:id).
 */
export async function registerUser(page: Page, user?: TestUser): Promise<TestUser> {
	const testUser = user ?? generateTestUser();

	await page.goto('/register');
	await submitRegisterForm(page, testUser);

	await page.waitForURL(/\/spaces\/[0-9a-f-]{36}$/, { timeout: 45_000 });
	await expect(page.getByRole('button', { name: /sign out/i })).toBeVisible();

	return testUser;
}

/** Register and return both the user and their auto-created canvas URL. */
export async function registerOntoCanvas(
	page: Page,
): Promise<{ user: TestUser; spaceUrl: string }> {
	const user = await registerUser(page);
	return { user, spaceUrl: page.url() };
}

/**
 * Fill that survives a hydration re-render swapping the input out from under
 * us (the classic first-interaction race on a cold dev server).
 */
async function fillSettled(
	page: Page,
	locator: ReturnType<Page['getByLabel']>,
	value: string,
): Promise<void> {
	for (let attempt = 0; attempt < 3; attempt += 1) {
		await locator.fill(value);
		await page.waitForTimeout(150);
		if ((await locator.inputValue()) === value) return;
	}
	await expect(locator).toHaveValue(value);
}

/** Sign in an existing user through the UI. */
export async function loginUser(page: Page, user: TestUser): Promise<void> {
	await page.goto('/login');
	await submitLoginForm(page, user);
	await page.waitForURL(/\/(spaces|onboarding)$/);
	await expect(page.getByRole('button', { name: /sign out/i })).toBeVisible();
}

/** Fill and submit the register form without waiting for a destination. */
export async function submitRegisterForm(page: Page, user: TestUser): Promise<void> {
	await fillSettled(page, page.getByLabel(/^name$/i), user.name);
	await page.getByLabel(/email/i).fill(user.email);
	await page.getByLabel(/password/i).fill(user.password);
	await page.getByRole('button', { name: /create account/i }).click();
}

/** Fill and submit the login form without waiting for a destination. */
export async function submitLoginForm(page: Page, user: TestUser): Promise<void> {
	await page.getByLabel(/email/i).fill(user.email);
	await page.getByLabel(/password/i).fill(user.password);
	await page.getByRole('button', { name: /^sign in$/i }).click();
}

/** Open the invite dialog on today's canvas and return the copyable link. */
export async function copyInviteLink(page: Page): Promise<string> {
	await page.getByRole('button', { name: /^invite$/i }).click();
	const linkInput = page.getByTestId('invite-link');
	await expect(linkInput).toHaveValue(/\/invite\//);
	const inviteUrl = await linkInput.inputValue();
	await page.keyboard.press('Escape');
	return inviteUrl;
}
