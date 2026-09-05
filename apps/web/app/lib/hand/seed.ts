/**
 * Vendored from folio-hand (https://github.com/clodoan/folio), MIT License,
 * Copyright (c) 2026 Claudio Angrigiani. The method follows Amy Goodchild's
 * Chaikin + join-tag + shapify approach. Adapted for psst: TypeScript, extra
 * glyphs and marks, a letter-sized page.
 *
 * Seeds: one hash per page, one small PRNG per word. The same seed always
 * writes the same page, so a letter re-renders identically on every device.
 */

export function hashStr(s: string): number {
	let h = 2166136261 >>> 0;
	for (let i = 0; i < s.length; i++) {
		h ^= s.charCodeAt(i);
		h = Math.imul(h, 16777619);
	}
	return h >>> 0;
}

export type Rng = () => number;

export function rngFromSeed(seed: number): Rng {
	let t = seed >>> 0;
	return function rng() {
		t += 0x6d2b79f5;
		let r = Math.imul(t ^ (t >>> 15), 1 | t);
		r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
		return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
	};
}
