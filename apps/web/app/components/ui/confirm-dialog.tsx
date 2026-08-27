import { Button } from './button';
import { Dialog } from './dialog';

/** A soft "are you sure?" — one danger action, one way back. */
export function ConfirmDialog({
	open,
	onClose,
	onConfirm,
	title,
	message,
	confirmLabel,
	cancelLabel = 'Keep it',
}: {
	open: boolean;
	onClose: () => void;
	onConfirm: () => void;
	title: string;
	message: string;
	confirmLabel: string;
	cancelLabel?: string;
}) {
	return (
		<Dialog open={open} onClose={onClose} title={title}>
			<p className="text-ink-soft text-sm">{message}</p>
			<div className="mt-5 flex justify-end gap-2">
				<Button variant="ghost" onClick={onClose}>
					{cancelLabel}
				</Button>
				<Button
					onClick={() => {
						onConfirm();
						onClose();
					}}
				>
					{confirmLabel}
				</Button>
			</div>
		</Dialog>
	);
}
