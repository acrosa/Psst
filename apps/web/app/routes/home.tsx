import { useEffect, useState } from 'react';
import { Link, redirect } from 'react-router';
import { DemoBoard } from '~/components/canvas/demo-board';
import { getUser } from '~/lib/auth.server';
import { ogMeta } from '~/lib/og';
import type { Route } from './+types/home';
import './home.css';

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
	if (user) throw redirect('/spaces');
	return null;
}

export default function Home() {
	const [desktop, setDesktop] = useState(false);
	useEffect(() => {
		const media = window.matchMedia('(min-width: 1101px)');
		const update = () => setDesktop(media.matches);
		update();
		media.addEventListener('change', update);
		return () => media.removeEventListener('change', update);
	}, []);

	return (
		<div className="landing">
			<header className="landing-header">
				<Link to="/" className="landing-wordmark" aria-label="psst home">
					psst<span>·</span>
				</Link>
			</header>
			<main className="landing-main">
				<div className="landing-intro">
					<h1>
						A canvas for
						<br />
						the people you
						<br />
						<em>whisper to.</em>
					</h1>
					<p className="landing-description">
						Drop links, notes, photos and stickers on today’s canvas. Tomorrow, it becomes a page in
						your scrapbook.
					</p>
					<div className="landing-actions">
						<Link to="/register" className="landing-cta">
							Start a canvas
						</Link>
						<Link to="/login" className="landing-signin">
							Sign in
						</Link>
					</div>
					<footer className="landing-footer">
						<nav aria-label="Legal">
							<Link to="/privacy">Privacy</Link>
							<Link to="/terms">Terms</Link>
						</nav>
					</footer>
				</div>
				{desktop ? (
					<section
						className="landing-playground"
						aria-label="Try the canvas: drag cards, double-tap to like, or draw"
						aria-describedby="canvas-hint"
					>
						<div className="landing-canvas">
							<DemoBoard />
						</div>
						<p id="canvas-hint">Make yourself at home. Drag something.</p>
					</section>
				) : null}
			</main>
		</div>
	);
}
