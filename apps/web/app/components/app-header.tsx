import { Link } from 'react-router';
import { type MenuLink, UserMenu } from '~/components/user-menu';
import { cn } from '~/lib/cn';

export function AppHeader({
	user,
	menuLinks,
	children,
}: {
	user: { name: string | null; image?: string | null };
	/** Extra entries for the account menu (e.g. space settings). */
	menuLinks?: MenuLink[];
	/** Optional page-specific controls rendered in the middle of the bar. */
	children?: React.ReactNode;
}) {
	return (
		// Phones: one row — the page leads, the account corner ends it.
		// Desktop: three columns with equal sides, so the middle sits on the
		// viewport's centre line however wide the wordmark or the corner grow.
		<header className="flex items-center gap-2 px-4 py-2.5 sm:grid sm:grid-cols-[1fr_auto_1fr] sm:gap-4 sm:px-6">
			{/* On phones, page content leads the bar; the wordmark keeps desktop. */}
			<Link
				to="/spaces"
				aria-label="Your spaces"
				className={cn('sm:justify-self-start', children && 'hidden sm:block')}
			>
				<span className="font-serif text-2xl italic leading-none">psst</span>
			</Link>

			{/* Takes the slack on phones so long names truncate instead of
			    crowding the corner; centred in its own column on desktop. */}
			<div className="flex min-w-0 flex-1 items-center sm:justify-center">{children}</div>

			<span className="shrink-0 sm:justify-self-end">
				<UserMenu name={user.name} image={user.image} menuLinks={menuLinks} />
			</span>
		</header>
	);
}
