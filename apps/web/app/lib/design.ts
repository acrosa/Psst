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
} as const;

export type BoardItemType = keyof typeof ITEM_SIZES;

/** Option-drag resize bounds — cards can breathe, not take over (or vanish). */
export const SCALE_MIN = 0.6;
export const SCALE_MAX = 1.75;

export function clampScale(scale: number): number {
	return Math.min(SCALE_MAX, Math.max(SCALE_MIN, scale));
}

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
