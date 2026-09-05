import { Link } from 'react-router';
import { AppHeader } from '~/components/app-header';
import { requireUser } from '~/lib/auth.server';
import { formatDay, localDate } from '~/lib/dates';
import { type DayPeek, getTimelinePreviews, listCanvases } from '~/lib/services/canvases.server';
import { getSpace, requireMember } from '~/lib/services/spaces.server';
import { publicUrl } from '~/lib/storage.server';
import type { Route } from './+types/space.days';

export function meta({ data }: Route.MetaArgs) {
	const title = data ? `Timeline · ${data.space.name} — psst` : 'Timeline — psst';
	return [{ title }];
}

export async function loader({ request, params }: Route.LoaderArgs) {
	const user = await requireUser(request);
	await requireMember(params.spaceId, user.id);
	const space = await getSpace(params.spaceId);
	if (!space) {
		throw new Response('Not found', { status: 404 });
	}

	const url = new URL(request.url);
	const today = localDate(space.timezone);
	const before = url.searchParams.get('before') ?? today;

	const canvases = await listCanvases(space.id, { before, limit: 30 });
	const days = await getTimelinePreviews(canvases, publicUrl);

	return {
		user: { name: user.name ?? null, image: user.image ?? null },
		space: { id: space.id, name: space.name, emoji: space.emoji },
		days,
		nextBefore: canvases.length === 30 ? canvases[canvases.length - 1].date : null,
	};
}

function Peek({ peek }: { peek: DayPeek }) {
	if (peek.type === 'note') {
		return (
			<span className="line-clamp-2 max-w-24 rounded-sm bg-butter px-1.5 py-1 font-serif text-sm leading-tight">
				{peek.text}
			</span>
		);
	}
	if (peek.type === 'emoji') {
		return <span className="text-2xl">{peek.emoji}</span>;
	}
	if (peek.type === 'letter') {
		return (
			<span
				className="grid h-12 w-12 place-items-center rounded-sm border border-line bg-card text-lg"
				title="a letter from psst"
			>
				✉
			</span>
		);
	}
	if (peek.imageUrl) {
		return <img src={peek.imageUrl} alt="" className="h-12 w-12 rounded-sm object-cover" />;
	}
	return (
		<span className="grid h-12 w-12 place-items-center rounded-sm bg-sky text-lg">
			{peek.type === 'link' ? '📮' : '🖼️'}
		</span>
	);
}

export default function SpaceDays({ loaderData }: Route.ComponentProps) {
	const { space, days, user, nextBefore } = loaderData;

	return (
		<div className="min-h-svh scroll-smooth">
			<AppHeader user={user}>
				<Link
					to={`/spaces/${space.id}`}
					className="text-sm text-ink-soft transition hover:text-ink"
				>
					← back to today · {space.emoji} {space.name}
				</Link>
			</AppHeader>

			<main className="mx-auto max-w-2xl p-6">
				<h1 className="font-serif text-3xl">The scrapbook</h1>
				<p className="mt-1 text-sm text-ink-soft">Every day archives itself as you left it.</p>

				{days.length === 0 ? (
					<div className="mt-16 text-center">
						<div className="text-5xl">📖</div>
						<p className="mt-3 font-serif text-2xl text-ink-soft italic">No pages yet</p>
						<p className="mt-1 text-sm text-ink-faint">
							Tomorrow, today's board becomes the first page in your scrapbook.
						</p>
					</div>
				) : (
					<ul className="mt-6 grid gap-4">
						{days.map((day) => (
							<li key={day.date}>
								<Link
									to={`/spaces/${space.id}/days/${day.date}`}
									className="group flex flex-col gap-3 rounded-xl border border-line bg-card p-5 shadow-card transition hover:-rotate-[0.5deg] hover:shadow-lift"
								>
									<div className="flex items-baseline justify-between gap-3">
										<span className="font-medium">{formatDay(day.date)}</span>
										<span className="rounded-full bg-paper-deep px-2.5 py-1 text-xs text-ink-soft">
											{day.count === 1 ? '1 thing' : `${day.count} things`}
										</span>
									</div>
									<div className="flex flex-wrap items-center gap-2">
										{day.peeks.map((peek, index) => (
											// biome-ignore lint/suspicious/noArrayIndexKey: peeks are a stable slice per day
											<Peek key={index} peek={peek} />
										))}
									</div>
								</Link>
							</li>
						))}
					</ul>
				)}

				{nextBefore ? (
					<div className="mt-6 text-center">
						<Link
							to={`?before=${nextBefore}`}
							className="text-sm text-accent-deep underline underline-offset-2"
						>
							Older days
						</Link>
					</div>
				) : null}
			</main>

			{/* The tick rail: one tick per page, swelling under the hand. */}
			{days.length > 2 ? (
				<nav
					aria-label="Jump to a day"
					className="-translate-y-1/2 fixed top-1/2 right-4 hidden flex-col items-end gap-1.5 md:flex"
				>
					{days.map((day) => (
						<a
							key={day.date}
							href={`#day-${day.date}`}
							title={formatDay(day.date)}
							className="tick block h-0.5 w-4 rounded-full bg-ink-faint transition-all duration-150 hover:w-8 hover:bg-accent"
						/>
					))}
				</nav>
			) : null}
		</div>
	);
}
