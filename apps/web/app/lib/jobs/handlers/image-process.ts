import { and, eq } from 'drizzle-orm';
import { db, schema } from '../../db/client.server';
import { contentTypeFor, getObject, putObject } from '../../storage.server';

const THUMB_SIZE = 480;
// A phone photo is ~4000px and several megabytes. Nothing on a canvas — or
// opened full screen on a retina display — needs more than this.
const ORIGINAL_MAX = 2400;
const BLURHASH_COMPONENTS = { x: 4, y: 3 } as const;

/**
 * Turn an uploaded original into board material: dimensions, a webp thumb,
 * and a blurhash for the bloom-in. Degrades gracefully — if sharp is
 * unavailable or the image is odd, the original alone still renders.
 */
export async function imageProcess({ itemId }: { itemId: string }): Promise<void> {
	const [original] = await db
		.select()
		.from(schema.itemAssets)
		.where(and(eq(schema.itemAssets.itemId, itemId), eq(schema.itemAssets.kind, 'original')));

	if (!original) return;

	const bytes = await getObject(original.storageKey);
	if (!bytes) {
		console.error(`[image] original missing for item ${itemId}`);
		return;
	}

	let sharp: typeof import('sharp');
	let encode: typeof import('blurhash').encode;
	try {
		sharp = (await import('sharp')).default;
		({ encode } = await import('blurhash'));
	} catch (error) {
		console.error('[image] sharp/blurhash unavailable — keeping original only:', error);
		return;
	}

	try {
		const image = sharp(bytes, { failOn: 'none' }).rotate();
		const meta = await image.metadata();

		// Thumb (contained, webp)
		const thumb = await image
			.clone()
			.resize(THUMB_SIZE, THUMB_SIZE, { fit: 'inside', withoutEnlargement: true })
			.webp({ quality: 78 })
			.toBuffer({ resolveWithObject: true });

		// Blurhash from a tiny raw render
		const raw = await image
			.clone()
			.resize(32, 32, { fit: 'inside' })
			.ensureAlpha()
			.raw()
			.toBuffer({ resolveWithObject: true });
		const blurhash = encode(
			new Uint8ClampedArray(raw.data),
			raw.info.width,
			raw.info.height,
			BLURHASH_COMPONENTS.x,
			BLURHASH_COMPONENTS.y,
		);

		const thumbKey = `${original.storageKey.replace(/\.[^.]+$/, '')}-thumb.webp`;
		await putObject(thumbKey, thumb.data, contentTypeFor(thumbKey));

		// Store a sensible original: the upload is re-encoded down to
		// ORIGINAL_MAX (same format, same key) when it's larger than that.
		let width = meta.width ?? null;
		let height = meta.height ?? null;
		const longest = Math.max(meta.width ?? 0, meta.height ?? 0);
		if (longest > ORIGINAL_MAX) {
			const capped = await image
				.clone()
				.resize(ORIGINAL_MAX, ORIGINAL_MAX, { fit: 'inside', withoutEnlargement: true })
				.toBuffer({ resolveWithObject: true });
			await putObject(original.storageKey, capped.data, contentTypeFor(original.storageKey));
			width = capped.info.width;
			height = capped.info.height;
		}

		await db
			.update(schema.itemAssets)
			.set({ width, height, blurhash })
			.where(eq(schema.itemAssets.id, original.id));

		await db.insert(schema.itemAssets).values({
			itemId,
			kind: 'thumb',
			storageKey: thumbKey,
			width: thumb.info.width,
			height: thumb.info.height,
			blurhash,
		});
	} catch (error) {
		console.error(`[image] processing failed for item ${itemId}:`, error);
	}
}
