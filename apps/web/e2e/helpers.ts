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
 * Register a new user through the UI. A fresh user lands on /onboarding
 * (no spaces yet); users with spaces land on /spaces.
 */
export async function registerUser(page: Page, user?: TestUser): Promise<TestUser> {
	const testUser = user ?? generateTestUser();

	await page.goto('/register');
	await page.getByLabel(/^name$/i).fill(testUser.name);
	await page.getByLabel(/email/i).fill(testUser.email);
	await page.getByLabel(/password/i).fill(testUser.password);
	await page.getByRole('button', { name: /create account/i }).click();

	await page.waitForURL(/\/(spaces|onboarding)$/);
	await expect(page.getByRole('button', { name: /sign out/i })).toBeVisible();

	return testUser;
}

/** Sign in an existing user through the UI. */
export async function loginUser(page: Page, user: TestUser): Promise<void> {
	await page.goto('/login');
	await page.getByLabel(/email/i).fill(user.email);
	await page.getByLabel(/password/i).fill(user.password);
	await page.getByRole('button', { name: /^sign in$/i }).click();

	await page.waitForURL(/\/(spaces|onboarding)$/);
	await expect(page.getByRole('button', { name: /sign out/i })).toBeVisible();
}

/**
 * Create a space through the onboarding form (where fresh users land).
 * Returns the canvas URL (/spaces/:id).
 */
export async function createSpaceViaOnboarding(page: Page, name: string): Promise<string> {
	await page.waitForURL('**/onboarding');
	await page.getByLabel(/space name/i).fill(name);
	await page.getByRole('button', { name: /open the canvas/i }).click();
	await page.waitForURL(/\/spaces\/[0-9a-f-]{36}$/);
	return page.url();
}
