import { useRef } from 'react';

/**
 * The flip shell every board item lives in. Click flips (pointer-travel under
 * 6px, so drags never flip); interactive elements and anything marked
 * data-noflip are exempt.
 */
export function FlipCard({
	width,
	height,
	rotation,
	flipped,
	onToggle,
	front,
	back,
}: {
	width: number;
	height: number;
	rotation: number;
	flipped: boolean;
	onToggle: () => void;
	front: React.ReactNode;
	back: React.ReactNode;
}) {
	const downRef = useRef<{ x: number; y: number } | null>(null);

	return (
		// biome-ignore lint/a11y/useKeyWithClickEvents: cards flip via the button affordance on the back as well
		<div
			style={{ width, height, perspective: '1200px' }}
			onPointerDown={(event) => {
				downRef.current = { x: event.clientX, y: event.clientY };
			}}
			onClick={(event) => {
				const target = event.target as HTMLElement;
				if (target.closest('input, textarea, button, a, [data-noflip]')) return;
				const down = downRef.current;
				if (down && Math.hypot(event.clientX - down.x, event.clientY - down.y) < 6) {
					onToggle();
				}
			}}
		>
			<div
				className="relative h-full w-full transition-transform duration-500 [transform-style:preserve-3d]"
				style={{ transform: `rotate(${rotation}deg)${flipped ? ' rotateY(180deg)' : ''}` }}
			>
				<div className="absolute inset-0 [backface-visibility:hidden]">{front}</div>
				<div className="absolute inset-0 [backface-visibility:hidden] [transform:rotateY(180deg)]">
					{back}
				</div>
			</div>
		</div>
	);
}
