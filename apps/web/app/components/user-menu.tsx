import { useEffect, useRef, useState } from 'react';
import { Form, Link } from 'react-router';
import {
	ChevronDownIcon,
	InviteIcon,
	ProfileIcon,
	SettingsIcon,
	SignOutIcon,
	SpacesIcon,
	TimelineIcon,
} from '~/components/icons';
import { ProfileDialog } from '~/components/profile-dialog';
import { Avatar } from '~/components/ui/avatar';
import { cn } from '~/lib/cn';

export type MenuLink = {
	label: string;
	to?: string;
	onClick?: () => void;
	icon?: 'settings' | 'invite' | 'timeline' | 'spaces';
	/** Rendered only below the sm breakpoint (the header keeps it on desktop). */
	mobileOnly?: boolean;
};

const MENU_ICONS = {
	settings: SettingsIcon,
	invite: InviteIcon,
	timeline: TimelineIcon,
	spaces: SpacesIcon,
} as const;

const itemClasses =
	'flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm transition hover:bg-paper-deep';

/**
 * The whole account corner: avatar + name opens a small menu — profile,
 * page-specific entries (invite, timeline, settings), sign out.
 */
export function UserMenu({
	name,
	image,
	menuLinks,
}: {
	name: string | null;
	image?: string | null;
	menuLinks?: MenuLink[];
}) {
	const [open, setOpen] = useState(false);
	const [editingProfile, setEditingProfile] = useState(false);
	const rootRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!open) return;
		function onPointerDown(event: PointerEvent) {
			if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
				setOpen(false);
			}
		}
		function onKeyDown(event: KeyboardEvent) {
			if (event.key === 'Escape') setOpen(false);
		}
		document.addEventListener('pointerdown', onPointerDown);
		document.addEventListener('keydown', onKeyDown);
		return () => {
			document.removeEventListener('pointerdown', onPointerDown);
			document.removeEventListener('keydown', onKeyDown);
		};
	}, [open]);

	return (
		<div className="relative shrink-0" ref={rootRef}>
			<button
				type="button"
				aria-label="Account menu"
				aria-expanded={open}
				onClick={() => setOpen((value) => !value)}
				className="flex items-center gap-2 rounded-full py-1 pr-2 pl-1 transition hover:bg-paper-deep"
			>
				<Avatar name={name} image={image} />
				<span className="hidden max-w-32 truncate text-sm sm:inline">{name}</span>
				<ChevronDownIcon className="h-3 w-3 text-ink-faint" />
			</button>

			{open ? (
				<div className="absolute top-full right-0 z-30 mt-1.5 w-52 animate-pop-in rounded-lg border border-line bg-card p-1 shadow-lift">
					<button
						type="button"
						onClick={() => {
							setOpen(false);
							setEditingProfile(true);
						}}
						className={itemClasses}
					>
						<ProfileIcon className="h-4 w-4 text-ink-soft" />
						Profile
					</button>

					{menuLinks?.map((link) => {
						const Icon = MENU_ICONS[link.icon ?? 'settings'];
						const classes = cn(itemClasses, link.mobileOnly && 'sm:hidden');
						return link.to ? (
							<Link
								key={link.label}
								to={link.to}
								onClick={() => setOpen(false)}
								className={classes}
							>
								<Icon className="h-4 w-4 text-ink-soft" />
								{link.label}
							</Link>
						) : (
							<button
								key={link.label}
								type="button"
								onClick={() => {
									setOpen(false);
									link.onClick?.();
								}}
								className={classes}
							>
								<Icon className="h-4 w-4 text-ink-soft" />
								{link.label}
							</button>
						);
					})}

					<div className="mx-2 my-1 h-px bg-line" />

					<Form method="post" action="/logout">
						<button type="submit" className={itemClasses}>
							<SignOutIcon className="h-4 w-4 text-ink-soft" />
							Sign out
						</button>
					</Form>
				</div>
			) : null}

			<ProfileDialog
				open={editingProfile}
				onClose={() => setEditingProfile(false)}
				name={name}
				image={image}
			/>
		</div>
	);
}
