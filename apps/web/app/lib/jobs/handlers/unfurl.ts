import { eq } from 'drizzle-orm';
import { db, schema } from '../../db/client.server';

/**
 * Unfurl a link item into postcard material: OpenGraph/twitter meta, <title>,
 * favicon — with opportunistic oEmbed for music/video providers. "Never a
 * bare URL" is the product, so failures still resolve to a stamped fallback
 * (status 'failed' renders as a simple domain postcard).
 */

const MAX_BYTES = 2 * 1024 * 1024;
const TIMEOUT_MS = 10_000;
const USER_AGENT = 'Mozilla/5.0 (compatible; psst/1.0; link preview)';

function decodeEntities(value: string): string {
	return value
		.replace(/&amp;/g, '&')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&#x27;|&#39;|&apos;/g, "'")
		.replace(/&nbsp;/g, ' ');
}

function attr(tag: string, name: string): string | undefined {
	const match = tag.match(new RegExp(`${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'i'));
	return match ? (match[1] ?? match[2]) : undefined;
}

type PageMeta = {
	title?: string;
	description?: string;
	imageUrl?: string;
	faviconUrl?: string;
	siteName?: string;
};

function extractMeta(html: string, pageUrl: URL): PageMeta {
	const metas: Record<string, string> = {};
	for (const tag of html.match(/<meta\s[^>]*>/gi) ?? []) {
		const key = (attr(tag, 'property') ?? attr(tag, 'name'))?.toLowerCase();
		const content = attr(tag, 'content');
		if (key && content && !(key in metas)) {
			metas[key] = decodeEntities(content).trim();
		}
	}

	let faviconUrl: string | undefined;
	for (const tag of html.match(/<link\s[^>]*>/gi) ?? []) {
		const rel = attr(tag, 'rel')?.toLowerCase() ?? '';
		const href = attr(tag, 'href');
		if (href && /(^|\s)(icon|shortcut icon|apple-touch-icon)(\s|$)/.test(rel)) {
			faviconUrl = href;
			break;
		}
	}

	const titleTag = html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1];

	const resolve = (href: string | undefined) => {
		if (!href) return undefined;
		try {
			return new URL(href, pageUrl).toString();
		} catch {
			return undefined;
		}
	};

	return {
		title:
			metas['og:title'] ??
			metas['twitter:title'] ??
			(titleTag && decodeEntities(titleTag).trim()) ??
			undefined,
		description: metas['og:description'] ?? metas['twitter:description'] ?? metas.description,
		imageUrl: resolve(metas['og:image'] ?? metas['og:image:url'] ?? metas['twitter:image']),
		faviconUrl: resolve(faviconUrl) ?? new URL('/favicon.ico', pageUrl).toString(),
		siteName: metas['og:site_name'],
	};
}

async function readCapped(response: Response, cap: number): Promise<string> {
	const reader = response.body?.getReader();
	if (!reader) return '';
	const chunks: Uint8Array[] = [];
	let total = 0;
	while (total < cap) {
		const { done, value } = await reader.read();
		if (done) break;
		chunks.push(value);
		total += value.byteLength;
	}
	await reader.cancel().catch(() => {});
	const merged = new Uint8Array(Math.min(total, cap));
	let offset = 0;
	for (const chunk of chunks) {
		const slice = chunk.subarray(0, Math.max(0, merged.length - offset));
		merged.set(slice, offset);
		offset += slice.length;
		if (offset >= merged.length) break;
	}
	return new TextDecoder('utf-8', { fatal: false }).decode(merged);
}

/** oEmbed endpoints for the providers where album art matters most. */
function oembedEndpoint(url: URL): string | null {
	const host = url.hostname.replace(/^www\./, '');
	if (host === 'open.spotify.com') {
		return `https://open.spotify.com/oembed?url=${encodeURIComponent(url.toString())}`;
	}
	if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtu.be') {
		return `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url.toString())}`;
	}
	if (host === 'soundcloud.com') {
		return `https://soundcloud.com/oembed?format=json&url=${encodeURIComponent(url.toString())}`;
	}
	return null;
}

async function fetchOembed(url: URL): Promise<Partial<PageMeta>> {
	const endpoint = oembedEndpoint(url);
	if (!endpoint) return {};
	try {
		const response = await fetch(endpoint, {
			signal: AbortSignal.timeout(TIMEOUT_MS),
			headers: { 'user-agent': USER_AGENT },
		});
		if (!response.ok) return {};
		const data = (await response.json()) as {
			title?: string;
			thumbnail_url?: string;
			provider_name?: string;
		};
		return {
			title: data.title,
			imageUrl: data.thumbnail_url,
			siteName: data.provider_name,
		};
	} catch {
		return {};
	}
}

export async function unfurlFetch({ itemId }: { itemId: string }): Promise<void> {
	const [item] = await db.select().from(schema.items).where(eq(schema.items.id, itemId));
	if (!item || item.type !== 'link' || !item.url) return;

	const pageUrl = new URL(item.url);

	try {
		const [meta, oembed] = await Promise.all([
			(async () => {
				const response = await fetch(pageUrl, {
					signal: AbortSignal.timeout(TIMEOUT_MS),
					headers: { 'user-agent': USER_AGENT, accept: 'text/html,*/*;q=0.8' },
					redirect: 'follow',
				});
				if (!response.ok) {
					throw new Error(`HTTP ${response.status}`);
				}
				const finalUrl = new URL(response.url || pageUrl.toString());
				const html = await readCapped(response, MAX_BYTES);
				return extractMeta(html, finalUrl);
			})(),
			fetchOembed(pageUrl),
		]);

		await db
			.update(schema.itemUnfurls)
			.set({
				title: oembed.title ?? meta.title ?? null,
				description: meta.description ?? null,
				imageUrl: oembed.imageUrl ?? meta.imageUrl ?? null,
				faviconUrl: meta.faviconUrl ?? null,
				siteName: oembed.siteName ?? meta.siteName ?? pageUrl.hostname.replace(/^www\./, ''),
				status: 'ok',
				fetchedAt: new Date(),
			})
			.where(eq(schema.itemUnfurls.itemId, itemId));
	} catch (error) {
		console.error(`[unfurl] ${item.url} failed:`, error);
		await db
			.update(schema.itemUnfurls)
			.set({
				siteName: pageUrl.hostname.replace(/^www\./, ''),
				status: 'failed',
				fetchedAt: new Date(),
			})
			.where(eq(schema.itemUnfurls.itemId, itemId));
	}
}
