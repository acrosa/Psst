import { Link } from 'react-router';
import { type MenuLink, UserMenu } from '~/components/user-menu';

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
		<header className="flex items-center justify-between gap-2 px-3 py-2.5 sm:gap-4 sm:px-6">
			<Link to="/spaces" aria-label="Your spaces" className="shrink-0">
				<span className="font-serif text-2xl italic leading-none">psst</span>
			</Link>

			<div className="flex min-w-0 flex-1 items-center justify-center">{children}</div>

			<UserMenu name={user.name} image={user.image} menuLinks={menuLinks} />
		</header>
	);
}
