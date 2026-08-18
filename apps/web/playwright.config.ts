import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const E2E_DB_PATH = `file:${path.join(__dirname, 'e2e', 'e2e-test.db')}`;

// Dedicated port so E2E never collides with a dev server on 3000 (vite honors
// PORT; strictPort makes a collision fail fast instead of drifting).
const E2E_PORT = Number(process.env.E2E_PORT) || 3100;
const E2E_URL = `http://localhost:${E2E_PORT}`;

export default defineConfig({
	testDir: './e2e',
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	// One local retry absorbs CPU-contention flakiness without masking real bugs.
	retries: process.env.CI ? 2 : 1,
	workers: process.env.CI ? 1 : undefined,
	reporter: [['list'], ['html', { open: 'never' }]],
	globalSetup: './e2e/global-setup.ts',
	use: {
		baseURL: E2E_URL,
		trace: 'on-first-retry',
		// Deterministic day-boundary math: browser timezone (which seeds each
		// space's timezone) matches the UTC dates the specs fabricate.
		timezoneId: 'UTC',
		// Sandboxed CI images sometimes pre-install a Chromium whose build number
		// doesn't match this Playwright version — point at it explicitly there.
		...(process.env.PLAYWRIGHT_CHROMIUM_PATH
			? { launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } }
			: {}),
	},
	projects: [
		{
			name: 'chromium',
			use: { ...devices['Desktop Chrome'] },
		},
	],
	webServer: {
		command: 'pnpm run dev',
		url: E2E_URL,
		reuseExistingServer: false,
		timeout: 120_000,
		env: {
			PORT: String(E2E_PORT),
			USE_SQLITE: 'true',
			DATABASE_URL: E2E_DB_PATH,
			NODE_ENV: 'test',
			JOBS_MODE: 'inline',
			BETTER_AUTH_SECRET: 'test-secret-must-be-at-least-32-characters-long',
			BETTER_AUTH_URL: E2E_URL,
			APP_URL: E2E_URL,
		},
	},
});
