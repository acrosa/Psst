/**
 * Board design tokens. Every item type renders at a fixed size — the
 * constraint is the aesthetic (collage, not chaos). No w/h in the database.
 */

export const ITEM_SIZES = {
	link: { w: 300, h: 220 },
	note: { w: 260, h: 200 },
	image: { w: 264, h: 264 },
	emoji: { w: 96, h: 96 },
	audio: { w: 300, h: 112 },
	/** The Sunday letter's sheet: 120 × 150 mm at 2.5 px per mm. */
	letter: { w: 300, h: 375 },
} as const;

export type BoardItemType = keyof typeof ITEM_SIZES;

/** Option-drag resize bounds — cards can breathe, not take over (or vanish). */
export const SCALE_MIN = 0.6;
export const SCALE_MAX = 1.75;

export function clampScale(scale: number): number {
	return Math.min(SCALE_MAX, Math.max(SCALE_MIN, scale));
}

/**
 * The table itself: how far it zooms, how the first view frames the day,
 * and the dot grid on the paper (on the 8 pt beat — see DESIGN.md § Grid).
 */
export const BOARD = {
	minZoom: 0.35,
	maxZoom: 1.75,
	/** fitView padding on first paint; never zooms past 1 to fit. */
	fitPadding: 0.4,
	fitMaxZoom: 1,
	dotGap: 32,
	dotSize: 1.5,
	/** Pointer travel before a press becomes a drag. */
	dragThreshold: 4,
} as const;

/** Motion vocabulary shared by every platform (DESIGN.md § Motion). */
export const MOTION = {
	/** The card flip — a 3D turn, CSS `ease`. */
	flipMs: 500,
	/** From the back a tap flips home; on the front, wait this long to tell a tap from a like. */
	doubleTapMs: 250,
	/** A pause this long after the last pencil stroke commits the drawing. */
	pencilSettleMs: 1400,
	/** Long-press to reach delete on silent items (stickers, drawings). */
	longPressMs: 500,
} as const;

/** Pencil colors — one gesture of color, from the psst palette. */
export const PENCIL_COLORS = ['#e2725b', '#4a7dbd', '#4e9a58', '#e0b64a', '#8b6cc1', '#6a5f4e'];

/** Reactions stay a small, warm set — not a full emoji keyboard. */
export const REACTION_EMOJIS = ['🫶', '😂', '🥹', '😮', '🔥', '👀'] as const;

/** Stickers droppable straight onto the board. */
export const STICKER_EMOJIS = [
	'🫶',
	'💌',
	'🌈',
	'⭐',
	'🌷',
	'🍓',
	'🐸',
	'🐣',
	'🦋',
	'🫧',
	'🍰',
	'☕',
	'🥐',
	'🎈',
	'🎶',
	'📮',
	'🌙',
	'☀️',
	'🌊',
	'🔥',
	'✨',
	'💭',
	'🙈',
	'😴',
] as const;

/** Pastel paper tones cards can pick from (seeded per item). */
export const SLIP_TONES = [
	'bg-card',
	'bg-butter',
	'bg-sky',
	'bg-meadow',
	'bg-lavender',
	'bg-blush',
];

export function seededTone(seed: string): string {
	let hash = 0;
	for (const char of seed) {
		hash = (hash * 31 + char.charCodeAt(0)) % 9973;
	}
	return SLIP_TONES[hash % SLIP_TONES.length];
}
