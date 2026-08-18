import { useEffect, useRef } from 'react';
import { useFetcher } from 'react-router';
import { cn } from '~/lib/cn';
import { REACTION_EMOJIS } from '~/lib/design';
import type { BoardItem } from '~/lib/services/canvases.server';

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
}: {
	item: BoardItem;
	currentUserId: string;
	frozen: boolean;
}) {
	const commentFetcher = useFetcher<{ error?: string }>();
	const reactionFetcher = useFetcher();
	const deleteFetcher = useFetcher();
	const formRef = useRef<HTMLFormElement>(null);

	useEffect(() => {
		if (commentFetcher.state === 'idle' && !commentFetcher.data?.error) {
			formRef.current?.reset();
		}
	}, [commentFetcher.state, commentFetcher.data]);

	const reactionCounts = new Map<string, { count: number; mine: boolean }>();
	for (const reaction of item.reactions) {
		const entry = reactionCounts.get(reaction.emoji) ?? { count: 0, mine: false };
		entry.count += 1;
		if (reaction.userId === currentUserId) entry.mine = true;
		reactionCounts.set(reaction.emoji, entry);
	}

	return (
		<div className="flex h-full w-full flex-col gap-2 rounded-lg border border-line bg-card p-3 shadow-card">
			{/* Postmark */}
			<div className="flex items-start justify-between gap-2">
				<div className="min-w-0 text-xs text-ink-soft">
					<div className="truncate font-medium text-ink">{item.authorName ?? 'Someone'}</div>
					<div>{timeOfDay(item.createdAt)}</div>
				</div>
				<div
					className="grid h-8 w-8 shrink-0 rotate-6 place-items-center rounded-sm border border-line border-dashed text-sm"
					aria-hidden
				>
					📮
				</div>
			</div>

			{/* The small thread */}
			<div className="nodrag min-h-0 flex-1 space-y-1 overflow-y-auto" data-noflip>
				{item.comments.length === 0 ? (
					<p className="font-hand text-lg text-ink-faint">nothing on the back yet…</p>
				) : (
					item.comments.map((comment) => (
						<p key={comment.id} className="font-hand text-lg leading-snug">
							<span className="text-ink-soft">{comment.authorName ?? 'Someone'}:</span>{' '}
							{comment.text}
						</p>
					))
				)}
			</div>

			{!frozen ? (
				<commentFetcher.Form method="post" ref={formRef} className="nodrag" data-noflip>
					<input type="hidden" name="intent" value="add-comment" />
					<input type="hidden" name="itemId" value={item.id} />
					<input
						name="text"
						placeholder="write on the back…"
						maxLength={280}
						autoComplete="off"
						className="w-full rounded-md border border-line bg-paper px-2 py-1 font-hand text-lg outline-none placeholder:text-ink-faint focus:border-accent"
					/>
				</commentFetcher.Form>
			) : null}

			{/* Reactions + remove */}
			<div className="nodrag flex items-center gap-1" data-noflip>
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
								'rounded-md px-1 py-0.5 text-sm transition hover:bg-paper-deep disabled:pointer-events-none',
								entry?.mine && 'bg-accent-soft',
								!entry && 'opacity-60 grayscale hover:grayscale-0 hover:opacity-100',
							)}
						>
							{emoji}
							{entry ? <span className="ml-0.5 text-xs text-ink-soft">{entry.count}</span> : null}
						</button>
					);
				})}
				<span className="flex-1" />
				{!frozen && item.authorId === currentUserId ? (
					<button
						type="button"
						aria-label="Remove from the board"
						onClick={() => {
							if (window.confirm('Take this off the board?')) {
								deleteFetcher.submit(
									{ intent: 'delete-item', itemId: item.id },
									{ method: 'post' },
								);
							}
						}}
						className="rounded-md px-1 py-0.5 text-sm text-ink-faint transition hover:bg-accent-soft hover:text-accent-deep"
					>
						🗑
					</button>
				) : null}
			</div>
		</div>
	);
}
