import fs from 'node:fs/promises';
import path from 'node:path';
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { env } from './env.server';

/**
 * Storage driver: any S3-compatible bucket (Cloudflare R2, MinIO) when S3_*
 * env is set, local disk otherwise (served via /files/*). Keys always carry a
 * file extension so content types survive without a sidecar.
 */

const useS3 = Boolean(env.S3_BUCKET && env.S3_ACCESS_KEY_ID && env.S3_SECRET_ACCESS_KEY);

const LOCAL_DIR = path.resolve(process.cwd(), 'data', 'uploads');

let s3: S3Client | null = null;

function getS3(): S3Client {
	if (!s3) {
		s3 = new S3Client({
			region: env.S3_REGION,
			endpoint: env.S3_ENDPOINT,
			forcePathStyle: Boolean(env.S3_ENDPOINT), // MinIO & R2 custom endpoints
			credentials: {
				accessKeyId: env.S3_ACCESS_KEY_ID as string,
				secretAccessKey: env.S3_SECRET_ACCESS_KEY as string,
			},
		});
	}
	return s3;
}

function safeLocalPath(key: string): string {
	const resolved = path.resolve(LOCAL_DIR, key);
	if (!resolved.startsWith(LOCAL_DIR + path.sep)) {
		throw new Response('Bad key', { status: 400 });
	}
	return resolved;
}

export const MIME_BY_EXT: Record<string, string> = {
	png: 'image/png',
	jpg: 'image/jpeg',
	jpeg: 'image/jpeg',
	webp: 'image/webp',
	gif: 'image/gif',
	avif: 'image/avif',
	svg: 'image/svg+xml',
};

export function contentTypeFor(key: string): string {
	const ext = key.split('.').pop()?.toLowerCase() ?? '';
	return MIME_BY_EXT[ext] ?? 'application/octet-stream';
}

export async function putObject(key: string, body: Buffer, contentType: string): Promise<void> {
	if (useS3) {
		await getS3().send(
			new PutObjectCommand({
				Bucket: env.S3_BUCKET,
				Key: key,
				Body: body,
				ContentType: contentType,
				CacheControl: 'public, max-age=31536000, immutable',
			}),
		);
		return;
	}
	const filePath = safeLocalPath(key);
	await fs.mkdir(path.dirname(filePath), { recursive: true });
	await fs.writeFile(filePath, body);
}

export async function getObject(key: string): Promise<Buffer | null> {
	if (useS3) {
		try {
			const result = await getS3().send(new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: key }));
			const bytes = await result.Body?.transformToByteArray();
			return bytes ? Buffer.from(bytes) : null;
		} catch {
			return null;
		}
	}
	try {
		return await fs.readFile(safeLocalPath(key));
	} catch {
		return null;
	}
}

/** Public URL for a stored object. */
export function publicUrl(key: string): string {
	if (useS3) {
		if (env.S3_PUBLIC_URL) {
			return `${env.S3_PUBLIC_URL.replace(/\/$/, '')}/${key}`;
		}
		return `${env.S3_ENDPOINT?.replace(/\/$/, '')}/${env.S3_BUCKET}/${key}`;
	}
	return `/files/${key}`;
}

export const storageMode = useS3 ? 's3' : 'local';
