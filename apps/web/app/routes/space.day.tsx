import { useEffect, useState } from 'react';
import { Link, redirect } from 'react-router';
import { AppHeader } from '~/components/app-header';
import { Board } from '~/components/canvas/board';
import { requireUser } from '~/lib/auth.server';
import { formatDay, localDate } from '~/lib/dates';
import { getBoardItems, getCanvasByDate } from '~/lib/services/canvases.server';
import { getSpace, requireMember } from '~/lib/services/spaces.server';
import { publicUrl } from '~/lib/storage.server';
import type { Route } from './+types/space.day';

export function meta({ data }: Route.MetaArgs) {
	const title = data ? `${formatDay(data.day.date)} · ${data.space.name} — psst` : 'psst';
	return [{ title }];
}

export async function loader({ request, params }: Route.LoaderArgs) {
	const user = await requireUser(request);
	await requireMember(params.spaceId, user.id);
	const space = await getSpace(params.spaceId);
	if (!space) {
		throw new Response('Not found', { status: 404 });
	}

	if (!/^\d{4}-\d{2}-\d{2}$/.test(params.date)) {
		throw new Response('Not found', { status: 404 });
	}

	// Today isn't archived — that page is the live canvas.
	if (params.date === localDate(space.timezone)) {
		throw redirect(`/spaces/${space.id}`);
	}

	const canvas = await getCanvasByDate(space.id, params.date);
	if (!canvas) {
		throw new Response('Not found', { status: 404 });
	}

	const items = await getBoardItems(canvas.id, publicUrl);

	return {
		user: { id: user.id, name: user.name ?? null },
		space: { id: space.id, name: space.name, emoji: space.emoji },
		day: { date: canvas.date, items },
	};
}

export default function SpaceDay({ loaderData }: Route.ComponentProps) {
	const { space, day, user } = loaderData;
	const [boardReady, setBoardReady] = useState(false);

	useEffect(() => setBoardReady(true), []);

	return (
		<div className="flex h-svh flex-col">
			<AppHeader userName={user.name}>
				<div className="flex min-w-0 items-center gap-3">
					<Link
						to={`/spaces/${space.id}/days`}
						className="text-sm text-ink-soft transition hover:text-ink"
					>
						← scrapbook
					</Link>
					<span className="text-2xl" aria-hidden>
						{space.emoji}
					</span>
					<div className="min-w-0">
						<div className="truncate font-medium leading-tight">{formatDay(day.date)}</div>
						<div className="text-xs text-ink-faint leading-tight">archived · left as it was</div>
					</div>
				</div>
			</AppHeader>

			<main className="relative min-h-0 flex-1">
				{boardReady ? (
					<Board items={day.items} currentUserId={user.id} frozen />
				) : (
					<div className="grid h-full place-items-center text-ink-faint">
						<span className="animate-shimmer font-hand text-2xl">turning the page…</span>
					</div>
				)}
			</main>
		</div>
	);
}
