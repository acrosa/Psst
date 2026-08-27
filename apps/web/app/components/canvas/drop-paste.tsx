import { useReactFlow } from '@xyflow/react';
import { useEffect, useRef, useState } from 'react';
import { useFetcher } from 'react-router';
import { ITEM_SIZES } from '~/lib/design';
import { looksLikeUrl, normalizeUrl } from '~/lib/links';

const IMAGE_MIMES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif']);
const MAX_BATCH = 8;

type Pending =
	| { kind: 'image'; file: File; x: number; y: number }
	| { kind: 'link' | 'note'; content: string; x: number; y: number };

/**
 * Drag things straight onto the board, or paste them anywhere: image files
 * become prints where they land, dragged links become postcards, loose text
 * becomes a slip. Creations run one at a time through a small queue.
 */
export function DropPasteLayer() {
	const { screenToFlowPosition } = useReactFlow();
	const fetcher = useFetcher<{ error?: string }>();
	const [queue, setQueue] = useState<Pending[]>([]);
	const [dragOver, setDragOver] = useState(false);
	const [notice, setNotice] = useState<string | null>(null);
	const dragDepth = useRef(0);

	const busy = fetcher.state !== 'idle';
	const working = busy || queue.length > 0;

	// Drain the queue one creation at a time — re-submitting a single fetcher
	// would cancel the upload still in flight.
	// biome-ignore lint/correctness/useExhaustiveDependencies: fetcher identity changes per render; state is the real trigger
	useEffect(() => {
		if (busy || queue.length === 0) return;
		const next = queue[0];
		setQueue((rest) => rest.slice(1));
		if (next.kind === 'image') {
			const formData = new FormData();
			formData.set('intent', 'create-image');
			formData.set('file', next.file);
			formData.set('x', String(next.x));
			formData.set('y', String(next.y));
			fetcher.submit(formData, { method: 'post', encType: 'multipart/form-data' });
		} else {
			fetcher.submit(
				{
					intent: 'create-item',
					kind: next.kind,
					content: next.content,
					x: String(next.x),
					y: String(next.y),
				},
				{ method: 'post' },
			);
		}
	}, [busy, queue.length]);

	useEffect(() => {
		/** Screen point → flow position, centered on the item (batches fan out). */
		function placeAt(clientX: number, clientY: number, type: keyof typeof ITEM_SIZES, index = 0) {
			const point = screenToFlowPosition({ x: clientX, y: clientY });
			const size = ITEM_SIZES[type];
			return { x: point.x - size.w / 2 + index * 24, y: point.y - size.h / 2 + index * 24 };
		}

		function ingestFiles(files: FileList, clientX: number, clientY: number) {
			const all = Array.from(files);
			const images = all.filter((file) => IMAGE_MIMES.has(file.type)).slice(0, MAX_BATCH);
			setNotice(images.length < all.length ? 'Photos only — png, jpg, webp, gif or avif.' : null);
			setQueue((rest) => [
				...rest,
				...images.map((file, index) => ({
					kind: 'image' as const,
					file,
					...placeAt(clientX, clientY, 'image', index),
				})),
			]);
		}

		function ingestText(raw: string, clientX: number, clientY: number) {
			const content = raw.trim();
			if (!content) return;
			const isUrl = looksLikeUrl(content);
			setNotice(null);
			setQueue((rest) => [
				...rest,
				{
					kind: isUrl ? 'link' : 'note',
					content: isUrl ? normalizeUrl(content) : content,
					...placeAt(clientX, clientY, isUrl ? 'link' : 'note'),
				},
			]);
		}

		function ingestUriList(uriList: string, clientX: number, clientY: number) {
			const urls = uriList
				.split('\n')
				.map((line) => line.trim())
				.filter((line) => line && !line.startsWith('#'))
				.slice(0, MAX_BATCH);
			setNotice(null);
			setQueue((rest) => [
				...rest,
				...urls.map((url, index) => ({
					kind: 'link' as const,
					content: url,
					...placeAt(clientX, clientY, 'link', index),
				})),
			]);
		}

		function hasPayload(event: DragEvent) {
			const types = event.dataTransfer?.types;
			return (
				!!types &&
				(types.includes('Files') || types.includes('text/uri-list') || types.includes('text/plain'))
			);
		}
		function onDragEnter(event: DragEvent) {
			if (!hasPayload(event)) return;
			event.preventDefault();
			dragDepth.current += 1;
			setDragOver(true);
		}
		function onDragOver(event: DragEvent) {
			if (!hasPayload(event)) return;
			event.preventDefault();
			if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
		}
		function onDragLeave(event: DragEvent) {
			if (!hasPayload(event)) return;
			dragDepth.current = Math.max(0, dragDepth.current - 1);
			if (dragDepth.current === 0) setDragOver(false);
		}
		function onDrop(event: DragEvent) {
			if (!hasPayload(event)) return;
			event.preventDefault();
			dragDepth.current = 0;
			setDragOver(false);
			const transfer = event.dataTransfer;
			if (!transfer) return;
			if (transfer.files.length > 0) {
				ingestFiles(transfer.files, event.clientX, event.clientY);
				return;
			}
			const uriList = transfer.getData('text/uri-list');
			if (uriList.trim()) {
				ingestUriList(uriList, event.clientX, event.clientY);
				return;
			}
			ingestText(transfer.getData('text/plain'), event.clientX, event.clientY);
		}
		function onPaste(event: ClipboardEvent) {
			const target = event.target;
			if (
				target instanceof Element &&
				target.closest('input, textarea, [contenteditable="true"], [contenteditable=""]')
			) {
				return; // typing somewhere — leave paste alone
			}
			const transfer = event.clipboardData;
			if (!transfer) return;
			const centerX = window.innerWidth / 2;
			const centerY = window.innerHeight / 2;
			if (transfer.files.length > 0) {
				event.preventDefault();
				ingestFiles(transfer.files, centerX, centerY);
				return;
			}
			const text = transfer.getData('text/plain');
			if (text.trim()) {
				event.preventDefault();
				ingestText(text, centerX, centerY);
			}
		}

		window.addEventListener('dragenter', onDragEnter);
		window.addEventListener('dragover', onDragOver);
		window.addEventListener('dragleave', onDragLeave);
		window.addEventListener('drop', onDrop);
		window.addEventListener('paste', onPaste);
		return () => {
			window.removeEventListener('dragenter', onDragEnter);
			window.removeEventListener('dragover', onDragOver);
			window.removeEventListener('dragleave', onDragLeave);
			window.removeEventListener('drop', onDrop);
			window.removeEventListener('paste', onPaste);
		};
	}, [screenToFlowPosition]);

	const error = notice ?? fetcher.data?.error ?? null;

	return (
		<>
			{dragOver ? (
				<div className="pointer-events-none absolute inset-0 z-20 grid place-items-center bg-paper/70 p-4 sm:p-8">
					<div className="grid h-full w-full place-items-center rounded-xl border-2 border-accent border-dashed bg-card/50">
						<div className="animate-pop-in text-center">
							<div className="text-5xl" aria-hidden>
								🫳
							</div>
							<p className="mt-2 font-serif text-2xl text-ink-soft italic">drop it on the board</p>
						</div>
					</div>
				</div>
			) : null}

			{working ? (
				<div className="pointer-events-none absolute inset-x-0 top-4 z-20 flex justify-center px-4">
					<span
						data-testid="drop-progress"
						className="animate-shimmer rounded-full bg-card px-3 py-1.5 font-serif text-lg text-ink-soft italic shadow-card"
					>
						tucking it in{queue.length > 0 ? ` — ${queue.length + 1} to go` : '…'}
					</span>
				</div>
			) : error ? (
				<div className="absolute inset-x-0 top-4 z-20 flex justify-center px-4">
					<span className="rounded-full bg-accent-soft px-3 py-1.5 text-sm text-accent-deep shadow-card">
						{error}
					</span>
				</div>
			) : null}
		</>
	);
}
