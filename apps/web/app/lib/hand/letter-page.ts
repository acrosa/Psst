/**
 * Vendored from folio-hand (https://github.com/clodoan/folio), MIT License,
 * Copyright (c) 2026 Claudio Angrigiani. The method follows Amy Goodchild's
 * Chaikin + join-tag + shapify approach. Adapted for psst: TypeScript, extra
 * glyphs and marks, a letter-sized page.
 *
 * The page: psst's letter sheet, 120 × 150 mm. The date sits top right, then
 * the greeting, the lines, a close, and the signature — each word placed by
 * the hand with a little wander and growing fatigue down the page. A longer
 * letter shrinks its hand just enough to still fit one sheet. Coordinates
 * are y-up millimetres; `render-svg` and `render-png` flip once.
 */

import { rngFromSeed } from './seed';
import { HAND, type Ribbon, writeWord } from './writer';

export const SHEET = { wMm: 120, hMm: 150 } as const;

const MARGIN = { left: 12, right: 12, top: 14, bottom: 14 } as const;
const BODY_CAP = 3.5;
const DATE_CAP = 2.8;
const SIGN_CAP = 4.2;

export type LetterInput = {
	/** e.g. "august 25 - 31" — written by the hand, so keep it to its glyphs */
	dateLabel: string;
	greeting: string;
	lines: string[];
	close: string;
	sign: string;
	seed: number;
};

export type LetterPage = {
	seed: number;
	sheet: typeof SHEET;
	ribbons: Ribbon[];
	/** How far the hand shrank to fit (1 = not at all). */
	fit: number;
};

/** Only what the hand can write. Dashes and curly quotes become their plain kin. */
export function keepHand(text: string): string {
	return String(text ?? '')
		.normalize('NFC')
		.replace(/[–—]/g, '-')
		.replace(/[‘’]/g, "'")
		.replace(/[^a-zA-Z0-9áéíóúüñ.,'?!¿¡\-:; ]/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}

export function composeLetterPage(input: LetterInput): LetterPage {
	const seed = input.seed >>> 0;
	const rng = rngFromSeed(seed);
	const ribbons: Ribbon[] = [];
	let serial = 1;

	const measure = SHEET.wMm - MARGIN.left - MARGIN.right;

	function wordWidth(word: string, capMm: number): number {
		return writeWord(word, { x: 0, y: 0 }, { pageSeed: seed, i: 8000 + serial, capMm, cluster: 9 })
			.widthMm;
	}

	function wrapLine(text: string, capMm: number, maxW: number): string[][] {
		const words = keepHand(text).split(/\s+/).filter(Boolean);
		const space = HAND.wordSpaceCap * capMm;
		const lines: string[][] = [];
		let cur: string[] = [];
		let w = 0;
		for (const word of words) {
			const ww = wordWidth(word, capMm);
			const extra = cur.length ? space : 0;
			if (cur.length && w + extra + ww > maxW) {
				lines.push(cur);
				cur = [word];
				w = ww;
			} else {
				w += extra + ww;
				cur.push(word);
			}
		}
		if (cur.length) lines.push(cur);
		return lines;
	}

	function placeBlock(
		text: string,
		x0: number,
		y0: number,
		opts: { fatigue: number; indent?: number; cluster: number; capMm: number },
	): { y: number } {
		const { fatigue, indent = 0, cluster, capMm } = opts;
		const blockSpace = HAND.wordSpaceCap * capMm;
		const blockLead = HAND.leadingCap * capMm;
		const lines = wrapLine(text, capMm, measure - indent);
		let y = y0;
		for (const words of lines) {
			const lineNudge = (rng() * 2 - 1) * (0.4 + fatigue * 1.2);
			let x = x0 + indent + lineNudge;
			const slope = -Math.abs(rng() * (0.008 + fatigue * 0.014)) - fatigue * 0.004;
			const amp = 0.18 + rng() * 0.22 + fatigue * 0.22;
			const phase = rng() * Math.PI * 2;
			const lineX0 = x;
			for (const word of words) {
				const t = (x - lineX0) / Math.max(8, measure);
				const wander = slope * (x - lineX0) + amp * Math.sin(t * Math.PI * 1.1 + phase);
				const yb = y + wander + (rng() * 2 - 1) * 0.12 * (1 + fatigue);
				const placed = writeWord(
					word,
					{ x, y: yb },
					{
						pageSeed: seed,
						i: serial,
						fatigue,
						capMm,
						slantDeg: HAND.slantDeg + (rng() * 2 - 1) * 1.4,
						xOnLine: (x - x0) / measure,
						cluster,
					},
				);
				serial += word.length + 1;
				ribbons.push(...placed.ribbons);
				x = placed.xEnd + blockSpace * (1 + (rng() * 2 - 1) * (0.08 + fatigue * 0.14));
			}
			y -= blockLead * (1 + (rng() * 2 - 1) * 0.04) * (1 + fatigue * 0.04);
		}
		return { y };
	}

	const greeting = keepHand(input.greeting);
	const lines = input.lines.map(keepHand).filter(Boolean);
	const close = keepHand(input.close);
	const sign = keepHand(input.sign) || 'psst';

	// The date, top right.
	const dateWords = keepHand(input.dateLabel).toLowerCase().split(/\s+/).filter(Boolean);
	const dateSpace = HAND.wordSpaceCap * DATE_CAP;
	let dateW = 0;
	dateWords.forEach((word, i) => {
		if (i) dateW += dateSpace;
		dateW += wordWidth(word, DATE_CAP);
	});
	let dateX = SHEET.wMm - MARGIN.right - dateW;
	const dateY = SHEET.hMm - MARGIN.top;
	for (const word of dateWords) {
		const placed = writeWord(
			word,
			{ x: dateX, y: dateY },
			{
				pageSeed: seed,
				i: serial,
				fatigue: 0.03,
				capMm: DATE_CAP,
				slantDeg: HAND.slantDeg + (rng() * 2 - 1) * 0.8,
				cluster: 8,
			},
		);
		serial += word.length + 1;
		ribbons.push(...placed.ribbons);
		dateX = placed.xEnd + dateSpace;
	}

	// The body: measure everything, then shrink the hand just enough to fit
	// above the signature.
	const left = MARGIN.left;
	const openY = SHEET.hMm - MARGIN.top - 12;
	const openGap = 0.5;
	const closeGap = 0.6;
	const signRoom = 2.2;
	const needed = (f: number) => {
		const c = BODY_CAP * f;
		const lead = HAND.leadingCap * c;
		let leads = wrapLine(greeting, c, measure).length + openGap;
		for (const line of lines) leads += wrapLine(line, c, measure - 3).length;
		leads += closeGap + wrapLine(close, c, measure - 12).length + signRoom;
		return leads * lead;
	};
	const budget = openY - MARGIN.bottom;
	let fit = 1;
	while (fit > 0.62 && needed(fit) > budget) fit -= 0.02;
	const bodyCap = BODY_CAP * fit;
	const bodyLead = HAND.leadingCap * bodyCap;

	const rOpen = placeBlock(greeting, left, openY, { fatigue: 0.05, cluster: 0, capMm: bodyCap });
	let y = rOpen.y - bodyLead * openGap;
	lines.forEach((line, i) => {
		const r = placeBlock(line, left, y, {
			fatigue: 0.15 + i * 0.02,
			indent: 3,
			cluster: 1 + i,
			capMm: bodyCap,
		});
		y = r.y;
	});
	const rClose = placeBlock(close, left, y - bodyLead * closeGap, {
		fatigue: 0.4,
		indent: 12,
		cluster: 2,
		capMm: bodyCap,
	});

	const sigX = 70 + (rng() * 2 - 1) * 5;
	const sigY = Math.max(MARGIN.bottom * 0.6, rClose.y - bodyLead * 1.05 + (rng() * 2 - 1) * 1.6);
	const signature = writeWord(
		sign,
		{ x: sigX, y: sigY },
		{
			pageSeed: seed,
			i: serial,
			fatigue: 0.12,
			capMm: Math.max(SIGN_CAP * fit, BODY_CAP),
			slantDeg: HAND.slantDeg + 2.2,
			cluster: 3,
		},
	);
	ribbons.push(...signature.ribbons);

	return { seed, sheet: SHEET, ribbons, fit };
}
