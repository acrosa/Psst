import { useEffect, useRef, useState } from 'react';
import { useFetcher } from 'react-router';
import { Button } from '~/components/ui/button';
import { STICKER_EMOJIS } from '~/lib/design';

function looksLikeUrl(value: string): boolean {
	if (/^https?:\/\//i.test(value)) return true;
	return !value.includes(' ') && /^[\w-]+(\.[\w-]+)+(\/.*)?$/.test(value);
}

function normalizeUrl(value: string): string {
	return /^https?:\/\//i.test(value) ? value : `https://${value}`;
}

/**
 * One input, three kinds of keepsakes: a URL becomes a postcard, words become
 * a paper slip, the tray drops emoji stickers.
 */
export function Composer() {
	const fetcher = useFetcher<{ error?: string }>();
	const stickerFetcher = useFetcher();
	const photoFetcher = useFetcher<{ error?: string }>();
	const inputRef = useRef<HTMLInputElement>(null);
	const fileRef = useRef<HTMLInputElement>(null);
	const [trayOpen, setTrayOpen] = useState(false);

	const submitting = fetcher.state !== 'idle';
	const uploading = photoFetcher.state !== 'idle';

	useEffect(() => {
		if (fetcher.state === 'idle' && fetcher.data && !fetcher.data.error && inputRef.current) {
			inputRef.current.value = '';
		}
	}, [fetcher.state, fetcher.data]);

	function drop() {
		const raw = inputRef.current?.value.trim();
		if (!raw || submitting) return;
		const isUrl = looksLikeUrl(raw);
		fetcher.submit(
			{
				intent: 'create-item',
				kind: isUrl ? 'link' : 'note',
				content: isUrl ? normalizeUrl(raw) : raw,
			},
			{ method: 'post' },
		);
	}

	return (
		<div className="pointer-events-none absolute inset-x-0 bottom-5 z-10 flex justify-center px-4">
			<div className="pointer-events-auto w-full max-w-xl">
				{fetcher.data?.error || photoFetcher.data?.error ? (
					<p className="mb-2 rounded-lg bg-accent-soft px-3 py-1.5 text-center text-sm text-accent-deep shadow-card">
						{fetcher.data?.error ?? photoFetcher.data?.error}
					</p>
				) : null}

				{trayOpen ? (
					<div className="mb-2 rounded-xl border border-line bg-card p-3 shadow-lift">
						<div className="grid grid-cols-8 gap-1">
							{STICKER_EMOJIS.map((emoji) => (
								<button
									key={emoji}
									type="button"
									aria-label={`Drop ${emoji} sticker`}
									onClick={() => {
										stickerFetcher.submit(
											{ intent: 'create-item', kind: 'emoji', content: emoji },
											{ method: 'post' },
										);
										setTrayOpen(false);
									}}
									className="grid h-10 w-10 place-items-center rounded-lg text-2xl transition hover:scale-110 hover:bg-paper-deep"
								>
									{emoji}
								</button>
							))}
						</div>
					</div>
				) : null}

				<form
					onSubmit={(event) => {
						event.preventDefault();
						drop();
					}}
					className="flex items-center gap-2 rounded-full border border-line bg-card py-1.5 pr-1.5 pl-2 shadow-lift"
				>
					<button
						type="button"
						aria-label="Sticker tray"
						aria-expanded={trayOpen}
						onClick={() => setTrayOpen((open) => !open)}
						className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-xl transition hover:bg-paper-deep"
					>
						😊
					</button>
					<button
						type="button"
						aria-label="Add a photo"
						disabled={uploading}
						onClick={() => fileRef.current?.click()}
						className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-xl transition hover:bg-paper-deep disabled:opacity-50"
					>
						{uploading ? '⏳' : '🖼️'}
					</button>
					<input
						ref={fileRef}
						type="file"
						accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
						aria-label="Photo file"
						className="hidden"
						onChange={(event) => {
							const file = event.currentTarget.files?.[0];
							event.currentTarget.value = '';
							if (!file) return;
							const formData = new FormData();
							formData.set('intent', 'create-image');
							formData.set('file', file);
							photoFetcher.submit(formData, {
								method: 'post',
								encType: 'multipart/form-data',
							});
						}}
					/>
					<input
						ref={inputRef}
						data-testid="composer-input"
						placeholder="drop a link, or whisper a note…"
						autoComplete="off"
						className="h-9 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-ink-faint"
					/>
					<Button type="submit" size="sm" disabled={submitting} className="rounded-full">
						{submitting ? '…' : 'Drop'}
					</Button>
				</form>
			</div>
		</div>
	);
}
