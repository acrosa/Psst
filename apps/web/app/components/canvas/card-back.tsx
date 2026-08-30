import { useEffect, useRef, useState } from 'react';
import { useFetcher } from 'react-router';
import { TrashIcon } from '~/components/icons';
import { ConfirmDialog } from '~/components/ui/confirm-dialog';
import { cn } from '~/lib/cn';
import { REACTION_EMOJIS } from '~/lib/design';
import type { Mentionable } from '~/lib/mentions';
import type { BoardItem } from '~/lib/services/canvases.server';
import { MentionMenu, MentionText } from './mention';

function timeOfDay(iso: string): string {
	return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(
		new Date(iso),
	);
}

/**
 * The back of every card: postmark, the small thread, reactions — and for the
 * author, the way to take it back. Interactive zone is nodrag (React Flow) and
 * data-noflip (FlipCard).
 */
export function CardBack({
	item,
	currentUserId,
	frozen,
	members = [],
}: {
	item: BoardItem;
	currentUserId: string;
	frozen: boolean;
	members?: Mentionable[];
}) {
	const commentFetcher = useFetcher<{ error?: string }>();
	const [draft, setDraft] = useState('');
	const inputRef = useRef<HTMLInputElement>(null);
	const reactionFetcher = useFetcher();
	const deleteFetcher = useFetcher();
	const formRef = useRef<HTMLFormElement>(null);
	const threadRef = useRef<HTMLDivElement>(null);
	const [confirmingDelete, setConfirmingDelete] = useState(false);

	useEffect(() => {
		if (commentFetcher.state === 'idle' && !commentFetcher.data?.error) {
			formRef.current?.reset();
			setDraft('');
		}
	}, [commentFetcher.state, commentFetcher.data]);

	// Keep the newest note in view — pinned to the bottom like a thread.
	// biome-ignore lint/correctness/useExhaustiveDependencies: scroll on new comments
	useEffect(() => {
		const thread = threadRef.current;
		if (thread) thread.scrollTop = thread.scrollHeight;
	}, [item.comments.length]);

	const reactionCounts = new Map<string, { count: number; mine: boolean }>();
	for (const reaction of item.reactions) {
		const entry = reactionCounts.get(reaction.emoji) ?? { count: 0, mine: false };
		entry.count += 1;
		if (reaction.userId === currentUserId) entry.mine = true;
		reactionCounts.set(reaction.emoji, entry);
	}

	return (
		<div className="flex h-full w-full flex-col gap-2 rounded-lg border border-line bg-card p-3 shadow-card">
			{/* Postmark row */}
			<div className="flex items-baseline justify-between gap-2">
				<span className="truncate font-medium text-ink text-xs">
					{item.authorName ?? 'Someone'}
				</span>
				<span className="shrink-0 font-mono text-[10px] text-ink-faint uppercase tracking-wider">
					{timeOfDay(item.createdAt)}
				</span>
			</div>

			{/* The small thread — newest pinned into view */}
			<div
				ref={threadRef}
				className="nodrag nowheel min-h-0 flex-1 space-y-1.5 overflow-y-auto"
				data-noflip
			>
				{item.comments.length === 0 ? (
					<p className="font-serif text-ink-faint text-sm italic">nothing on the back yet…</p>
				) : (
					item.comments.map((comment) => (
						<p key={comment.id} className="font-serif text-[15px] leading-snug">
							<span className="text-ink-soft">{comment.authorName ?? 'Someone'}:</span>{' '}
							<MentionText text={comment.text} members={members} />
						</p>
					))
				)}
			</div>

			{!frozen ? (
				<commentFetcher.Form method="post" ref={formRef} className="nodrag relative" data-noflip>
					<MentionMenu
						value={draft}
						members={members}
						currentUserId={currentUserId}
						onPick={(next) => {
							setDraft(next);
							if (inputRef.current) {
								inputRef.current.value = next;
								inputRef.current.focus();
							}
						}}
					/>
					<input type="hidden" name="intent" value="add-comment" />
					<input type="hidden" name="itemId" value={item.id} />
					<input
						ref={inputRef}
						name="text"
						placeholder="write on the back…"
						maxLength={280}
						autoComplete="off"
						onChange={(event) => setDraft(event.currentTarget.value)}
						className="w-full rounded-md border border-line bg-paper px-2.5 py-1.5 font-serif text-[15px] outline-none placeholder:text-ink-faint focus:border-accent"
					/>
				</commentFetcher.Form>
			) : null}

			{/* Reactions + remove */}
			<div className="nodrag flex items-center gap-0.5" data-noflip>
				{REACTION_EMOJIS.map((emoji) => {
					const entry = reactionCounts.get(emoji);
					return (
						<button
							key={emoji}
							type="button"
							disabled={frozen}
							aria-pressed={entry?.mine ?? false}
							onClick={() =>
								reactionFetcher.submit(
									{ intent: 'toggle-reaction', itemId: item.id, emoji },
									{ method: 'post' },
								)
							}
							className={cn(
								'flex h-7 items-center rounded-md px-1.5 text-sm transition hover:bg-paper-deep disabled:pointer-events-none',
								entry?.mine && 'bg-accent-soft',
								!entry && 'opacity-60 grayscale hover:grayscale-0 hover:opacity-100',
							)}
						>
							{emoji}
							{entry ? (
								<span className="ml-1 font-medium text-[11px] text-ink-soft">{entry.count}</span>
							) : null}
						</button>
					);
				})}
				<span className="flex-1" />
				{!frozen && item.authorId === currentUserId ? (
					<>
						<button
							type="button"
							aria-label="Remove from the board"
							onClick={() => setConfirmingDelete(true)}
							className="grid h-7 w-7 place-items-center rounded-md text-ink-faint transition hover:bg-accent-soft hover:text-accent-deep"
						>
							<TrashIcon className="h-3.5 w-3.5" />
						</button>
						<ConfirmDialog
							open={confirmingDelete}
							onClose={() => setConfirmingDelete(false)}
							onConfirm={() =>
								deleteFetcher.submit({ intent: 'delete-item', itemId: item.id }, { method: 'post' })
							}
							title="Take this off the board?"
							message="It leaves the canvas for everyone — quietly, no trace."
							confirmLabel="Take it off"
						/>
					</>
				) : null}
			</div>
		</div>
	);
}
