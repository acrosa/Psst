import { Link } from 'react-router';
import { ogMeta } from '~/lib/og';

export function meta() {
	return [
		{ title: 'Terms — psst' },
		...ogMeta({
			title: 'Terms — psst',
			description: 'The short, honest rules for using psst.',
		}),
	];
}

const updated = 'August 29, 2026';

export default function Terms() {
	return (
		<main className="mx-auto w-full max-w-2xl px-6 py-16">
			<Link to="/" className="font-serif text-2xl italic leading-none">
				psst
			</Link>

			<h1 className="mt-10 font-serif text-4xl">Terms</h1>
			<p className="mt-2 text-ink-faint text-sm">Last updated {updated}</p>

			<div className="mt-8 space-y-6 text-ink-soft leading-relaxed [&_h2]:font-serif [&_h2]:text-2xl [&_h2]:text-ink [&_strong]:text-ink">
				<p>
					psst is a private shared canvas for small groups. Using it means agreeing to these terms —
					kept short on purpose.
				</p>

				<h2>Your content is yours</h2>
				<p>
					Everything you drop on a canvas belongs to you. You give us only the permission needed to
					store it and show it to the people in your space — nothing more. Delete it and that
					permission ends.
				</p>

				<h2>Be decent</h2>
				<p>
					Don't use psst to harass people, break the law, spread malware, or post content you don't
					have the right to share. Spaces are private, but they're not a shield for causing harm. We
					can suspend accounts that do this.
				</p>

				<h2>Your account</h2>
				<p>
					Keep your sign-in to yourself; you're responsible for what happens under your account. You
					can stop using psst any time — write to{' '}
					<a href="mailto:hello@psst.you" className="text-accent-deep underline">
						hello@psst.you
					</a>{' '}
					to have your account and its content deleted.
				</p>

				<h2>The service</h2>
				<p>
					psst is provided as-is. We work to keep it fast and safe, but we can't promise it will
					never be down or that nothing will ever be lost — keep copies of anything irreplaceable.
					We may change or discontinue features; if we ever shut down, we'll give you notice and a
					way to get your things out.
				</p>

				<h2>Changes</h2>
				<p>
					If these terms change in a way that matters, we'll say so on this page before it takes
					effect. Using psst after that means you accept the new terms.
				</p>
			</div>

			<p className="mt-12 text-ink-faint text-sm">
				<Link to="/privacy" className="underline">
					Privacy
				</Link>
			</p>
		</main>
	);
}
