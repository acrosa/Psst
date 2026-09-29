import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { PlaywrightWorkerArgs } from '@playwright/test';
import { acceptUser, nowSeconds, withDb } from './db-helpers';
import { expect, generateTestUser, test } from './fixtures';

/**
 * The native board's JSON surface, exercised the way the iOS app uses it:
 * bearer tokens only, no cookies, no browser. With PSST_WRITE_FIXTURES=1 the
 * payloads are written to apps/ios/Psst/Fixtures/ for the Swift decoding tests.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = path.join(here, '..', '..', 'ios', 'Psst', 'Fixtures');

// 1×1 red PNG
const TINY_PNG = Buffer.from(
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
	'base64',
);

function writeFixture(name: string, body: unknown) {
	if (!process.env.PSST_WRITE_FIXTURES) return;
	fs.mkdirSync(FIXTURES_DIR, { recursive: true });
	fs.writeFileSync(
		path.join(FIXTURES_DIR, `${name}.json`),
		`${JSON.stringify(body, null, '\t')}\n`,
	);
}

/**
 * Sign up the way the app does and let them in. The sign-up runs in its own
 * throwaway context; every later call goes through a context that has never
 * held a cookie, so only the bearer token can vouch for us.
 */
async function signUpNative(
	playwright: PlaywrightWorkerArgs['playwright'],
	{ accept = true } = {},
) {
	const baseURL = test.info().project.use.baseURL ?? '';
	const user = generateTestUser('native');
	const door = await playwright.request.newContext({ baseURL });
	const response = await door.post('/api/auth/sign-up/email', {
		data: { name: user.name, email: user.email, password: user.password },
		headers: { Origin: new URL(baseURL).origin },
	});
	expect(response.ok()).toBeTruthy();
	const token = response.headers()['set-auth-token'];
	await door.dispose();
	expect(token).toBeTruthy();
	if (accept) acceptUser(user.email);
	const request = await playwright.request.newContext({
		baseURL,
		extraHTTPHeaders: { Authorization: `Bearer ${token}` },
	});
	return { user, request };
}

test.describe('api v1', () => {
	// Bearer-only, like the app: never let a cookie jar vouch for us.
	test.use({ storageState: { cookies: [], origins: [] } });

	test('without a session: JSON 401, never a redirect', async ({ request }) => {
		const response = await request.get('/api/v1/me', { maxRedirects: 0 });
		expect(response.status()).toBe(401);
		expect(await response.json()).toEqual({ error: 'Sign in first.' });
	});

	test('the waitlist answers 403 with a flag, and /me still says who you are', async ({
		playwright,
	}) => {
		const { request } = await signUpNative(playwright, { accept: false });

		const spaces = await request.get('/api/v1/spaces');
		expect(spaces.status()).toBe(403);
		expect((await spaces.json()).waitlisted).toBe(true);

		const me = await request.get('/api/v1/me');
		expect(me.ok()).toBeTruthy();
		const body = await me.json();
		expect(body.waitlisted).toBe(true);
		expect(body.spaces).toEqual([]);
		expect(body.flags.nativeBoard).toBe('auto');
	});

	test('a whole day on the native board', async ({ playwright }) => {
		const { user, request } = await signUpNative(playwright);

		// Onboarding: the first canvas.
		const created = await request.post('/api/v1/spaces', {
			data: { name: 'our little corner', emoji: '🌷', timezone: 'UTC' },
		});
		expect(created.status()).toBe(201);
		const spaceId = (await created.json()).space.id as string;

		const me = await (await request.get('/api/v1/me')).json();
		expect(me.user.email).toBe(user.email);
		expect(me.waitlisted).toBe(false);
		expect(me.spaces.map((space: { id: string }) => space.id)).toEqual([spaceId]);
		writeFixture('me', me);

		// Drop one of each JSON kind; a note pinned where it was dropped.
		const drop = (data: Record<string, unknown>) =>
			request.post(`/api/v1/spaces/${spaceId}/items`, { data });
		const note = await drop({ kind: 'note', content: 'a tiny cabin by the lake', x: 40, y: 60 });
		expect(note.status()).toBe(201);
		const noteId = (await note.json()).item.id as string;
		expect((await drop({ kind: 'emoji', content: '🐸' })).status()).toBe(201);
		expect((await drop({ kind: 'link', content: 'https://example.com/cabin' })).status()).toBe(201);
		expect(
			(
				await drop({
					kind: 'drawing',
					content: JSON.stringify({ color: '#e2725b', d: 'M 8 8 L 40 30 L 80 12', w: 88, h: 38 }),
				})
			).status(),
		).toBe(201);

		// Service copy comes through verbatim.
		const tooLong = await drop({ kind: 'note', content: 'x'.repeat(1001) });
		expect(tooLong.status()).toBe(400);
		expect((await tooLong.json()).error).toBe('Notes stay small — under 1000 characters.');
		expect((await drop({ kind: 'confetti', content: '' })).status()).toBe(400);

		// A photo and a voice note, multipart.
		const photo = await request.post(`/api/v1/spaces/${spaceId}/items`, {
			multipart: {
				kind: 'image',
				file: { name: 'tiny.png', mimeType: 'image/png', buffer: TINY_PNG },
				x: '400',
				y: '40',
			},
		});
		expect(photo.status()).toBe(201);
		const voice = await request.post(`/api/v1/spaces/${spaceId}/items`, {
			multipart: {
				kind: 'audio',
				file: { name: 'voice.m4a', mimeType: 'audio/mp4', buffer: Buffer.from('fake-aac') },
				content: JSON.stringify({ duration: 3.2, peaks: [0.2, 0.9, 0.5] }),
			},
		});
		expect(voice.status()).toBe(201);

		// Arrange, react, write on the back.
		const item = (id: string) => `/api/v1/items/${id}`;
		expect((await request.patch(item(noteId), { data: { x: 120, y: 90 } })).ok()).toBe(true);
		expect((await request.patch(item(noteId), { data: { scale: 9 } })).ok()).toBe(true);
		expect((await request.patch(item(noteId), { data: {} })).status()).toBe(400);
		const like = await request.post(`${item(noteId)}/reactions`, {
			data: { emoji: '🫶' },
		});
		expect(await like.json()).toEqual({ reacted: true });
		const comment = await request.post(`${item(noteId)}/comments`, {
			data: { text: 'saturday?' },
		});
		expect(comment.status()).toBe(201);
		const tooChatty = await request.post(`${item(noteId)}/comments`, {
			data: { text: 'y'.repeat(281) },
		});
		expect((await tooChatty.json()).error).toMatch(/280 characters/);

		// psst's letter arrives pre-drawn.
		withDb((db) => {
			db.prepare(
				"INSERT OR IGNORE INTO users (id, email, name, accepted_at) VALUES ('psst', 'letters@psst.you', 'psst', ?)",
			).run(nowSeconds());
			const canvas = db.prepare('SELECT id FROM canvases WHERE space_id = ?').get(spaceId) as {
				id: string;
			};
			db.prepare(
				'INSERT INTO items (id, canvas_id, space_id, author_id, type, text, x, y, z, rotation, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
			).run(
				randomUUID(),
				canvas.id,
				spaceId,
				'psst',
				'letter',
				JSON.stringify({
					v: 1,
					weekStart: '2026-09-21',
					weekEnd: '2026-09-27',
					seed: 42,
					greeting: 'dear corner,',
					lines: ['a cabin, a frog, a radio.'],
					close: 'see you sunday',
					sign: 'psst',
				}),
				-40,
				-20,
				99,
				1,
				nowSeconds(),
			);
		});

		// The board, with an ETag that makes the next poll free.
		const board = await request.get(`/api/v1/spaces/${spaceId}/board`);
		expect(board.ok()).toBeTruthy();
		const etag = board.headers().etag;
		expect(etag).toMatch(/^W\/"/);
		const payload = await board.json();
		writeFixture('board', payload);

		expect(payload.role).toBe('owner');
		expect(payload.board.frozen).toBe(false);
		const types = payload.board.items.map((i: { type: string }) => i.type).sort();
		expect(types).toEqual(['audio', 'drawing', 'emoji', 'image', 'letter', 'link', 'note']);
		const moved = payload.board.items.find((i: { id: string }) => i.id === noteId);
		expect(moved).toMatchObject({ x: 120, y: 90, scale: 1.75 });
		expect(moved.reactions).toEqual([{ emoji: '🫶', userId: me.user.id }]);
		expect(moved.comments[0].text).toBe('saturday?');
		const print = payload.board.items.find((i: { type: string }) => i.type === 'image');
		expect(print.assets[0].url).toMatch(/^http/);
		const letter = payload.board.items.find((i: { type: string }) => i.type === 'letter');
		expect(letter.letter).toMatchObject({ width: 120, height: 150 });
		expect(letter.letter.d).toMatch(/^M[\d.]+ [\d.]+L/);
		expect(letter.letter.postmark).toMatch(/^the week of /);

		const again = await request.get(`/api/v1/spaces/${spaceId}/board`, {
			headers: { 'If-None-Match': etag },
		});
		expect(again.status()).toBe(304);

		// Take my own note back; the board changes, so the ETag does too.
		expect((await request.delete(item(noteId))).ok()).toBe(true);
		const after = await request.get(`/api/v1/spaces/${spaceId}/board`, {
			headers: { 'If-None-Match': etag },
		});
		expect(after.status()).toBe(200);
		expect((await after.json()).board.items).toHaveLength(6);
		expect((await request.patch(item(noteId), { data: { x: 1, y: 1 } })).status()).toBe(404);
	});

	test('the space around the board: timeline, sharing, invites, settings', async ({
		playwright,
	}) => {
		const owner = await signUpNative(playwright);
		const guest = await signUpNative(playwright);
		const created = await owner.request.post('/api/v1/spaces', {
			data: { name: 'weekend plans', emoji: '🐸', timezone: 'UTC' },
		});
		const spaceId = (await created.json()).space.id as string;

		// Strangers can't peek: 404, not 403.
		const peek = await guest.request.get(`/api/v1/spaces/${spaceId}`);
		expect(peek.status()).toBe(404);

		// Yesterday, fabricated, is in the scrapbook and frozen.
		const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
		withDb((db) => {
			const ownerRow = db.prepare('SELECT id FROM users WHERE email = ?').get(owner.user.email) as {
				id: string;
			};
			const canvasId = randomUUID();
			db.prepare('INSERT INTO canvases (id, space_id, date, created_at) VALUES (?, ?, ?, ?)').run(
				canvasId,
				spaceId,
				yesterday,
				nowSeconds() - 86_400,
			);
			db.prepare(
				'INSERT INTO items (id, canvas_id, space_id, author_id, type, text, x, y, z, rotation, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
			).run(
				randomUUID(),
				canvasId,
				spaceId,
				ownerRow.id,
				'note',
				'a yesterday thought',
				40,
				40,
				1,
				-1.5,
				nowSeconds() - 86_400,
			);
		});
		const days = await (await owner.request.get(`/api/v1/spaces/${spaceId}/days`)).json();
		expect(days.days).toEqual([
			{ date: yesterday, count: 1, peeks: [{ type: 'note', text: 'a yesterday thought' }] },
		]);
		writeFixture('days', days);
		const day = await (
			await owner.request.get(`/api/v1/spaces/${spaceId}/days/${yesterday}`)
		).json();
		expect(day.board.frozen).toBe(true);
		const frozenId = day.board.items[0].id as string;
		const frozenMove = await owner.request.patch(`/api/v1/items/${frozenId}`, {
			data: { x: 1, y: 1 },
		});
		expect(frozenMove.status()).toBe(409);
		expect((await frozenMove.json()).error).toMatch(/archived/);

		// Share today, then take it back.
		const shared = await owner.request.post(`/api/v1/spaces/${spaceId}/share`);
		expect((await shared.json()).url).toMatch(/\/b\/[\w-]+$/);
		const unshared = await owner.request.delete(`/api/v1/spaces/${spaceId}/share`);
		expect(await unshared.json()).toEqual({ shared: false });

		// An invite link, accepted from the app; the guest can then leave.
		const invite = await owner.request.post(`/api/v1/spaces/${spaceId}/invites`);
		expect(invite.status()).toBe(201);
		const token = (await invite.json()).url.split('/invite/')[1] as string;
		const accepted = await guest.request.post(`/api/v1/invites/${token}/accept`);
		expect(await accepted.json()).toEqual({ status: 'joined', spaceId });
		// Each link seats one person — the app words the sad case warmly.
		const reused = await owner.request.post(`/api/v1/invites/${token}/accept`);
		expect(reused.status()).toBe(410);
		expect((await reused.json()).status).toBe('used');

		// An emailed invite shows as pending in settings; revoking clears it.
		await owner.request.post(`/api/v1/spaces/${spaceId}/invites`, {
			data: { email: 'friend@example.com' },
		});
		const settings = await (await owner.request.get(`/api/v1/spaces/${spaceId}`)).json();
		expect(settings.role).toBe('owner');
		expect(settings.members).toHaveLength(2);
		expect(settings.invites.map((i: { email: string }) => i.email)).toEqual(['friend@example.com']);
		const revoke = await owner.request.delete(
			`/api/v1/spaces/${spaceId}/invites/${settings.invites[0].id}`,
		);
		expect(revoke.ok()).toBe(true);

		// Only the owner renames; the owner can't leave.
		const guestRename = await guest.request.patch(`/api/v1/spaces/${spaceId}`, {
			data: { name: 'mine now' },
		});
		expect(guestRename.status()).toBe(403);
		const rename = await owner.request.patch(`/api/v1/spaces/${spaceId}`, {
			data: { name: 'long weekend', emoji: '🌈' },
		});
		expect((await rename.json()).space).toMatchObject({ name: 'long weekend', emoji: '🌈' });
		expect((await owner.request.delete(`/api/v1/spaces/${spaceId}/members/me`)).status()).toBe(409);
		expect((await guest.request.delete(`/api/v1/spaces/${spaceId}/members/me`)).ok()).toBe(true);
	});
});
