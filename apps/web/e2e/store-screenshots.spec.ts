import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { nowSeconds, withDb } from './db-helpers';
import { expect, generateTestUser, registerUser, test } from './fixtures';

/**
 * App Store screenshots, generated from the mobile web UI the iOS shell
 * shows. Gated so the regular suite skips it:
 *
 *   STORE_SCREENSHOTS=1 pnpm exec playwright test e2e/store-screenshots.spec.ts
 *
 * Output lands in docs/appstore/screenshots/{iphone-6.9,ipad-13}/.
 */
const enabled = process.env.STORE_SCREENSHOTS === '1';
const OUT = path.join(
	path.dirname(fileURLToPath(import.meta.url)),
	'..',
	'..',
	'..',
	'docs',
	'appstore',
	'screenshots',
);

const DEVICES = {
	'iphone-6.9': { viewport: { width: 440, height: 956 }, deviceScaleFactor: 3 },
	'ipad-13': { viewport: { width: 1032, height: 1376 }, deviceScaleFactor: 2 },
} as const;

type Spot = { x: number; y: number; rotation: number };
/** Where things sit for the shot — a collage, not a pile. */
const LAYOUT: Record<string, Record<'image' | 'link' | 'walked' | 'peach' | 'frog', Spot>> = {
	'iphone-6.9': {
		image: { x: 20, y: -40, rotation: -2 },
		link: { x: 128, y: 160, rotation: 2 },
		walked: { x: 18, y: 350, rotation: -2.5 },
		peach: { x: 150, y: 500, rotation: 1 },
		frog: { x: 330, y: 60, rotation: 8 },
	},
	'ipad-13': {
		image: { x: 120, y: 80, rotation: -2 },
		link: { x: 570, y: 140, rotation: 2 },
		walked: { x: 160, y: 470, rotation: -3 },
		peach: { x: 600, y: 560, rotation: 1 },
		frog: { x: 480, y: 360, rotation: 8 },
	},
};

/** A warm "photo" for the print — rendered, not borrowed. */
const PHOTO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900">
<defs>
<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
<stop offset="0" stop-color="#f6c89f"/><stop offset="0.55" stop-color="#e98a6a"/><stop offset="1" stop-color="#5b3a5e"/>
</linearGradient>
<radialGradient id="sun" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#fff3cf"/><stop offset="1" stop-color="#fff3cf" stop-opacity="0"/></radialGradient>
<filter id="grain"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2"/><feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.08 0"/></filter>
</defs>
<rect width="1200" height="900" fill="url(#sky)"/>
<circle cx="700" cy="520" r="260" fill="url(#sun)"/>
<circle cx="700" cy="520" r="90" fill="#fff0c2"/>
<path d="M0 640 Q 200 560 420 620 T 820 600 T 1200 640 L1200 900 L0 900Z" fill="#3b2a45"/>
<path d="M0 720 Q 300 680 600 720 T 1200 700 L1200 900 L0 900Z" fill="#251a2e"/>
<rect width="1200" height="900" filter="url(#grain)"/>
</svg>`;

function drop(page: import('@playwright/test').Page, text: string) {
	return page
		.getByTestId('composer-input')
		.fill(text)
		.then(() => page.getByRole('button', { name: /^drop$/i }).click());
}

for (const [device, use] of Object.entries(DEVICES)) {
	test.describe(`store screenshots · ${device}`, () => {
		test.skip(!enabled, 'set STORE_SCREENSHOTS=1');
		test.use({ ...use, isMobile: device.startsWith('iphone'), hasTouch: true });
		test.setTimeout(240_000);

		test('capture', async ({ page, browser }) => {
			const dir = path.join(OUT, device);
			const t0 = Date.now();
			const mark = (label: string) =>
				console.log(`[${device}] ${label} +${Math.round((Date.now() - t0) / 1000)}s`);
			const shot = (name: string) =>
				page.screenshot({ path: path.join(dir, `${name}.png`), fullPage: false });

			const mia = { ...generateTestUser('mia'), name: 'Mia' };
			await registerUser(page, mia);
			mark('registered');
			const spaceUrl = page.url();
			const spaceId = spaceUrl.split('/').pop() as string;

			withDb((db) => {
				db.prepare('UPDATE spaces SET name = ?, emoji = ? WHERE id = ?').run('home', '🏡', spaceId);
			});

			// The partner: registered, then seated at the table directly.
			const theo = { ...generateTestUser('theo'), name: 'Theo' };
			const partner = await browser.newContext(use);
			const partnerPage = await partner.newPage();
			await registerUser(partnerPage, theo);
			withDb((db) => {
				const user = db.prepare('SELECT id FROM users WHERE email = ?').get(theo.email) as {
					id: string;
				};
				db.prepare(
					'INSERT INTO space_members (space_id, user_id, role, joined_at) VALUES (?, ?, ?, ?)',
				).run(spaceId, user.id, 'member', nowSeconds());
			});

			mark('partner seated');
			// A few past days, so the scrapbook has pages.
			withDb((db) => {
				const ids = db
					.prepare('SELECT id, email FROM users WHERE email IN (?, ?)')
					.all(mia.email, theo.email) as { id: string; email: string }[];
				const by = (email: string) => ids.find((u) => u.email === email)?.id as string;
				const insert = db.prepare(
					'INSERT INTO items (id, canvas_id, space_id, author_id, type, text, x, y, z, rotation, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
				);
				const L = LAYOUT[device];
				const days: [string, 'mia' | 'theo', 'note' | 'emoji', Spot][][] = [
					[
						['rain all afternoon. made soup.', 'theo', 'note', L.image],
						['left the good mug out for you', 'mia', 'note', L.peach],
						['🌧️', 'mia', 'emoji', { ...L.walked, x: L.walked.x + 300, rotation: 6 }],
						['🍲', 'theo', 'emoji', { ...L.link, x: L.link.x + 200 }],
					],
					[
						['the lemon tree has a lemon', 'mia', 'note', L.link],
						['🍋', 'theo', 'emoji', L.frog],
					],
					[
						['first swim of the year', 'theo', 'note', L.image],
						['🌊', 'mia', 'emoji', L.frog],
						['cold. worth it.', 'mia', 'note', L.walked],
					],
				];
				days.forEach((things, daysAgo) => {
					const d = new Date();
					d.setUTCDate(d.getUTCDate() - (daysAgo + 1));
					const date = d.toISOString().slice(0, 10);
					const t = nowSeconds() - 86_400 * (daysAgo + 1);
					const canvasId = crypto.randomUUID();
					db.prepare(
						'INSERT INTO canvases (id, space_id, date, created_at) VALUES (?, ?, ?, ?)',
					).run(canvasId, spaceId, date, t);
					things.forEach(([text, who, type, spot], z) => {
						insert.run(
							crypto.randomUUID(),
							canvasId,
							spaceId,
							by(who === 'mia' ? mia.email : theo.email),
							type,
							text,
							spot.x,
							spot.y,
							z + 1,
							spot.rotation,
							t + z,
						);
					});
				});
			});

			// Today's board.
			await page.goto(spaceUrl);
			await drop(page, 'peaches from the market are on the counter 🍑');
			await expect(page.getByText(/peaches from the market/)).toBeVisible();
			await drop(page, 'https://en.wikipedia.org/wiki/Golden_hour_(photography)');
			await expect(page.getByText(/golden hour/i).first()).toBeVisible({ timeout: 20_000 });

			mark('link');
			const photoPage = await partner.newPage();
			await photoPage.setViewportSize({ width: 1200, height: 900 });
			await photoPage.setContent(PHOTO_SVG);
			const photo = await photoPage.screenshot({ type: 'jpeg', quality: 88 });
			await photoPage.close();
			await partnerPage.goto(spaceUrl);
			await partnerPage
				.getByLabel('Photo file')
				.setInputFiles({ name: 'sunset.jpg', mimeType: 'image/jpeg', buffer: photo });
			await expect(partnerPage.locator('.react-flow__node img').first()).toBeVisible({
				timeout: 20_000,
			});
			mark('photo');
			await partnerPage.getByTestId('composer-input').fill('walked home the long way');
			await partnerPage.getByRole('button', { name: /^drop$/i }).click();
			const plus = partnerPage.getByRole('button', { name: /add to the board/i });
			if (await plus.isVisible()) await plus.click();
			await partnerPage.getByRole('button', { name: /sticker tray/i }).click();
			await partnerPage.getByRole('button', { name: /drop 🐸 sticker/i }).click();
			await expect(partnerPage.locator('.react-flow__node').getByText('🐸')).toBeVisible();

			mark('sticker');
			// Theo writes on the back of the peach note and leaves a reaction.
			const peach = partnerPage
				.locator('.react-flow__node')
				.filter({ hasText: /peaches from the market/ });
			await peach.getByTestId('card-badges').click({ force: true });
			await peach.getByPlaceholder(/write on the back/i).fill('saving one for you');
			await peach.getByPlaceholder(/write on the back/i).press('Enter');
			await expect(peach.getByText('saving one for you').first()).toBeVisible();
			await peach.getByRole('button', { name: '🫶', exact: false }).click();

			mark('thread');
			withDb((db) => {
				const L = LAYOUT[device];
				const put = db.prepare(
					'UPDATE items SET x = ?, y = ?, rotation = ? WHERE space_id = ? AND type = ? AND deleted_at IS NULL AND (text LIKE ? OR ? IS NULL)',
				);
				put.run(L.image.x, L.image.y, L.image.rotation, spaceId, 'image', '%', null);
				put.run(L.link.x, L.link.y, L.link.rotation, spaceId, 'link', '%', null);
				put.run(L.frog.x, L.frog.y, L.frog.rotation, spaceId, 'emoji', '%', null);
				put.run(L.walked.x, L.walked.y, L.walked.rotation, spaceId, 'note', 'walked home%', 'x');
				put.run(L.peach.x, L.peach.y, L.peach.rotation, spaceId, 'note', 'peaches%', 'x');
			});
			await page.reload();
			await expect(page.locator('.react-flow__node img').first()).toBeVisible({ timeout: 20_000 });
			await expect(page.locator('.react-flow__node').getByText('🐸')).toBeVisible();
			await page.waitForTimeout(1500);
			await shot('1-today');

			// The back of a card.
			const mine = page.locator('.react-flow__node').filter({ hasText: /peaches from the market/ });
			await mine.getByTestId('card-badges').click({ force: true });
			await expect(mine.getByText('saving one for you').first()).toBeVisible();
			await page.waitForTimeout(800);
			await shot('2-back-of-card');

			// Yesterday's page and the timeline.
			await page.goto(`${spaceUrl}/days`);
			await page.waitForTimeout(1200);
			await shot('3-timeline');
			await page.locator('a[href*="/days/"]').filter({ hasText: '4 things' }).click();
			await page.waitForURL(/\/days\/\d{4}-\d{2}-\d{2}$/);
			await expect(page.getByText('rain all afternoon. made soup.')).toBeVisible();
			await page.waitForTimeout(1200);
			await shot('4-yesterday');

			await partner.close();
		});
	});
}
