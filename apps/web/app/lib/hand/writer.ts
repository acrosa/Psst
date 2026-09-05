/**
 * Vendored from folio-hand (https://github.com/clodoan/folio), MIT License,
 * Copyright (c) 2026 Claudio Angrigiani. The method follows Amy Goodchild's
 * Chaikin + join-tag + shapify approach. Adapted for psst: TypeScript, extra
 * glyphs and marks, a letter-sized page.
 *
 * The writing engine. Pipeline for a word: pick a glyph option per letter →
 * adjust each to its neighbours' join tags → concatenate (tag 0 lifts the
 * pen) → Chaikin-smooth → jitter lightly with value noise → shapify into a
 * thin ribbon (near-constant width, a touch thicker toward the baseline,
 * round caps). Coordinates are y-up millimetres; renderers flip once.
 */

import { type GlyphPath, type PickedGlyph, type Pt, glyphCount, pickGlyph } from './glyphs';
import { type Rng, hashStr, rngFromSeed } from './seed';

export const MOTOR = {
	xHeightMm: 2.9,
	capMm: 6.44,
	tipMm: 0.25,
	slantDeg: 11,
	chaikin: 4,
};

export const HAND = {
	id: 'recipes-cursive-v1',
	slantDeg: MOTOR.slantDeg,
	capMm: MOTOR.capMm,
	letterTrackingCap: 0.12,
	wordSpaceCap: 0.46,
	leadingCap: 1.6,
	ascenderGain: 1.1,
	descenderGain: 1.16,
};

export type Ribbon = [number, number][];

export type WordPlacement = {
	ribbons: Ribbon[];
	xEnd: number;
	widthMm: number;
};

export type WriteContext = {
	pageSeed?: number;
	i?: number;
	fatigue?: number;
	capMm?: number;
	slantDeg?: number;
	xOnLine?: number;
	cluster?: number;
	chaikin?: number;
	trackingCap?: number;
};

function fade(t: number): number {
	return t * t * (3 - 2 * t);
}

function hash2(ix: number, iy: number): number {
	let n = Math.imul(ix | 0, 374761393) + Math.imul(iy | 0, 668265263);
	n = Math.imul(n ^ (n >>> 13), 1274126177);
	return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

/** Value noise, a Perlin stand-in for jitter and stroke width. */
export function valueNoise(x: number, y: number): number {
	const x0 = Math.floor(x);
	const y0 = Math.floor(y);
	const sx = fade(x - x0);
	const sy = fade(y - y0);
	const a = hash2(x0, y0);
	const b = hash2(x0 + 1, y0);
	const c = hash2(x0, y0 + 1);
	const d = hash2(x0 + 1, y0 + 1);
	return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

/**
 * Chaikin open curve: keep the ends; every interior point becomes two, a
 * quarter of the way toward each neighbour.
 */
export function chaikin(pts: Pt[], iterations = 4): Pt[] {
	let p = pts.map((q) => ({ x: q.x, y: q.y }));
	for (let k = 0; k < iterations; k++) {
		if (p.length < 3) break;
		const n: Pt[] = [{ x: p[0].x, y: p[0].y }];
		for (let i = 1; i < p.length - 1; i++) {
			const prev = p[i - 1];
			const cur = p[i];
			const next = p[i + 1];
			n.push({ x: cur.x + (prev.x - cur.x) * 0.25, y: cur.y + (prev.y - cur.y) * 0.25 });
			n.push({ x: cur.x + (next.x - cur.x) * 0.25, y: cur.y + (next.y - cur.y) * 0.25 });
		}
		n.push({ x: p[p.length - 1].x, y: p[p.length - 1].y });
		p = n;
	}
	return p;
}

function jitter(pts: Pt[], amp: number, ox: number, oy: number): Pt[] {
	return pts.map((p, i) => {
		const n1 = valueNoise(p.x * 3.1 + ox, p.y * 3.1 + oy);
		const n2 = valueNoise(p.x * 3.1 + ox + 19.2, p.y * 3.1 + oy + 7.7);
		const edge = i === 0 || i === pts.length - 1 ? 0.35 : 1;
		return { x: p.x + (n1 - 0.5) * 2 * amp * edge, y: p.y + (n2 - 0.5) * 2 * amp * edge };
	});
}

function startTag(path: GlyphPath): number {
	return typeof path[0] === 'number' ? path[0] : 0;
}
function endTag(path: GlyphPath): number {
	const l = path[path.length - 1];
	return typeof l === 'number' ? l : 0;
}

/**
 * Shapify: offset each point left and right along its normal by the local
 * half-width, close with round caps — a ribbon polygon.
 */
export function shapify(pts: Pt[], widthAt: (pt: Pt, i: number, n: number) => number): Pt[] {
	const n = pts.length;
	if (n < 2) return [];
	const left: Pt[] = [];
	const right: Pt[] = [];
	for (let i = 0; i < n; i++) {
		const ang =
			i < n - 1
				? Math.atan2(pts[i + 1].y - pts[i].y, pts[i + 1].x - pts[i].x)
				: Math.atan2(pts[i].y - pts[i - 1].y, pts[i].x - pts[i - 1].x);
		const w = widthAt(pts[i], i, n);
		const nx = -Math.sin(ang);
		const ny = Math.cos(ang);
		left.push({ x: pts[i].x + nx * w, y: pts[i].y + ny * w });
		right.push({ x: pts[i].x - nx * w, y: pts[i].y - ny * w });
	}
	const cap = (center: Pt, from: Pt, to: Pt, steps: number): Pt[] => {
		const a0 = Math.atan2(from.y - center.y, from.x - center.x);
		const a1 = Math.atan2(to.y - center.y, to.x - center.x);
		let d = a1 - a0;
		while (d <= 0) d += Math.PI * 2;
		while (d > Math.PI * 2) d -= Math.PI * 2;
		if (d > Math.PI) d -= Math.PI * 2;
		const out: Pt[] = [];
		const r = Math.hypot(from.x - center.x, from.y - center.y);
		for (let s = 1; s < steps; s++) {
			const a = a0 + (d * s) / steps;
			out.push({ x: center.x + Math.cos(a) * r, y: center.y + Math.sin(a) * r });
		}
		return out;
	};
	return [
		...left,
		...cap(pts[n - 1], left[n - 1], right[n - 1], 7),
		...right.slice().reverse(),
		...cap(pts[0], right[0], left[0], 7),
	];
}

function unitToPage(p: Pt, origin: Pt, capMm: number, slant: number): Pt {
	let yu = p.y;
	if (yu < 0.55) yu = 0.55 - (0.55 - yu) * HAND.ascenderGain;
	else if (yu > 1) yu = 1 + (yu - 1) * HAND.descenderGain;
	const y = origin.y + (1 - yu) * capMm;
	const x = origin.x + p.x * capMm + (1 - yu) * slant * capMm;
	return { x, y };
}

function halfWidth(
	pt: Pt,
	i: number,
	n: number,
	capMm: number,
	ox: number,
	oy: number,
	originY: number,
): number {
	const yUnit = 1 - (pt.y - originY) / capMm;
	const towardBase = 1 + 0.04 * Math.max(0, Math.min(1, (yUnit - 0.4) / 0.7));
	const nse = valueNoise(pt.x * 0.55 + ox, pt.y * 0.55 + oy);
	const mid = i / Math.max(1, n - 1);
	const taper = 0.97 + 0.03 * Math.sin(Math.PI * mid);
	return MOTOR.tipMm * 0.52 * (0.985 + 0.03 * nse) * towardBase * taper;
}

function assembleWordPaths(letters: string[], choices: number[], rng: Rng, tracking: number) {
	const picked: (PickedGlyph | null)[] = letters.map((ch, i) =>
		ch === ' ' ? null : pickGlyph(ch, choices[i]),
	);
	const tags = picked.map((g) => (g ? { s: startTag(g.path), e: endTag(g.path) } : null));
	const adjusted = picked.map((g, i) => {
		if (!g) return null;
		let prev: { s: number; e: number } | null = null;
		let next: { s: number; e: number } | null = null;
		for (let k = i - 1; k >= 0; k--) {
			if (tags[k]) {
				prev = tags[k];
				break;
			}
		}
		for (let k = i + 1; k < tags.length; k++) {
			if (tags[k]) {
				next = tags[k];
				break;
			}
		}
		const pc = prev ? prev.e : 0;
		const nc = next ? next.s : 0;
		g.adjust(g.path, pc, nc, g.index, rng);
		return g;
	});

	const subpaths: Pt[][] = [];
	let current: Pt[] = [];
	let xOff = 0;
	const flush = () => {
		if (current.length >= 2) subpaths.push(current);
		current = [];
	};
	const walk = (path: GlyphPath, asMarks: boolean) => {
		if (asMarks) flush();
		for (const el of path) {
			if (typeof el === 'number') {
				if (el === 0) flush();
			} else {
				current.push({ x: el.x + xOff, y: el.y });
			}
		}
		if (asMarks) flush();
	};

	for (let i = 0; i < letters.length; i++) {
		const g = adjusted[i];
		if (!g) {
			xOff += HAND.wordSpaceCap;
			continue;
		}
		walk(g.path, false);
		for (const m of g.marks) walk(m, true);
		const nextLetter = i + 1 < letters.length && letters[i + 1] !== ' ';
		xOff += g.advance + (nextLetter ? tracking : 0);
	}
	flush();
	return { subpaths, widthUnit: xOff };
}

/** Write one word at an origin (mm, y-up). Deterministic for a given context. */
export function writeWord(word: string, origin: Pt, ctx: WriteContext = {}): WordPlacement {
	const letters = [...word];
	const capMm = (ctx.capMm ?? MOTOR.capMm) * (1 - (ctx.fatigue ?? 0) * 0.08);
	const slant = Math.tan(((ctx.slantDeg ?? MOTOR.slantDeg) * Math.PI) / 180);
	const seed = hashStr(
		`${ctx.pageSeed ?? 0}|${word}|${ctx.i ?? 0}|${(ctx.xOnLine ?? 0).toFixed(3)}|${ctx.cluster ?? 0}`,
	);
	const rng = rngFromSeed(seed);
	const choices = letters.map((ch) => {
		const n = glyphCount(ch);
		return n ? Math.floor(rng() * n) : 0;
	});
	const tracking = ctx.trackingCap ?? HAND.letterTrackingCap;
	const { subpaths, widthUnit } = assembleWordPaths(letters, choices, rng, tracking);

	const ox = (seed % 97) * 0.17;
	const oy = ((seed >>> 8) % 79) * 0.13;
	const ribbons: Ribbon[] = [];
	const fatigue = ctx.fatigue ?? 0;

	for (const sp of subpaths) {
		if (sp.length < 2) continue;
		const curved = chaikin(sp, ctx.chaikin ?? MOTOR.chaikin);
		const jamp = 0.002 * capMm * (1 + fatigue * 0.55);
		const pagePts = curved.map((p) => unitToPage(p, origin, capMm, slant));
		const jit = jitter(pagePts, jamp, ox, oy);
		const poly = shapify(jit, (pt, i, n) => halfWidth(pt, i, n, capMm, ox, oy, origin.y));
		if (poly.length >= 3) ribbons.push(poly.map((q) => [q.x, q.y]));
	}

	return { ribbons, xEnd: origin.x + widthUnit * capMm, widthMm: widthUnit * capMm };
}
