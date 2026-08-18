import { Form, Link } from 'react-router';
import { Button } from '~/components/ui/button';

export function AppHeader({
	userName,
	children,
}: {
	userName: string | null;
	/** Optional page-specific controls rendered in the middle of the bar. */
	children?: React.ReactNode;
}) {
	return (
		<header className="flex items-center justify-between gap-4 px-4 py-3 sm:px-6">
			<Link to="/spaces" className="flex items-center gap-2 text-lg" aria-label="Your spaces">
				<span aria-hidden>🤫</span>
				<span className="font-hand text-2xl leading-none">psst</span>
			</Link>

			<div className="flex min-w-0 flex-1 items-center justify-center">{children}</div>

			<div className="flex shrink-0 items-center gap-2">
				{userName ? (
					<span className="hidden text-sm text-ink-soft sm:inline">{userName}</span>
				) : null}
				<Form method="post" action="/logout">
					<Button type="submit" variant="ghost" size="sm">
						Sign out
					</Button>
				</Form>
			</div>
		</header>
	);
}
