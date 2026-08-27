import { useEffect, useRef } from 'react';
import { cn } from '~/lib/cn';

/** Native <dialog>-based modal — no portal machinery, backdrop styled in app.css. */
export function Dialog({
	open,
	onClose,
	title,
	children,
	className,
}: {
	open: boolean;
	onClose: () => void;
	title?: string;
	children: React.ReactNode;
	className?: string;
}) {
	const ref = useRef<HTMLDialogElement>(null);

	useEffect(() => {
		const dialog = ref.current;
		if (!dialog) return;
		if (open && !dialog.open) {
			dialog.showModal();
		} else if (!open && dialog.open) {
			dialog.close();
		}
	}, [open]);

	return (
		// biome-ignore lint/a11y/useKeyWithClickEvents: backdrop click is supplementary — native <dialog> already closes on Escape
		<dialog
			ref={ref}
			onClose={onClose}
			onClick={(event) => {
				// Click on the backdrop (the dialog element itself) closes.
				if (event.target === ref.current) onClose();
			}}
			className={cn(
				'm-auto w-[min(28rem,calc(100vw-2rem))] rounded-xl border border-line bg-card p-0 shadow-lift',
				'backdrop:bg-ink/35',
				className,
			)}
		>
			<div className="animate-pop-in p-5">
				{title ? <h2 className="mb-4 font-serif text-2xl">{title}</h2> : null}
				{children}
			</div>
		</dialog>
	);
}
