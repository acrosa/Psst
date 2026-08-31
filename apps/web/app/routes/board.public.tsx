import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Board } from '~/components/canvas/board';
import { formatDay } from '~/lib/dates';
import { ogMeta } from '~/lib/og';
import { getPublicBoard } from '~/lib/services/canvases.server';
import { publicUrl } from '~/lib/storage.server';
import type { Route } from './+types/board.public';

export function meta({ data }: Route.MetaArgs) {
	const title = data ? `${data.space.emoji} ${data.space.name} — a day on psst` : 'psst';
	return [
		{ title },
		...ogMeta({
			title,
			description: 'A little shared canvas, frozen as it was left.',
		}),
	];
}

export async function loader({ params }: Route.LoaderArgs) {
	const board = await getPublicBoard(params.token, publicUrl);
	if (!board) {
		throw new Response('Not found', { status: 404 });
	}
	return board;
}

/** A shared day: the board as strangers may see it — fronts only, read-only. */
export default function PublicBoard({ loaderData }: Route.ComponentProps) {
	const { space, date, items } = loaderData;
	const [boardReady, setBoardReady] = useState(false);
	useEffect(() => setBoardReady(true), []);

	return (
		<div className="flex h-svh flex-col">
			<header className="flex items-center justify-between gap-2 px-4 py-2.5 sm:px-6">
				<div className="flex min-w-0 items-center gap-2 sm:gap-3">
					<span className="shrink-0 text-xl sm:text-2xl" aria-hidden>
						{space.emoji}
					</span>
					<div className="min-w-0">
						<div className="truncate font-medium text-sm leading-tight sm:text-base">
							{space.name}
						</div>
						<div className="truncate text-ink-faint text-xs leading-tight">{formatDay(date)}</div>
					</div>
				</div>
				<Link
					to="/"
					className="shrink-0 rounded-lg px-2 py-1.5 text-ink-soft text-sm transition hover:bg-paper-deep hover:text-ink"
				>
					made with <span className="font-serif italic">psst</span>
				</Link>
			</header>

			<div className="min-h-0 flex-1">
				{boardReady ? <Board items={items} currentUserId="" frozen publicView /> : null}
			</div>
		</div>
	);
}
