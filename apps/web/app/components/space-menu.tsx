import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { ChevronDownIcon, SpacesIcon, TimelineIcon } from '~/components/icons';

const itemClasses =
	'flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm transition hover:bg-paper-deep';

/**
 * The space's own name, and the two places it leads: back through its days,
 * or out to the other spaces. A canvas shouldn't carry links it rarely needs.
 */
export function SpaceMenu({
	spaceId,
	emoji,
	name,
	subtitle,
}: {
	spaceId: string;
	emoji: string;
	name: string;
	subtitle?: string;
}) {
	const [open, setOpen] = useState(false);
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
		<div className="relative min-w-0" ref={rootRef}>
			<button
				type="button"
				aria-label="This space"
				aria-expanded={open}
				onClick={() => setOpen((value) => !value)}
				className="-mx-1.5 -my-1 flex min-w-0 items-center gap-2 rounded-lg px-1.5 py-1 transition hover:bg-paper-deep sm:gap-3"
			>
				<span className="shrink-0 text-xl sm:text-2xl" aria-hidden>
					{emoji}
				</span>
				<span className="min-w-0 text-left">
					<span className="block truncate font-medium text-sm leading-tight sm:text-base">
						{name}
					</span>
					{subtitle ? (
						<span className="hidden truncate text-ink-faint text-xs leading-tight sm:block">
							{subtitle}
						</span>
					) : null}
				</span>
				<ChevronDownIcon className="h-3 w-3 shrink-0 text-ink-faint" />
			</button>

			{open ? (
				<div className="absolute top-full left-0 z-30 mt-1 w-48 rounded-xl border border-line bg-card p-1 shadow-lift">
					<Link
						to={`/spaces/${spaceId}/days`}
						className={itemClasses}
						onClick={() => setOpen(false)}
					>
						<TimelineIcon className="h-4 w-4 text-ink-soft" />
						Timeline
					</Link>
					<Link to="/spaces" className={itemClasses} onClick={() => setOpen(false)}>
						<SpacesIcon className="h-4 w-4 text-ink-soft" />
						All spaces
					</Link>
				</div>
			) : null}
		</div>
	);
}
