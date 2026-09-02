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
		// Three columns with equal sides: the middle sits on the viewport's
		// centre line, however wide the wordmark or the account corner grow.
		<header className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-4 py-2.5 sm:gap-4 sm:px-6">
			{/* On phones, page content leads the bar; the wordmark keeps desktop. */}
			<Link
				to="/spaces"
				aria-label="Your spaces"
				className={cn('justify-self-start', children && 'hidden sm:block')}
			>
				<span className="font-serif text-2xl italic leading-none">psst</span>
			</Link>

			<div className="flex min-w-0 items-center justify-center">{children}</div>

			<span className="justify-self-end">
				<UserMenu name={user.name} image={user.image} menuLinks={menuLinks} />
			</span>
		</header>
	);
}
