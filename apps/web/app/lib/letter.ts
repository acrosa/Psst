import { addDays } from './dates';

/**
 * The Sunday letter as stored in `items.text` — client-safe, so the board
 * can read it. The seed makes the hand reproducible on every device; the
 * words are the letter.
 */
export type LetterData = {
	v: 1;
	weekStart: string;
	weekEnd: string;
	seed: number;
	greeting: string;
	lines: string[];
	close: string;
	sign: string;
};

export function parseLetter(raw: string | null): LetterData | null {
	if (!raw) return null;
	try {
		const parsed = JSON.parse(raw) as Partial<LetterData>;
		if (
			parsed.v !== 1 ||
			typeof parsed.weekStart !== 'string' ||
			typeof parsed.seed !== 'number' ||
			!Array.isArray(parsed.lines)
		) {
			return null;
		}
		return {
			v: 1,
			weekStart: parsed.weekStart,
			weekEnd: typeof parsed.weekEnd === 'string' ? parsed.weekEnd : addDays(parsed.weekStart, 6),
			seed: parsed.seed,
			greeting: typeof parsed.greeting === 'string' ? parsed.greeting : '',
			lines: parsed.lines.filter((l): l is string => typeof l === 'string'),
			close: typeof parsed.close === 'string' ? parsed.close : '',
			sign: typeof parsed.sign === 'string' ? parsed.sign : 'psst',
		};
	} catch {
		return null;
	}
}
