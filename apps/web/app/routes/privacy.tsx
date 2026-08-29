import { Link } from 'react-router';
import { ogMeta } from '~/lib/og';

export function meta() {
	return [
		{ title: 'Privacy — psst' },
		...ogMeta({
			title: 'Privacy — psst',
			description: 'No tracking, no ads, no selling data. Your canvas is yours.',
		}),
	];
}

const updated = 'August 29, 2026';

export default function Privacy() {
	return (
		<main className="mx-auto w-full max-w-2xl px-6 py-16">
			<Link to="/" className="font-serif text-2xl italic leading-none">
				psst
			</Link>

			<h1 className="mt-10 font-serif text-4xl">Privacy</h1>
			<p className="mt-2 text-ink-faint text-sm">Last updated {updated}</p>

			<div className="mt-8 space-y-6 text-ink-soft leading-relaxed [&_h2]:font-serif [&_h2]:text-2xl [&_h2]:text-ink [&_strong]:text-ink">
				<p>
					psst is a small, private place. The short version:{' '}
					<strong>
						we don't track you, we don't run analytics or ads, and we never sell or share your
						information.
					</strong>{' '}
					What you drop on a canvas is visible only to the people in that space.
				</p>

				<h2>What we store</h2>
				<p>
					Only what the app needs to work: your account (name, email, and an optional profile
					photo), the things you and your people put on your canvases (links, notes, photos,
					drawings, voice notes, reactions, and captions), and — if you turn notifications on in the
					iOS app — a device token used solely to deliver them.
				</p>

				<h2>Cookies</h2>
				<p>
					One cookie, to keep you signed in. No tracking cookies, no third-party cookies, no
					fingerprinting.
				</p>

				<h2>Who else touches the data</h2>
				<p>
					The services that run psst, acting only on our instructions: our hosting provider
					(Vercel), our database (Supabase), media storage (Cloudflare), and Apple's push
					notification service. None of them may use your data for anything else.
				</p>

				<h2>What we never do</h2>
				<p>
					No selling data. No advertising. No analytics or behavioral tracking. No reading your
					spaces — your canvases are between you and the people you invited.
				</p>

				<h2>Deleting your data</h2>
				<p>
					Delete something from a canvas and it's gone from the app. Want your whole account and
					everything in it removed? Write to{' '}
					<a href="mailto:hello@psst.you" className="text-accent-deep underline">
						hello@psst.you
					</a>{' '}
					and we'll erase it.
				</p>

				<h2>Changes</h2>
				<p>
					If this policy ever changes in a way that matters, we'll say so on this page before it
					takes effect.
				</p>
			</div>

			<p className="mt-12 text-ink-faint text-sm">
				<Link to="/terms" className="underline">
					Terms
				</Link>
			</p>
		</main>
	);
}
