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
		<header className="flex items-center justify-between gap-2 px-4 py-2.5 sm:gap-4 sm:px-6">
			{/* On phones, page content leads the bar; the wordmark keeps desktop. */}
			<Link
				to="/spaces"
				aria-label="Your spaces"
				className={cn('shrink-0', children && 'hidden sm:block')}
			>
				<span className="font-serif text-2xl italic leading-none">psst</span>
			</Link>

			<div
				className={cn(
					'flex min-w-0 flex-1 items-center',
					children ? 'justify-start sm:justify-center' : 'justify-center',
				)}
			>
				{children}
			</div>

			<UserMenu name={user.name} image={user.image} menuLinks={menuLinks} />
		</header>
	);
}
