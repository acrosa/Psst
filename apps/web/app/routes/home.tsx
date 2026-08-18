import { Link, redirect } from 'react-router';
import { getUser } from '~/lib/auth.server';
import type { Route } from './+types/home';

export function meta() {
	return [
		{ title: 'psst' },
		{ name: 'description', content: 'A little shared canvas for the people you whisper to.' },
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
	return (
		<main className="flex min-h-svh flex-col items-center justify-center gap-8 p-6 text-center">
			<div className="animate-pop-in flex flex-col items-center gap-5">
				<div className="text-6xl">🤫</div>
				<h1 className="font-hand text-3xl sm:text-4xl">psst… look at this</h1>
				<p className="max-w-md text-lg text-ink-soft">
					A little shared canvas for you and someone close. Drop links, notes, photos and stickers
					on today&apos;s board — tomorrow it becomes a page in your scrapbook.
				</p>
				<p className="text-sm text-ink-faint">Not a chat. No pressure. Just keepsakes.</p>
			</div>

			<div className="flex items-center gap-3">
				<Link
					to="/register"
					className="rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-white shadow-card transition hover:bg-accent-deep"
				>
					Start a canvas
				</Link>
				<Link
					to="/login"
					className="rounded-lg px-5 py-2.5 text-sm font-medium text-ink-soft transition hover:bg-paper-deep hover:text-ink"
				>
					Sign in
				</Link>
			</div>

			<div className="flex gap-4 text-3xl" aria-hidden>
				<span className="-rotate-6 inline-block">📮</span>
				<span className="rotate-3 inline-block">🖼️</span>
				<span className="-rotate-3 inline-block">🎶</span>
				<span className="rotate-6 inline-block">💌</span>
			</div>
		</main>
	);
}
