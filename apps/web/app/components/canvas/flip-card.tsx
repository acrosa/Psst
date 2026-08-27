import { useEffect, useRef, useState } from 'react';
import { ResizeIcon } from '~/components/icons';
import { clampScale } from '~/lib/design';

/** True while Option (Alt) is held — the resize affordance's on-switch. */
function useAltHeld() {
	const [held, setHeld] = useState(false);
	useEffect(() => {
		const down = (event: KeyboardEvent) => {
			if (event.key === 'Alt') setHeld(true);
		};
		const up = (event: KeyboardEvent) => {
			if (event.key === 'Alt') setHeld(false);
		};
		const clear = () => setHeld(false);
		window.addEventListener('keydown', down);
		window.addEventListener('keyup', up);
		window.addEventListener('blur', clear);
		return () => {
			window.removeEventListener('keydown', down);
			window.removeEventListener('keyup', up);
			window.removeEventListener('blur', clear);
		};
	}, []);
	return held;
}

/**
 * The flip shell every board item lives in. Click flips (pointer-travel under
 * 6px, so drags never flip); interactive elements and anything marked
 * data-noflip are exempt. The badge row beneath the card (see CardBadges) is
 * the visible flip affordance. Hold Option and a corner handle appears on
 * hover — drag it to resize (clamped).
 */
export function FlipCard({
	width,
	height,
	rotation,
	flipped,
	onToggle,
	front,
	back,
	badges,
	scale = 1,
	onResize,
	flippable = true,
	onLike,
}: {
	width: number;
	height: number;
	rotation: number;
	flipped: boolean;
	onToggle: () => void;
	front: React.ReactNode;
	back?: React.ReactNode;
	/** The caption row beneath the card (comments, reactions) — also flips it. */
	badges?: React.ReactNode;
	/** Server-known size multiplier for this card. */
	scale?: number;
	/** Present on live boards; absent → the card doesn't resize (frozen days). */
	onResize?: (scale: number) => void;
	/** Stickers don't flip — no back, no click-to-turn. */
	flippable?: boolean;
	/** Double-tap on the front toggles a 🫶 (with a burst). */
	onLike?: () => void;
}) {
	const downRef = useRef<{ x: number; y: number } | null>(null);
	const clickTimer = useRef<number | null>(null);
	const [burst, setBurst] = useState(0);
	const altHeld = useAltHeld();
	const [dragScale, setDragScale] = useState<number | null>(null);
	// Keeps the dropped size until the server round-trips it back to us.
	const [pendingScale, setPendingScale] = useState<number | null>(null);

	useEffect(() => {
		if (pendingScale !== null && Math.abs(scale - pendingScale) < 0.01) {
			setPendingScale(null);
		}
	}, [scale, pendingScale]);

	const liveScale = dragScale ?? pendingScale ?? scale;

	function startResize(event: React.PointerEvent<HTMLButtonElement>) {
		if (!onResize) return;
		event.preventDefault();
		event.stopPropagation();
		const handle = event.currentTarget;
		handle.setPointerCapture(event.pointerId);
		const startX = event.clientX;
		const startY = event.clientY;
		const startScale = liveScale;
		let latest = startScale;

		const move = (moveEvent: PointerEvent) => {
			const travel = moveEvent.clientX - startX + (moveEvent.clientY - startY);
			latest = clampScale(startScale + travel / (width + height));
			setDragScale(latest);
		};
		const stop = () => {
			handle.removeEventListener('pointermove', move);
			setDragScale(null);
			if (Math.abs(latest - scale) > 0.01) {
				setPendingScale(latest);
				onResize(latest);
			}
		};
		handle.addEventListener('pointermove', move);
		handle.addEventListener('pointerup', stop, { once: true });
	}

	return (
		// biome-ignore lint/a11y/useKeyWithClickEvents: cards flip via the badge button beneath as well
		<div
			className="group"
			style={{ width: width * liveScale, height: height * liveScale, perspective: '1200px' }}
			onPointerDown={(event) => {
				downRef.current = { x: event.clientX, y: event.clientY };
			}}
			onClick={(event) => {
				if (!flippable) return;
				const target = event.target as HTMLElement;
				if (target.closest('input, textarea, button, a, [data-noflip]')) return;
				const down = downRef.current;
				if (!down || Math.hypot(event.clientX - down.x, event.clientY - down.y) >= 6) return;
				// From the back, flip home instantly. On the front, wait a beat to
				// tell a flip (single tap) from a like (double tap).
				if (flipped || !onLike) {
					onToggle();
					return;
				}
				if (clickTimer.current) {
					window.clearTimeout(clickTimer.current);
					clickTimer.current = null;
					setBurst((count) => count + 1);
					onLike();
				} else {
					clickTimer.current = window.setTimeout(() => {
						clickTimer.current = null;
						onToggle();
					}, 250);
				}
			}}
		>
			<div
				className="relative h-full w-full transition-transform duration-500 [transform-style:preserve-3d]"
				style={{ transform: `rotate(${rotation}deg)${flipped ? ' rotateY(180deg)' : ''}` }}
			>
				<div className="absolute inset-0 [backface-visibility:hidden]">
					{front}
					{badges}
				</div>
				{flippable ? (
					<div className="absolute inset-0 [backface-visibility:hidden] [transform:rotateY(180deg)]">
						{back}
					</div>
				) : null}
			</div>

			{burst > 0 ? (
				<span key={burst} className="like-burst" aria-hidden>
					🫶
				</span>
			) : null}

			{onResize && altHeld ? (
				<button
					type="button"
					data-testid="resize-handle"
					aria-label="Drag to resize"
					title="Drag to resize"
					onPointerDown={startResize}
					className="nodrag -right-2 -bottom-2 absolute grid h-6 w-6 cursor-nwse-resize place-items-center rounded-full border border-accent/60 bg-card text-accent-deep opacity-0 shadow-card transition-opacity group-hover:opacity-100"
				>
					<ResizeIcon className="h-3 w-3" />
				</button>
			) : null}
		</div>
	);
}
