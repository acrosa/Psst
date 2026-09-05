/**
 * Vendored from folio-hand (https://github.com/clodoan/folio), MIT License,
 * Copyright (c) 2026 Claudio Angrigiani. Adapted for psst: supersampled, with
 * the sheet's fold creases, so the email's picture matches the board's.
 *
 * A pure-JS rasteriser and PNG encoder — no canvas, only node:zlib. Server
 * only (Buffer): the browser draws the same page as SVG.
 */

import { deflateSync } from 'node:zlib';
import type { LetterPage } from './letter-page';

function crc32(buf: Buffer): number {
	let c = ~0;
	for (let i = 0; i < buf.length; i++) {
		c ^= buf[i];
		for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
	}
	return ~c >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
	const t = Buffer.from(type);
	const len = Buffer.alloc(4);
	len.writeUInt32BE(data.length);
	const body = Buffer.concat([t, data]);
	const crc = Buffer.alloc(4);
	crc.writeUInt32BE(crc32(body));
	return Buffer.concat([len, body, crc]);
}

function hexRgb(hex: string): [number, number, number] {
	const h = hex.replace('#', '');
	return [
		Number.parseInt(h.slice(0, 2), 16),
		Number.parseInt(h.slice(2, 4), 16),
		Number.parseInt(h.slice(4, 6), 16),
	];
}

/** Scanline fill of a polygon (pixel coordinates), multiplying the ink in. */
function fillPoly(px: Buffer, W: number, H: number, pts: [number, number][], rgb: number[]) {
	const n = pts.length;
	if (n < 3) return;
	let minY = H;
	let maxY = 0;
	for (const p of pts) {
		minY = Math.min(minY, p[1]);
		maxY = Math.max(maxY, p[1]);
	}
	minY = Math.max(0, Math.floor(minY));
	maxY = Math.min(H - 1, Math.ceil(maxY));
	for (let y = minY; y <= maxY; y++) {
		const ys = y + 0.5;
		const xs: number[] = [];
		for (let i = 0; i < n; i++) {
			const [x0, y0] = pts[i];
			const [x1, y1] = pts[(i + 1) % n];
			if ((y0 <= ys && y1 > ys) || (y1 <= ys && y0 > ys)) {
				const t = (ys - y0) / (y1 - y0 || 1e-9);
				xs.push(x0 + t * (x1 - x0));
			}
		}
		xs.sort((a, b) => a - b);
		for (let k = 0; k + 1 < xs.length; k += 2) {
			const xa = Math.max(0, Math.floor(xs[k]));
			const xb = Math.min(W - 1, Math.ceil(xs[k + 1]));
			for (let x = xa; x <= xb; x++) {
				const i = (y * W + x) * 3;
				px[i] = (px[i] * rgb[0]) / 255;
				px[i + 1] = (px[i + 1] * rgb[1]) / 255;
				px[i + 2] = (px[i + 2] * rgb[2]) / 255;
			}
		}
	}
}

/**
 * Render the sheet to a PNG. Draws at twice the size and averages down, so
 * the thin ribbons get real anti-aliasing from a plain scanline fill.
 */
export function pageToPng(
	page: LetterPage,
	pxW: number,
	pxH: number,
	colors: { ink: string; paper: string; crease: string },
): Buffer {
	const ss = 2;
	const W = pxW * ss;
	const H = pxH * ss;
	const { wMm, hMm } = page.sheet;
	const sx = W / wMm;
	const sy = H / hMm;

	const px = Buffer.alloc(W * H * 3);
	const paper = hexRgb(colors.paper);
	for (let i = 0; i < px.length; i += 3) {
		px[i] = paper[0];
		px[i + 1] = paper[1];
		px[i + 2] = paper[2];
	}

	// Two faint fold creases at thirds — the sheet came out of an envelope.
	const crease = hexRgb(colors.crease);
	for (const third of [1 / 3, 2 / 3]) {
		const y0 = Math.round(H * third);
		for (let y = y0; y < y0 + ss; y++) {
			for (let x = 0; x < W; x++) {
				const i = (y * W + x) * 3;
				px[i] = crease[0];
				px[i + 1] = crease[1];
				px[i + 2] = crease[2];
			}
		}
	}

	const ink = hexRgb(colors.ink);
	for (const ribbon of page.ribbons) {
		fillPoly(
			px,
			W,
			H,
			ribbon.map(([x, y]) => [x * sx, (hMm - y) * sy]),
			ink,
		);
	}

	// Box-filter down to the target size, one filtered scanline per row.
	const raw = Buffer.alloc((pxW * 3 + 1) * pxH);
	for (let y = 0; y < pxH; y++) {
		const row = y * (pxW * 3 + 1);
		raw[row] = 0;
		for (let x = 0; x < pxW; x++) {
			let r = 0;
			let g = 0;
			let b = 0;
			for (let dy = 0; dy < ss; dy++) {
				for (let dx = 0; dx < ss; dx++) {
					const i = ((y * ss + dy) * W + x * ss + dx) * 3;
					r += px[i];
					g += px[i + 1];
					b += px[i + 2];
				}
			}
			const o = row + 1 + x * 3;
			raw[o] = r / (ss * ss);
			raw[o + 1] = g / (ss * ss);
			raw[o + 2] = b / (ss * ss);
		}
	}

	const ihdr = Buffer.alloc(13);
	ihdr.writeUInt32BE(pxW, 0);
	ihdr.writeUInt32BE(pxH, 4);
	ihdr[8] = 8; // bit depth
	ihdr[9] = 2; // colour type: RGB
	return Buffer.concat([
		Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
		chunk('IHDR', ihdr),
		chunk('IDAT', deflateSync(raw, { level: 6 })),
		chunk('IEND', Buffer.alloc(0)),
	]);
}
