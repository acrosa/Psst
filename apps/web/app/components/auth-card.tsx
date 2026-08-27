import { Link } from 'react-router';

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
		<main className="flex min-h-svh flex-col items-center justify-center p-6">
			<div className="w-full max-w-sm animate-pop-in">
				<div className="mb-6 flex flex-col items-center gap-3 text-center">
					<Link to="/" aria-label="psst home" className="font-serif text-4xl italic leading-none">
						psst
					</Link>
					<div>
						<h1 className="font-serif text-3xl leading-tight">{title}</h1>
						{subtitle ? <p className="mt-1 text-sm text-ink-soft">{subtitle}</p> : null}
					</div>
				</div>
				<div className="rounded-xl border border-line bg-card p-6 shadow-card">{children}</div>
			</div>
		</main>
	);
}
