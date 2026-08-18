import { type Page, test as base, expect } from '@playwright/test';
import { type TestUser, generateTestUser, registerUser } from './helpers';

/** Extended fixtures: fresh credentials and an already-registered page. */
export const test = base.extend<{
	testCredentials: TestUser;
	authenticatedPage: Page;
}>({
	// biome-ignore lint/correctness/noEmptyPattern: Playwright fixture signature
	testCredentials: async ({}, use) => {
		await use(generateTestUser());
	},

	authenticatedPage: async ({ page }, use) => {
		await registerUser(page);
		await use(page);
	},
});

export { expect };
export {
	createSpaceViaOnboarding,
	generateTestUser,
	loginUser,
	registerUser,
	type TestUser,
} from './helpers';
