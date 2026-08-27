import { Link } from 'react-router';

/** A playful die-cut sticker floating over the backdrop. */
function FloatSticker({ emoji, className }: { emoji: string; className: string }) {
	return (
		<span
			aria-hidden
			className={`absolute grid h-16 w-16 place-items-center rounded-[38%] bg-card text-3xl shadow-card ring-1 ring-line/60 ${className}`}
		>
			{emoji}
		</span>
	);
}

/**
 * The welcome-sheet pattern: a warm full-bleed moment up top, one sheet
 * sliding over it with a single clear action inside.
 */
export function AuthCard({
	title,
	subtitle,
	children,
}: {
	title: string;
	subtitle?: React.ReactNode;
	children: React.ReactNode;
}) {
	return (
		<main className="flex min-h-svh flex-col">
			{/* The moment: pastel wash + a few keepsakes drifting */}
			<div className="relative min-h-40 flex-1 overflow-hidden bg-[radial-gradient(120%_90%_at_20%_10%,var(--color-sky)_0%,transparent_55%),radial-gradient(110%_80%_at_85%_25%,var(--color-blush)_0%,transparent_50%),radial-gradient(120%_90%_at_50%_95%,var(--color-butter)_0%,transparent_55%)]">
				<FloatSticker emoji="💌" className="-rotate-12 top-[22%] left-[16%]" />
				<FloatSticker emoji="🐸" className="top-[14%] right-[20%] rotate-6" />
				<FloatSticker emoji="🌷" className="bottom-[16%] left-[38%] rotate-3" />
				<Link
					to="/"
					aria-label="psst home"
					className="absolute top-6 left-1/2 -translate-x-1/2 font-serif text-3xl italic leading-none"
				>
					psst
				</Link>
			</div>

			{/* The sheet */}
			<div className="relative z-10 mx-auto w-full max-w-md">
				<div className="-mt-6 animate-pop-in rounded-t-3xl border border-line border-b-0 bg-card px-6 pt-8 pb-10 shadow-lift sm:mb-10 sm:rounded-3xl sm:border-b">
					<div className="mb-6 text-center">
						<h1 className="font-serif text-3xl leading-tight">{title}</h1>
						{subtitle ? <p className="mt-1 text-ink-soft text-sm">{subtitle}</p> : null}
					</div>
					{children}
				</div>
			</div>
		</main>
	);
}
