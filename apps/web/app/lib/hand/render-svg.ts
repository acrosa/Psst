/**
 * Vendored from folio-hand (https://github.com/clodoan/folio), MIT License,
 * Copyright (c) 2026 Claudio Angrigiani. Adapted for psst.
 *
 * The page as SVG path data — one `d` for every ribbon, so a letter is a
 * single <path> filled with the ink token. Browser-safe: no Node imports.
 */

import type { LetterPage } from './letter-page';
import type { Ribbon } from './writer';

/** Points closer than this to the chord between their neighbours are dropped (mm). */
const EPSILON = 0.012;

/**
 * Douglas–Peucker: keep the points that give a polyline its shape, drop the
 * ones a smooth curve produced along the way. Chaikin leaves ribbons far
 * denser than any eye can tell, and a board holds the letter as one string.
 */
function simplify(points: Ribbon): Ribbon {
	if (points.length < 4) return points;
	const keep = new Uint8Array(points.length);
	keep[0] = 1;
	keep[points.length - 1] = 1;
	const stack: [number, number][] = [[0, points.length - 1]];
	while (stack.length) {
		const [a, b] = stack.pop() as [number, number];
		const [ax, ay] = points[a];
		const [bx, by] = points[b];
		const dx = bx - ax;
		const dy = by - ay;
		const len = Math.hypot(dx, dy) || 1e-9;
		let worst = -1;
		let worstDist = EPSILON;
		for (let i = a + 1; i < b; i++) {
			const [px, py] = points[i];
			const dist = Math.abs(dy * px - dx * py + bx * ay - by * ax) / len;
			if (dist > worstDist) {
				worstDist = dist;
				worst = i;
			}
		}
		if (worst > 0) {
			keep[worst] = 1;
			stack.push([a, worst], [worst, b]);
		}
	}
	return points.filter((_, i) => keep[i]);
}

/** All ribbons as one path, y flipped from the hand's y-up millimetres. */
export function letterPathData(page: LetterPage): string {
	const h = page.sheet.hMm;
	const parts: string[] = [];
	for (const ribbon of page.ribbons) {
		const pts = simplify(ribbon);
		if (pts.length < 3) continue;
		let d = '';
		for (let i = 0; i < pts.length; i++) {
			const [x, y] = pts[i];
			d += `${i === 0 ? 'M' : 'L'}${x.toFixed(2)} ${(h - y).toFixed(2)}`;
		}
		parts.push(`${d}Z`);
	}
	return parts.join('');
}
