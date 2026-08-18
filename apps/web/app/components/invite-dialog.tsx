import { useEffect, useRef, useState } from 'react';
import { useFetcher } from 'react-router';
import { Button } from '~/components/ui/button';
import { Dialog } from '~/components/ui/dialog';
import { Input } from '~/components/ui/input';

type InviteActionData = { inviteUrl?: string; emailedTo?: string; error?: string };

/**
 * The heart of the loop: one button, one link. Opening the dialog creates the
 * invite immediately so the link is ready to copy; emailing it is optional.
 */
export function InviteDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
	const linkFetcher = useFetcher<InviteActionData>();
	const emailFetcher = useFetcher<InviteActionData>();
	const requested = useRef(false);
	const [copied, setCopied] = useState(false);

	useEffect(() => {
		if (open && !requested.current) {
			requested.current = true;
			linkFetcher.submit({ intent: 'create-invite' }, { method: 'post' });
		}
		if (!open) {
			setCopied(false);
		}
	}, [open, linkFetcher]);

	const inviteUrl = linkFetcher.data?.inviteUrl;

	async function copy() {
		if (!inviteUrl) return;
		try {
			await navigator.clipboard.writeText(inviteUrl);
		} catch {
			// clipboard can be unavailable — the input is selectable either way
		}
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	}

	return (
		<Dialog open={open} onClose={onClose} title="Save someone a spot">
			<p className="mb-3 text-sm text-ink-soft">
				Send this link to someone close — they'll land right on this canvas.
			</p>

			<div className="flex gap-2">
				<Input
					readOnly
					data-testid="invite-link"
					value={inviteUrl ?? ''}
					placeholder="Making a link…"
					onFocus={(event) => event.currentTarget.select()}
					className="font-mono text-xs"
				/>
				<Button onClick={copy} disabled={!inviteUrl} className="shrink-0">
					{copied ? 'Copied ✓' : 'Copy'}
				</Button>
			</div>

			<div className="my-4 flex items-center gap-3 text-xs text-ink-faint">
				<span className="h-px flex-1 bg-line" />
				or email it
				<span className="h-px flex-1 bg-line" />
			</div>

			{emailFetcher.data?.emailedTo ? (
				<p className="rounded-lg bg-meadow px-3 py-2 text-sm">
					Sent 💌 to {emailFetcher.data.emailedTo}
				</p>
			) : (
				<emailFetcher.Form method="post" className="flex gap-2">
					<input type="hidden" name="intent" value="email-invite" />
					<Input
						type="email"
						name="email"
						placeholder="their@email.com"
						aria-label="Email address"
						required
					/>
					<Button
						type="submit"
						variant="soft"
						className="shrink-0"
						disabled={emailFetcher.state !== 'idle'}
					>
						{emailFetcher.state === 'idle' ? 'Send' : 'Sending…'}
					</Button>
				</emailFetcher.Form>
			)}
			{emailFetcher.data?.error ? (
				<p className="mt-2 text-sm text-accent-deep">{emailFetcher.data.error}</p>
			) : null}
		</Dialog>
	);
}
