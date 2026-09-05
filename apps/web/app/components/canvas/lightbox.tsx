import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { XIcon } from '~/components/icons';

/**
 * A photo (or a letter), big enough to actually look at. Rendered through a
 * portal: React Flow transforms the board, and a transformed ancestor would
 * otherwise become the containing block for anything fixed inside it.
 */
export function Lightbox({
	src,
	alt = '',
	label = 'Photo',
	children,
	onClose,
}: {
	src?: string;
	alt?: string;
	label?: string;
	/** Something other than a photo to look at, e.g. the letter's sheet. */
	children?: React.ReactNode;
	onClose: () => void;
}) {
	useEffect(() => {
		const onKey = (event: KeyboardEvent) => {
			if (event.key === 'Escape') onClose();
		};
		window.addEventListener('keydown', onKey);
		// The board scrolls and zooms underneath — hold it still.
		const previous = document.body.style.overflow;
		document.body.style.overflow = 'hidden';
		return () => {
			window.removeEventListener('keydown', onKey);
			document.body.style.overflow = previous;
		};
	}, [onClose]);

	if (typeof document === 'undefined') return null;

	return createPortal(
		// biome-ignore lint/a11y/noStaticElementInteractions: click-anywhere-to-close, Escape is handled above
		// biome-ignore lint/a11y/useKeyWithClickEvents: same
		<div
			className="fade-in fixed inset-0 z-50 flex animate-in items-center justify-center bg-ink/80 p-4 backdrop-blur-sm sm:p-10"
			onClick={onClose}
			role="dialog"
			aria-modal="true"
			aria-label={label}
		>
			{children ? (
				// A click (or key) inside is for the letter, not the curtain.
				<div
					className="max-h-full max-w-full"
					onClick={(event) => event.stopPropagation()}
					onKeyDown={(event) => event.stopPropagation()}
				>
					{children}
				</div>
			) : (
				<img
					src={src}
					alt={alt}
					draggable={false}
					className="max-h-full max-w-full rounded-lg object-contain shadow-lift"
					onClick={(event) => event.stopPropagation()}
				/>
			)}
			<button
				type="button"
				aria-label="Close"
				onClick={onClose}
				className="absolute top-4 right-4 grid h-10 w-10 place-items-center rounded-full bg-card/90 text-ink-soft shadow-card transition hover:text-ink"
			>
				<XIcon className="h-4 w-4" />
			</button>
		</div>,
		document.body,
	);
}
