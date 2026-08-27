import { Link } from 'react-router';

/**
 * Auth as a strict single column: wordmark, title, form. No decoration —
 * the grid and the negative space are the design.
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
		<main className="mx-auto flex min-h-svh w-full max-w-sm flex-col justify-center px-6 py-16">
			<Link to="/" aria-label="psst home" className="font-serif text-2xl italic leading-none">
				psst
			</Link>
			<h1 className="mt-10 font-serif text-3xl leading-tight">{title}</h1>
			{subtitle ? <p className="mt-2 text-ink-soft text-sm">{subtitle}</p> : null}
			<div className="mt-8">{children}</div>
		</main>
	);
}
