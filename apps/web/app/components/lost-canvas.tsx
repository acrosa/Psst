import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Board } from '~/components/canvas/board';
import { demoItem } from '~/components/canvas/demo-item';

/**
 * The lost page, as a canvas: a few scraps someone left behind, read-only.
 * The message is on the board itself — the page is the thing it describes.
 */
const strays = [
	demoItem({
		id: 'lost-note',
		type: 'note',
		text: 'nothing lives at this address',
		x: -420,
		y: -200,
		rotation: -2,
	}),
	demoItem({
		id: 'lost-note-2',
		type: 'note',
		text: 'maybe it was archived with yesterday',
		x: 190,
		y: 140,
		rotation: 1.5,
		authorId: 'demo-brendi',
		authorName: 'Brendi',
	}),
	demoItem({ id: 'lost-moon', type: 'emoji', text: '🌙', x: 300, y: -230, rotation: 6 }),
	demoItem({ id: 'lost-bubbles', type: 'emoji', text: '🫧', x: -300, y: 220, rotation: -5 }),
];

export function LostCanvas({ title, detail }: { title: string; detail: string }) {
	const [boardReady, setBoardReady] = useState(false);
	useEffect(() => setBoardReady(true), []);

	return (
		<div className="relative h-svh overflow-hidden">
			{boardReady ? (
				<div className="absolute inset-0">
					<Board items={strays} currentUserId="" frozen publicView />
				</div>
			) : null}

			<main className="pointer-events-none relative z-10 flex h-full flex-col items-center justify-center gap-5 px-6 text-center">
				<Link to="/" className="pointer-events-auto font-serif text-2xl italic leading-none">
					psst
				</Link>
				<h1 className="max-w-lg font-serif text-4xl leading-tight sm:text-5xl">{title}</h1>
				<p className="max-w-sm text-ink-soft">{detail}</p>
				<Link
					to="/"
					className="pointer-events-auto rounded-lg bg-accent px-5 py-2.5 font-medium text-sm text-white shadow-card transition hover:bg-accent-deep"
				>
					Take me home
				</Link>
			</main>
		</div>
	);
}
