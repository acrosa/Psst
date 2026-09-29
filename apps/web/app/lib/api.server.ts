import crypto from 'node:crypto';
import { type SessionUser, getUser, isLetIn } from './auth.server';
import { formatWeek } from './dates';
import { appUrl } from './env.server';
import { SHEET, composeLetterPage, letterPathData } from './hand';
import { parseLetter } from './letter';
import type { BoardItem } from './services/canvases.server';
import { publicUrl } from './storage.server';

/**
 * The native clients' JSON surface (`/api/v1/*`). Routes stay thin — parse,
 * call a service, answer JSON — and these helpers keep them that way: auth
 * that answers 401/403 instead of redirecting, service errors as `{ error }`,
 * absolute asset URLs, and ETags so a poll that finds nothing new is cheap.
 */

const HICCUP = 'Something hiccuped on our end — try again in a moment.';

/** Signed in and let in — or a JSON 401/403, never a redirect to a web page. */
export async function requireApiUser(
	request: Request,
	{ allowWaitlisted = false }: { allowWaitlisted?: boolean } = {},
): Promise<SessionUser> {
	const user = await getUser(request);
	if (!user) {
		throw Response.json({ error: 'Sign in first.' }, { status: 401 });
	}
	if (!allowWaitlisted && !(await isLetIn(user))) {
		throw Response.json(
			{ error: 'You’re on the list — we’ll let you in soon.', waitlisted: true },
			{ status: 403 },
		);
	}
	return user;
}

/**
 * Run a handler and answer JSON whatever happens. Services throw 4xx
 * Responses with friendly text ("Notes stay small…") — those become
 * `{ error }` with the same status, shown to the person verbatim. Anything
 * else is logged and answered with a hiccup; 5xx internals never leak.
 */
export async function api(run: () => Promise<unknown>): Promise<Response> {
	try {
		const result = await run();
		return result instanceof Response ? result : Response.json(result ?? { ok: true });
	} catch (error) {
		if (error instanceof Response) {
			if (error.headers.get('content-type')?.includes('application/json')) return error;
			if (error.status >= 400 && error.status < 500) {
				const text = (await error.text()).trim();
				return Response.json(
					{ error: text && text !== 'Not found' ? text : 'That wandered off.' },
					{ status: error.status },
				);
			}
		}
		console.error('[api]', error);
		return Response.json({ error: HICCUP }, { status: 500 });
	}
}

/** 405 for a method the route doesn't answer. */
export function methodNotAllowed(): Response {
	return Response.json({ error: 'Not here.' }, { status: 405 });
}

/** Asset keys → absolute URLs, so out-of-origin clients can fetch them. */
export function absoluteAssetUrl(key: string): string {
	return new URL(publicUrl(key), appUrl).toString();
}

/**
 * JSON with a weak ETag over the body. A poll whose `If-None-Match` still
 * matches gets an empty 304 — the board hasn't changed, nothing to decode.
 */
export function jsonWithETag(request: Request, body: unknown): Response {
	const text = JSON.stringify(body);
	const etag = `W/"${crypto.createHash('sha1').update(text).digest('base64url')}"`;
	const headers = new Headers({ ETag: etag, 'Cache-Control': 'private, no-cache' });
	const seen = request.headers
		.get('if-none-match')
		?.split(',')
		.map((tag) => tag.trim());
	if (seen?.includes(etag) || seen?.includes('*')) {
		return new Response(null, { status: 304, headers });
	}
	headers.set('Content-Type', 'application/json; charset=utf-8');
	return new Response(text, { status: 200, headers });
}

/** A JSON object body, or a friendly 400. */
export async function readJson(request: Request): Promise<Record<string, unknown>> {
	const body = await request.json().catch(() => null);
	if (!body || typeof body !== 'object' || Array.isArray(body)) {
		throw new Response('That request didn’t make sense.', { status: 400 });
	}
	return body as Record<string, unknown>;
}

export function optionalNumber(value: unknown): number | undefined {
	return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

/** A drop position when both coordinates are real numbers; else auto-placement. */
export function optionalPosition(x: unknown, y: unknown) {
	const px = typeof x === 'string' ? Number.parseFloat(x) : optionalNumber(x);
	const py = typeof y === 'string' ? Number.parseFloat(y) : optionalNumber(y);
	return px !== undefined && py !== undefined && Number.isFinite(px) && Number.isFinite(py)
		? { x: px, y: py }
		: undefined;
}

/** The Sunday letter, pre-drawn: the hand's path in the sheet's mm space. */
export type NativeLetter = {
	d: string;
	width: number;
	height: number;
	postmark: string;
};

export type NativeBoardItem = BoardItem & { letter?: NativeLetter | null };

/**
 * Board items as the native board reads them. The letter's hand is 1,000
 * lines of glyph geometry — rather than port it, send the exact path the
 * web draws, so every device shows the same ink.
 */
export function nativeItems(items: BoardItem[]): NativeBoardItem[] {
	return items.map((item) => {
		if (item.type !== 'letter') return item;
		const letter = parseLetter(item.text);
		if (!letter) return { ...item, letter: null };
		const d = letterPathData(
			composeLetterPage({
				dateLabel: formatWeek(letter.weekStart),
				greeting: letter.greeting,
				lines: letter.lines,
				close: letter.close,
				sign: letter.sign,
				seed: letter.seed,
			}),
		);
		return {
			...item,
			letter: {
				d,
				width: SHEET.wMm,
				height: SHEET.hMm,
				postmark: `the week of ${formatWeek(letter.weekStart)}`,
			},
		};
	});
}
