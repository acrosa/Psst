import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
// zod v4 types: the SDK's zodOutputFormat wants them, and zod 3.25 ships them here.
import { z } from 'zod/v4';
import { env } from './env.server';
import type { WeekDigest } from './services/letters.server';

/**
 * The words of the Sunday letter. Claude reads the week's board and writes
 * the group a short letter in psst's voice — lowercase, warm, brief, in the
 * language the group writes in. Structured output keeps the shape honest;
 * `normalize` keeps it inside what the hand can write. Without a key psst
 * stays quiet; in tests a deterministic stub stands in for the model.
 */

const LetterSchema = z.object({
	greeting: z.string().describe('one short line greeting the group, e.g. "hi you two"'),
	lines: z
		.array(z.string())
		.describe('6 to 10 short lines, each under 42 characters, the body of the letter'),
	close: z.string().describe('one soft closing line'),
	sign: z.string().describe('always "psst"'),
});

export type LetterText = z.infer<typeof LetterSchema>;

const MAX_LINE = 60;
const WRAP_AT = 42;
const MAX_LINES = 12;

const VOICE = `You are psst: a small, private daily canvas that a few friends share. Once a week you read what they put on the board and write them a short letter in your own handwriting.

Write TO the group, in the second person, as one letter. Write in the language they write in — if the board is in Spanish, the letter is in Spanish.

Voice: lowercase whispers, warm and brief. No exclamation points. No emoji. No jargon, no apologies, no marketing. Never sound like a report: do not count things ("you shared 4 links"); notice them instead — a running joke, the photo everyone reacted to, the link someone loved, who was quiet this week, what came back twice. Say plainly, once, that you read the week's board.

Shape: a greeting of a few words; 6 to 10 lines of body, each line a complete thought under 42 characters (the hand that writes this has a narrow page); one soft closing line; sign "psst". Everything lowercase — the hand knows few capitals. Use only plain letters, digits, spaces and . , ' ? ! ¿ ¡ - : ; — no quotation marks, no links, no ids, no dates, no names of websites.`;

const DAY = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'long' });

/** The week as plain text, day by day — what the model reads. */
export function renderDigest(digest: WeekDigest, ctx: { spaceName: string }): string {
	const out: string[] = [];
	out.push(`the space is called "${ctx.spaceName}". members: ${digest.memberNames.join(', ')}.`);
	out.push(`the week of ${digest.weekStart} to ${digest.weekEnd}.`);
	out.push('');
	for (const day of digest.days) {
		if (day.items.length === 0) continue;
		out.push(`${DAY.format(new Date(`${day.date}T12:00:00Z`)).toLowerCase()}`);
		for (const item of day.items) {
			const bits: string[] = [];
			if (item.type === 'link') {
				bits.push(`${item.author} dropped a link${item.title ? `: "${item.title}"` : ''}`);
				if (item.description) bits.push(item.description);
				if (item.site) bits.push(`(${item.site})`);
			} else if (item.type === 'note') {
				bits.push(`${item.author} left a note: "${item.text ?? ''}"`);
			} else if (item.type === 'emoji') {
				bits.push(`${item.author} stuck a ${item.text ?? ''} sticker`);
			} else if (item.type === 'image') {
				bits.push(`${item.author} dropped a photo`);
			} else if (item.type === 'audio') {
				bits.push(`${item.author} left a voice note`);
			} else if (item.type === 'drawing') {
				bits.push(`${item.author} drew something with the pencil`);
			} else {
				bits.push(`${item.author} added something`);
			}
			const reactions = Object.entries(item.reactions)
				.map(([emoji, n]) => `${n} ${emoji}`)
				.join(', ');
			if (reactions) bits.push(`· reactions: ${reactions}`);
			for (const comment of item.comments) {
				bits.push(`· ${comment.author} wrote on the back: "${comment.text}"`);
			}
			out.push(`  - ${bits.join(' ')}`);
		}
		out.push('');
	}
	return out.join('\n');
}

function softWrap(line: string): string[] {
	const t = line.trim();
	if (t.length <= MAX_LINE) return [t];
	const cut = t.lastIndexOf(' ', MAX_LINE);
	if (cut < WRAP_AT) return [t.slice(0, MAX_LINE).trim(), ...softWrap(t.slice(MAX_LINE))];
	return [t.slice(0, cut).trim(), ...softWrap(t.slice(cut + 1))];
}

/** Keep the letter inside psst's voice and the hand's page, whatever the model did. */
export function normalizeLetter(raw: LetterText): LetterText | null {
	const scrub = (s: string) =>
		s
			.toLocaleLowerCase()
			.replace(/https?:\/\/\S+|www\.\S+/g, '')
			.replace(/[!]+/g, '.')
			.replace(/\s+/g, ' ')
			.trim();
	const lines = raw.lines.map(scrub).filter(Boolean).flatMap(softWrap).slice(0, MAX_LINES);
	const greeting = scrub(raw.greeting);
	const close = scrub(raw.close);
	if (lines.length < 3 || !greeting) return null;
	return { greeting, lines, close, sign: 'psst' };
}

/** What the E2E suite reads instead of a model: stable, and about the week. */
function stubLetter(digest: WeekDigest): LetterText {
	const first = digest.days.flatMap((d) => d.items)[0];
	const names = digest.memberNames.slice(0, 3).join(' and ') || 'you';
	return {
		greeting: `hi ${names}`,
		lines: [
			'i read the board this week.',
			first ? `${first.author} started it off.` : 'it started slowly.',
			'a few things stuck around.',
			'the rest drifted by, and that is fine.',
			'see you on monday.',
		],
		close: 'until next week',
		sign: 'psst',
	};
}

let client: Anthropic | null = null;

export async function writeLetter(
	digest: WeekDigest,
	ctx: { spaceName: string },
): Promise<LetterText | null> {
	if (env.NODE_ENV === 'test') return normalizeLetter(stubLetter(digest));
	if (!env.ANTHROPIC_API_KEY) {
		console.log('[letters] no ANTHROPIC_API_KEY — staying quiet');
		return null;
	}
	client ??= new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, timeout: 90_000 });

	for (let attempt = 0; attempt < 2; attempt++) {
		const response = await client.beta.messages.parse({
			model: 'claude-opus-5',
			max_tokens: 2048,
			betas: ['server-side-fallback-2026-07-01'],
			fallbacks: 'default',
			system: VOICE,
			messages: [{ role: 'user', content: renderDigest(digest, ctx) }],
			output_config: { format: zodOutputFormat(LetterSchema) },
		});
		if (response.stop_reason === 'refusal') return null;
		const letter = response.parsed_output ? normalizeLetter(response.parsed_output) : null;
		if (letter) return letter;
	}
	return null;
}
