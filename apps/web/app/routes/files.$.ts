import { contentTypeFor, getObject, storageMode } from '~/lib/storage.server';
import type { Route } from './+types/files.$';

/** Serve local-driver uploads. With S3/R2 the bucket's public domain serves instead. */
export async function loader({ params }: Route.LoaderArgs) {
	if (storageMode !== 'local') {
		throw new Response('Not found', { status: 404 });
	}

	const key = params['*'] ?? '';
	if (!key || key.includes('..')) {
		throw new Response('Not found', { status: 404 });
	}

	const body = await getObject(key);
	if (!body) {
		throw new Response('Not found', { status: 404 });
	}

	return new Response(new Uint8Array(body), {
		headers: {
			'Content-Type': contentTypeFor(key),
			'Cache-Control': 'public, max-age=31536000, immutable',
		},
	});
}
