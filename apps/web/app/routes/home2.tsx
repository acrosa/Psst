import { Link, redirect } from 'react-router';
import { Daylight } from '~/components/daylight';
import { getUser } from '~/lib/auth.server';
import { ogMeta } from '~/lib/og';
import type { Route } from './+types/home2';

export function meta() {
	return [
		{ title: 'psst' },
		...ogMeta({
			title: 'psst',
			description: 'A little shared canvas for the people you whisper to.',
		}),
	];
}

export async function loader({ request }: Route.LoaderArgs) {
	const user = await getUser(request);
	if (user) {
		throw redirect('/spaces');
	}
	return null;
}

/** An alternative landing: the words on a sunlit wall. */
export default function Home2() {
	return (
		<div className="relative min-h-svh overflow-hidden">
			<div className="absolute inset-0">
				<Daylight />
			</div>
			<main className="relative z-10 mx-auto flex min-h-svh w-full max-w-5xl flex-col justify-between px-6 py-8 sm:px-10 sm:py-10">
				<p className="animate-pop-in font-serif text-2xl italic leading-none">psst</p>

				<div className="flex flex-col gap-8 pb-8 sm:pb-12">
					<h1 className="max-w-2xl font-serif text-5xl leading-[1.04] sm:text-6xl">
						a canvas for the people you whisper to
					</h1>

					<p className="max-w-md text-ink-soft text-lg">
						Drop links, notes, photos and stickers on today&apos;s board — tomorrow it becomes a
						page in your scrapbook.
					</p>

					<div className="flex items-center gap-3">
						<Link
							to="/register"
							className="rounded-full bg-accent px-6 py-3 font-medium text-sm text-white shadow-card transition hover:bg-accent-deep"
						>
							Start a canvas
						</Link>
						<Link
							to="/login"
							className="rounded-full px-5 py-3 font-medium text-ink-soft text-sm transition hover:text-ink"
						>
							Sign in
						</Link>
					</div>
				</div>

				<div className="flex items-end justify-between gap-6">
					<p className="font-mono font-semibold text-[11px] text-ink-faint uppercase tracking-[0.2em]">
						not a chat · no pressure · just keepsakes
					</p>
					<p className="text-ink-faint text-xs">
						<Link to="/privacy" className="transition hover:text-ink-soft">
							Privacy
						</Link>
						{' · '}
						<Link to="/terms" className="transition hover:text-ink-soft">
							Terms
						</Link>
					</p>
				</div>
			</main>
		</div>
	);
}
