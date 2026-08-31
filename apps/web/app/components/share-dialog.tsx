import { useEffect, useRef, useState } from 'react';
import { useFetcher } from 'react-router';
import { Button } from '~/components/ui/button';
import { Dialog } from '~/components/ui/dialog';
import { Input } from '~/components/ui/input';

type ShareActionData = { shareUrl?: string; unshared?: boolean; error?: string };

/**
 * Share today with the world: opening the dialog mints the public link so
 * it's ready to copy. Read-only for viewers; stop sharing kills the link.
 */
export function ShareDialog({
	open,
	onClose,
	alreadyShared,
}: {
	open: boolean;
	onClose: () => void;
	alreadyShared: boolean;
}) {
	const shareFetcher = useFetcher<ShareActionData>();
	const requested = useRef(false);
	const [copied, setCopied] = useState(false);

	useEffect(() => {
		if (open && !requested.current) {
			requested.current = true;
			shareFetcher.submit({ intent: 'share-day' }, { method: 'post' });
		}
		if (!open) {
			setCopied(false);
		}
	}, [open, shareFetcher]);

	const shareUrl = shareFetcher.data?.unshared ? undefined : shareFetcher.data?.shareUrl;

	async function copy() {
		if (!shareUrl) return;
		try {
			await navigator.clipboard.writeText(shareUrl);
		} catch {
			// clipboard can be unavailable — the input is selectable either way
		}
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	}

	function stopSharing() {
		requested.current = false;
		shareFetcher.submit({ intent: 'unshare-day' }, { method: 'post' });
		onClose();
	}

	return (
		<Dialog open={open} onClose={onClose} title="Show this day around">
			<p className="mb-3 text-ink-soft text-sm">
				Anyone with this link can look at today's board — just look, not touch. Card backs stay
				between you.
			</p>

			<div className="flex gap-2">
				<Input
					readOnly
					data-testid="share-link"
					value={shareUrl ?? ''}
					placeholder="Making a link…"
					onFocus={(event) => event.currentTarget.select()}
					className="font-mono text-xs"
				/>
				<Button onClick={copy} disabled={!shareUrl} className="shrink-0">
					{copied ? 'Copied ✓' : 'Copy'}
				</Button>
			</div>

			{alreadyShared || shareUrl ? (
				<button
					type="button"
					onClick={stopSharing}
					className="mt-4 text-ink-faint text-sm underline underline-offset-2 transition hover:text-accent-deep"
				>
					Stop sharing — the link stops working
				</button>
			) : null}
		</Dialog>
	);
}
