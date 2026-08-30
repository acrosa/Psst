/**
 * @mentions, shared by server (who to notify) and client (highlighting).
 * A mention is `@` + a member's name, matched case-insensitively; longer
 * names win so "@Sam Lee" never half-matches "@Sam".
 */

export type Mentionable = { id: string; name: string | null };

function byLengthDesc(a: Mentionable, b: Mentionable) {
	return (b.name?.length ?? 0) - (a.name?.length ?? 0);
}

function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Ids of members whose `@name` appears in the text. */
export function findMentions(text: string, members: Mentionable[]): string[] {
	const found: string[] = [];
	for (const member of [...members].sort(byLengthDesc)) {
		if (!member.name) continue;
		const pattern = new RegExp(`@${escapeRegExp(member.name)}(?![\\w])`, 'i');
		if (pattern.test(text)) found.push(member.id);
	}
	return found;
}

/** Text split into plain runs and mention runs, for accent rendering. */
export function splitMentions(
	text: string,
	members: Mentionable[],
): Array<{ text: string; mention: boolean }> {
	const names = [...members]
		.sort(byLengthDesc)
		.flatMap((m) => (m.name ? [escapeRegExp(m.name)] : []));
	if (names.length === 0) return [{ text, mention: false }];
	const pattern = new RegExp(`@(?:${names.join('|')})(?![\\w])`, 'gi');
	const parts: Array<{ text: string; mention: boolean }> = [];
	let cursor = 0;
	for (const match of text.matchAll(pattern)) {
		const index = match.index ?? 0;
		if (index > cursor) parts.push({ text: text.slice(cursor, index), mention: false });
		parts.push({ text: match[0], mention: true });
		cursor = index + match[0].length;
	}
	if (cursor < text.length) parts.push({ text: text.slice(cursor), mention: false });
	return parts;
}
