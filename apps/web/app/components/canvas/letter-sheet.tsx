import { cn } from '~/lib/cn';
import { SHEET } from '~/lib/hand';

/**
 * The Sunday letter's sheet: thin paper folded in thirds — two faint creases
 * where it came out of the envelope — with the hand's ink on it. The ink is
 * the `ink` token, so after sundown the page inverts with the rest of the
 * board. Shared by the board node, the reading view, and the design gallery.
 */
export function LetterSheet({ d, className }: { d: string; className?: string }) {
	return (
		<div className={cn('relative h-full w-full rounded-md bg-card shadow-card', className)}>
			<Crease at="top-1/3" />
			<Crease at="top-2/3" />
			<svg
				viewBox={`0 0 ${SHEET.wMm} ${SHEET.hMm}`}
				className="absolute inset-0 h-full w-full"
				aria-hidden="true"
			>
				<path d={d} fill="var(--color-ink)" />
			</svg>
		</div>
	);
}

function Crease({ at }: { at: string }) {
	return (
		<span
			aria-hidden
			className={cn(
				'pointer-events-none absolute right-0 left-0 h-[7px] bg-gradient-to-b from-ink/[0.045] to-transparent',
				'before:absolute before:top-0 before:right-0 before:left-0 before:h-px before:bg-line/70',
				at,
			)}
		/>
	);
}
