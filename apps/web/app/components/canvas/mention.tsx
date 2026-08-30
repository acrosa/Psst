import { type Mentionable, splitMentions } from '~/lib/mentions';

/** The in-progress `@query` at the end of a draft, if any. */
function trailingMention(value: string): { index: number; query: string } | null {
	const match = /(^|\s)@([^@]{0,30})$/.exec(value);
	if (!match) return null;
	return { index: (match.index ?? 0) + match[1].length, query: match[2] };
}

/**
 * A quiet member picker that appears while typing `@…` — click a name to
 * finish the mention. Render inside a `relative` container, above the input.
 */
export function MentionMenu({
	value,
	members,
	currentUserId,
	onPick,
}: {
	value: string;
	members: Mentionable[];
	currentUserId?: string;
	onPick: (next: string) => void;
}) {
	const pending = trailingMention(value);
	if (!pending) return null;
	const query = pending.query.toLowerCase();
	const options = members
		.filter((m) => m.id !== currentUserId && m.name?.toLowerCase().startsWith(query))
		.slice(0, 4);
	if (options.length === 0) return null;

	return (
		<div className="absolute bottom-full left-0 z-30 mb-1.5 overflow-hidden rounded-lg border border-line bg-card shadow-card">
			{options.map((member) => (
				<button
					key={member.id}
					type="button"
					// mousedown so the input never loses focus
					onMouseDown={(event) => {
						event.preventDefault();
						onPick(`${value.slice(0, pending.index)}@${member.name} `);
					}}
					className="block w-full px-3 py-1.5 text-left text-sm transition hover:bg-paper-deep"
				>
					<span className="text-accent-deep">@</span>
					{member.name}
				</button>
			))}
		</div>
	);
}

/** Text with `@name` runs in accent — how a mention reads on the board. */
export function MentionText({ text, members }: { text: string; members: Mentionable[] }) {
	const parts = splitMentions(text, members);
	return (
		<>
			{parts.map((part, index) =>
				part.mention ? (
					// biome-ignore lint/suspicious/noArrayIndexKey: static split of one string
					<span key={index} className="font-medium text-accent-deep">
						{part.text}
					</span>
				) : (
					// biome-ignore lint/suspicious/noArrayIndexKey: static split of one string
					<span key={index}>{part.text}</span>
				),
			)}
		</>
	);
}
