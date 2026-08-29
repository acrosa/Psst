import { useEffect, useState } from 'react';
import { Link, redirect } from 'react-router';
import { DemoBoard } from '~/components/canvas/demo-board';
import { getUser } from '~/lib/auth.server';
import { ogMeta } from '~/lib/og';
import type { Route } from './+types/home';

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

export default function Home() {
	const [boardReady, setBoardReady] = useState(false);
	useEffect(() => setBoardReady(window.matchMedia('(min-width: 640px)').matches), []);

	return (
		<div className="relative min-h-svh overflow-hidden">
			{boardReady ? (
				<div className="absolute inset-0 max-sm:hidden">
					<DemoBoard />
				</div>
			) : null}
			<main className="pointer-events-none relative z-10 mx-auto flex min-h-svh w-full max-w-4xl flex-col justify-center gap-10 px-6 py-16">
				<p className="animate-pop-in font-serif text-2xl italic leading-none">psst</p>

				<h1 className="max-w-2xl font-serif text-5xl leading-[1.08] sm:text-6xl">
					a canvas for the people you whisper to
				</h1>

				<p className="max-w-md text-ink-soft text-lg">
					Drop links, notes, photos and stickers on today&apos;s board — tomorrow it becomes a page
					in your scrapbook.
				</p>

				<p className="font-mono font-semibold text-[11px] text-ink-faint uppercase tracking-[0.2em]">
					not a chat · no pressure · just keepsakes
				</p>

				<div className="pointer-events-auto flex items-center gap-3">
					<Link
						to="/register"
						className="rounded-lg bg-accent px-5 py-2.5 font-medium text-sm text-white shadow-card transition hover:bg-accent-deep"
					>
						Start a canvas
					</Link>
					<Link
						to="/login"
						className="rounded-lg px-5 py-2.5 font-medium text-ink-soft text-sm transition hover:bg-paper-deep hover:text-ink"
					>
						Sign in
					</Link>
				</div>

				<p className="pointer-events-auto text-ink-faint text-xs">
					<Link to="/privacy" className="transition hover:text-ink-soft">
						Privacy
					</Link>
					{' · '}
					<Link to="/terms" className="transition hover:text-ink-soft">
						Terms
					</Link>
				</p>
			</main>
		</div>
	);
}
