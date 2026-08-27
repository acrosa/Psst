import { useEffect, useRef, useState } from 'react';
import { Form, Link, useRevalidator } from 'react-router';
import { CameraIcon, ChevronDownIcon, SettingsIcon, SignOutIcon } from '~/components/icons';
import { Avatar } from '~/components/ui/avatar';

export type MenuLink = { label: string; to: string };

const itemClasses =
	'flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm transition hover:bg-paper-deep';

/**
 * The whole account corner: avatar + name opens a small menu — change photo,
 * page-specific links (space settings), sign out.
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
	const [uploading, setUploading] = useState(false);
	const rootRef = useRef<HTMLDivElement>(null);
	const fileRef = useRef<HTMLInputElement>(null);
	const revalidator = useRevalidator();

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

	async function uploadAvatar(file: File) {
		setUploading(true);
		try {
			const formData = new FormData();
			formData.set('file', file);
			await fetch('/api/avatar', { method: 'POST', body: formData });
			revalidator.revalidate();
		} finally {
			setUploading(false);
			setOpen(false);
		}
	}

	return (
		<div className="relative" ref={rootRef}>
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
						disabled={uploading}
						onClick={() => fileRef.current?.click()}
						className={itemClasses}
					>
						<CameraIcon className="h-4 w-4 text-ink-soft" />
						{uploading ? 'Uploading…' : 'Change photo'}
					</button>
					<input
						ref={fileRef}
						type="file"
						accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
						aria-label="Avatar file"
						className="hidden"
						onChange={(event) => {
							const file = event.currentTarget.files?.[0];
							event.currentTarget.value = '';
							if (file) void uploadAvatar(file);
						}}
					/>

					{menuLinks?.map((link) => (
						<Link key={link.to} to={link.to} onClick={() => setOpen(false)} className={itemClasses}>
							<SettingsIcon className="h-4 w-4 text-ink-soft" />
							{link.label}
						</Link>
					))}

					<div className="mx-2 my-1 h-px bg-line" />

					<Form method="post" action="/logout">
						<button type="submit" className={itemClasses}>
							<SignOutIcon className="h-4 w-4 text-ink-soft" />
							Sign out
						</button>
					</Form>
				</div>
			) : null}
		</div>
	);
}
