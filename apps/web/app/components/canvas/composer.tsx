import { useReactFlow } from '@xyflow/react';
import { useEffect, useRef, useState } from 'react';
import { useFetcher } from 'react-router';
import {
	ImageIcon,
	MicIcon,
	PencilIcon,
	PlusIcon,
	SmileIcon,
	SpinnerIcon,
	XIcon,
} from '~/components/icons';
import { Button } from '~/components/ui/button';
import { cn } from '~/lib/cn';
import { ITEM_SIZES, STICKER_EMOJIS } from '~/lib/design';
import { looksLikeUrl, normalizeUrl } from '~/lib/links';
import type { Mentionable } from '~/lib/mentions';
import { MentionMenu } from './mention';

/** Pencil colors — one gesture of color, from the psst palette. */
export const PENCIL_COLORS = ['#e2725b', '#4a7dbd', '#4e9a58', '#e0b64a', '#8b6cc1', '#6a5f4e'];

type Point = { x: number; y: number };
export type Stroke = Point[];

/**
 * One input, four kinds of keepsakes: a URL becomes a postcard, words become
 * a paper slip, the tray drops emoji stickers, the pencil draws freely. New
 * items always land inside the current viewport.
 */
export function Composer({ members = [] }: { members?: Mentionable[] } = {}) {
	const { screenToFlowPosition } = useReactFlow();
	const [draft, setDraft] = useState('');
	const fetcher = useFetcher<{ error?: string }>();
	const stickerFetcher = useFetcher();
	const photoFetcher = useFetcher<{ error?: string }>();
	const drawFetcher = useFetcher();
	const inputRef = useRef<HTMLInputElement>(null);
	const fileRef = useRef<HTMLInputElement>(null);
	const [trayOpen, setTrayOpen] = useState(false);
	const [plusOpen, setPlusOpen] = useState(false);
	const [drawing, setDrawing] = useState(false);
	const [color, setColor] = useState(PENCIL_COLORS[0]);
	const [strokes, setStrokes] = useState<Stroke[]>([]);
	const settleTimer = useRef<number | null>(null);
	const audioFetcher = useFetcher<{ error?: string }>();
	const [recording, setRecording] = useState(false);
	const [elapsed, setElapsed] = useState(0);
	const [micError, setMicError] = useState<string | null>(null);
	const recRef = useRef<{
		recorder: MediaRecorder;
		stream: MediaStream;
		timer: number;
		cancelled: boolean;
	} | null>(null);

	// Voice notes stay short: a minute, then the recorder puts itself down.
	useEffect(() => {
		if (recording && elapsed >= 60) recRef.current?.recorder.stop();
	}, [recording, elapsed]);

	const submitting = fetcher.state !== 'idle';
	const uploading = photoFetcher.state !== 'idle';

	useEffect(() => {
		if (fetcher.state === 'idle' && fetcher.data && !fetcher.data.error && inputRef.current) {
			inputRef.current.value = '';
			setDraft('');
		}
	}, [fetcher.state, fetcher.data]);

	/** A spot around the middle of the visible board, gently jittered. */
	function inViewPlacement(type: keyof typeof ITEM_SIZES) {
		const jitter = (spread: number) => (Math.random() - 0.5) * spread;
		const point = screenToFlowPosition({
			x: window.innerWidth / 2 + jitter(160),
			y: window.innerHeight * 0.42 + jitter(120),
		});
		const size = ITEM_SIZES[type];
		return { x: String(point.x - size.w / 2), y: String(point.y - size.h / 2) };
	}

	function drop() {
		const raw = inputRef.current?.value.trim();
		if (!raw || submitting) return;
		const isUrl = looksLikeUrl(raw);
		fetcher.submit(
			{
				intent: 'create-item',
				kind: isUrl ? 'link' : 'note',
				content: isUrl ? normalizeUrl(raw) : raw,
				...inViewPlacement(isUrl ? 'link' : 'note'),
			},
			{ method: 'post' },
		);
	}

	/** Commit the strokes drawn so far as one drawing item. */
	function commitStrokes(current: Stroke[]) {
		if (settleTimer.current) {
			window.clearTimeout(settleTimer.current);
			settleTimer.current = null;
		}
		if (current.length > 0) {
			// Screen → flow coordinates, then normalize onto the drawing's own origin.
			const flowStrokes = current.map((stroke) => stroke.map((p) => screenToFlowPosition(p)));
			const points = flowStrokes.flat();
			const pad = 8;
			const minX = Math.min(...points.map((p) => p.x)) - pad;
			const minY = Math.min(...points.map((p) => p.y)) - pad;
			const maxX = Math.max(...points.map((p) => p.x)) + pad;
			const maxY = Math.max(...points.map((p) => p.y)) + pad;
			const r = (n: number) => Math.round(n * 10) / 10;
			const d = flowStrokes
				.map((stroke) => `M ${stroke.map((p) => `${r(p.x - minX)} ${r(p.y - minY)}`).join(' L ')}`)
				.join(' ');
			drawFetcher.submit(
				{
					intent: 'create-item',
					kind: 'drawing',
					content: JSON.stringify({
						color,
						d,
						w: Math.max(8, Math.round(maxX - minX)),
						h: Math.max(8, Math.round(maxY - minY)),
					}),
					x: String(minX),
					y: String(minY),
				},
				{ method: 'post' },
			);
		}
		setStrokes([]);
	}

	/** A stroke landed: restart the settle timer — a pause commits the drawing. */
	function addStroke(stroke: Stroke) {
		setStrokes((prev) => {
			const next = [...prev, stroke];
			if (settleTimer.current) window.clearTimeout(settleTimer.current);
			settleTimer.current = window.setTimeout(() => commitStrokes(next), 1400);
			return next;
		});
	}

	function exitDrawing() {
		commitStrokes(strokes);
		setDrawing(false);
	}

	// Escape leaves draw mode (committing whatever settled).
	useEffect(() => {
		if (!drawing) return;
		function onKey(event: KeyboardEvent) {
			if (event.key === 'Escape') exitDrawing();
		}
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	});

	/** Peak samples for the static waveform, computed once at save time. */
	async function waveformMeta(blob: Blob, fallbackSeconds: number) {
		try {
			const ctx = new AudioContext();
			const buffer = await ctx.decodeAudioData(await blob.arrayBuffer());
			void ctx.close();
			const channel = buffer.getChannelData(0);
			const BARS = 40;
			const block = Math.max(1, Math.floor(channel.length / BARS));
			const peaks = Array.from({ length: BARS }, (_, i) => {
				let max = 0;
				for (let j = i * block; j < Math.min((i + 1) * block, channel.length); j++) {
					const value = Math.abs(channel[j]);
					if (value > max) max = value;
				}
				return max;
			});
			const top = Math.max(...peaks, 0.01);
			return {
				duration: Math.round(buffer.duration * 10) / 10,
				peaks: peaks.map((p) => Math.round((p / top) * 100) / 100),
			};
		} catch {
			return { duration: Math.max(1, fallbackSeconds), peaks: [] };
		}
	}

	async function startRecording() {
		setMicError(null);
		if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
			setMicError('Voice notes need a secure connection — open psst over https.');
			return;
		}
		try {
			const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
			const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
				? 'audio/webm;codecs=opus'
				: MediaRecorder.isTypeSupported('audio/mp4')
					? 'audio/mp4'
					: undefined;
			const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
			const chunks: Blob[] = [];
			recorder.ondataavailable = (event) => {
				if (event.data.size > 0) chunks.push(event.data);
			};
			recorder.onstop = () => {
				for (const track of stream.getTracks()) track.stop();
				const state = recRef.current;
				if (state) window.clearInterval(state.timer);
				const cancelled = state?.cancelled ?? false;
				recRef.current = null;
				setRecording(false);
				const seconds = elapsedRef.current;
				setElapsed(0);
				if (cancelled || chunks.length === 0) return;
				void (async () => {
					const type = (recorder.mimeType || 'audio/webm').split(';')[0];
					const blob = new Blob(chunks, { type });
					const meta = await waveformMeta(blob, seconds);
					const formData = new FormData();
					formData.set('intent', 'create-audio');
					formData.set('file', new File([blob], 'voice', { type }));
					formData.set('content', JSON.stringify(meta));
					const at = inViewPlacement('audio');
					formData.set('x', at.x);
					formData.set('y', at.y);
					audioFetcher.submit(formData, { method: 'post', encType: 'multipart/form-data' });
				})();
			};
			recRef.current = {
				recorder,
				stream,
				cancelled: false,
				timer: window.setInterval(() => setElapsed((s) => s + 1), 1000),
			};
			recorder.start();
			setElapsed(0);
			setRecording(true);
		} catch {
			setMicError('The microphone stayed quiet — check permissions?');
		}
	}

	const elapsedRef = useRef(0);
	elapsedRef.current = elapsed;

	const iconButton =
		'grid h-9 w-9 shrink-0 place-items-center rounded-full text-ink-soft transition hover:bg-paper-deep hover:text-ink disabled:opacity-50';

	return (
		<>
			{drawing ? <DrawLayer color={color} strokes={strokes} onStroke={addStroke} /> : null}

			<div
				className="pointer-events-none absolute inset-x-0 z-30 flex justify-center px-8 sm:px-6"
				style={{ bottom: 'max(0.875rem, calc(env(safe-area-inset-bottom) + 0.5rem))' }}
			>
				<div className="pointer-events-auto w-full max-w-2xl">
					{fetcher.data?.error ||
					photoFetcher.data?.error ||
					audioFetcher.data?.error ||
					micError ? (
						<p className="mb-2.5 rounded-lg bg-accent-soft px-3 py-1.5 text-center text-accent-deep text-sm shadow-card">
							{fetcher.data?.error ??
								photoFetcher.data?.error ??
								audioFetcher.data?.error ??
								micError}
						</p>
					) : null}

					{plusOpen && !drawing && !recording ? (
						<div className="mb-2.5 flex items-center gap-1 rounded-full border border-line bg-card p-1.5 shadow-lift sm:hidden">
							<button
								type="button"
								aria-label="Sticker tray"
								onClick={() => {
									setPlusOpen(false);
									setTrayOpen(true);
								}}
								className={iconButton}
							>
								<SmileIcon className="h-[18px] w-[18px]" />
							</button>
							<button
								type="button"
								aria-label="Add a photo"
								disabled={uploading}
								onClick={() => {
									setPlusOpen(false);
									fileRef.current?.click();
								}}
								className={iconButton}
							>
								<ImageIcon className="h-[18px] w-[18px]" />
							</button>
							<button
								type="button"
								aria-label="Draw on the board"
								onClick={() => {
									setPlusOpen(false);
									setDrawing(true);
								}}
								className={iconButton}
							>
								<PencilIcon className="h-[18px] w-[18px]" />
							</button>
							<button
								type="button"
								aria-label="Record a voice note"
								onClick={() => {
									setPlusOpen(false);
									void startRecording();
								}}
								className={iconButton}
							>
								<MicIcon className="h-[18px] w-[18px]" />
							</button>
						</div>
					) : null}

					{trayOpen && !drawing ? (
						<div className="mb-2.5 rounded-xl border border-line bg-card p-2.5 shadow-lift">
							<div className="grid grid-cols-8 gap-1">
								{STICKER_EMOJIS.map((emoji) => (
									<button
										key={emoji}
										type="button"
										aria-label={`Drop ${emoji} sticker`}
										onClick={() => {
											stickerFetcher.submit(
												{
													intent: 'create-item',
													kind: 'emoji',
													content: emoji,
													...inViewPlacement('emoji'),
												},
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

					{recording ? (
						<div className="flex items-center gap-3 rounded-full border border-line bg-card px-4 py-2 shadow-lift">
							<span className="h-2.5 w-2.5 animate-pulse rounded-full bg-accent" aria-hidden />
							<span className="font-mono text-ink text-sm tracking-wider">
								0:{String(elapsed).padStart(2, '0')}
							</span>
							<span className="flex-1 text-center font-serif text-ink-soft text-sm italic">
								recording — up to a minute…
							</span>
							<button
								type="button"
								aria-label="Discard recording"
								onClick={() => {
									if (recRef.current) {
										recRef.current.cancelled = true;
										recRef.current.recorder.stop();
									}
								}}
								className={iconButton}
							>
								<XIcon className="h-[18px] w-[18px]" />
							</button>
							<Button
								size="sm"
								className="rounded-full"
								onClick={() => recRef.current?.recorder.stop()}
							>
								Send
							</Button>
						</div>
					) : drawing ? (
						<div className="flex items-center gap-2 rounded-full border border-line bg-card px-3 py-2 shadow-lift">
							<span className="flex items-center gap-1.5">
								{PENCIL_COLORS.map((option) => (
									<button
										key={option}
										type="button"
										aria-label={`Pencil color ${option}`}
										aria-pressed={color === option}
										onClick={() => setColor(option)}
										style={{ backgroundColor: option }}
										className={cn(
											'h-6 w-6 rounded-full transition hover:scale-110',
											color === option && 'ring-2 ring-ink/40 ring-offset-2 ring-offset-card',
										)}
									/>
								))}
							</span>
							<span className="flex-1 text-center font-serif text-ink-soft text-sm italic">
								draw — pause and it settles onto the board
							</span>
							<button
								type="button"
								aria-label="Put the pencil down"
								onClick={exitDrawing}
								className={iconButton}
							>
								<XIcon className="h-[18px] w-[18px]" />
							</button>
						</div>
					) : (
						<form
							onSubmit={(event) => {
								event.preventDefault();
								drop();
							}}
							className="relative flex items-center gap-1.5 rounded-full border border-line bg-card py-1.5 pr-1.5 pl-2 shadow-lift"
						>
							<MentionMenu
								value={draft}
								members={members}
								onPick={(next) => {
									setDraft(next);
									if (inputRef.current) {
										inputRef.current.value = next;
										inputRef.current.focus();
									}
								}}
							/>
							<button
								type="button"
								aria-label="Add to the board"
								aria-expanded={plusOpen}
								onClick={() => setPlusOpen((open) => !open)}
								className={cn(iconButton, 'sm:hidden')}
							>
								<PlusIcon className={cn('h-5 w-5 transition-transform', plusOpen && 'rotate-45')} />
							</button>
							<button
								type="button"
								aria-label="Sticker tray"
								aria-expanded={trayOpen}
								onClick={() => setTrayOpen((open) => !open)}
								className={cn(iconButton, 'hidden sm:grid')}
							>
								<SmileIcon className="h-[18px] w-[18px]" />
							</button>
							<button
								type="button"
								aria-label="Add a photo"
								disabled={uploading}
								onClick={() => fileRef.current?.click()}
								className={cn(iconButton, 'hidden sm:grid')}
							>
								{uploading ? (
									<SpinnerIcon className="h-[18px] w-[18px] animate-spin" />
								) : (
									<ImageIcon className="h-[18px] w-[18px]" />
								)}
							</button>
							<button
								type="button"
								aria-label="Draw on the board"
								onClick={() => {
									setTrayOpen(false);
									setDrawing(true);
								}}
								className={cn(iconButton, 'hidden sm:grid')}
							>
								<PencilIcon className="h-[18px] w-[18px]" />
							</button>
							<button
								type="button"
								aria-label="Record a voice note"
								onClick={() => {
									setTrayOpen(false);
									void startRecording();
								}}
								className={cn(iconButton, 'hidden sm:grid')}
							>
								{audioFetcher.state !== 'idle' ? (
									<SpinnerIcon className="h-[18px] w-[18px] animate-spin" />
								) : (
									<MicIcon className="h-[18px] w-[18px]" />
								)}
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
									const at = inViewPlacement('image');
									formData.set('x', at.x);
									formData.set('y', at.y);
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
								onChange={(event) => setDraft(event.currentTarget.value)}
								className="h-9 min-w-0 flex-1 bg-transparent px-1.5 text-base outline-none placeholder:text-ink-faint"
							/>
							<Button type="submit" disabled={submitting} className="rounded-full">
								{submitting ? '…' : 'Drop'}
							</Button>
						</form>
					)}
				</div>
			</div>
		</>
	);
}

/**
 * Full-board drawing surface: pointer strokes in screen coordinates,
 * converted to flow coordinates on submit (the overlay blocks pan/zoom, so
 * the viewport can't shift mid-drawing).
 */
export function DrawLayer({
	color,
	strokes,
	onStroke,
}: {
	color: string;
	strokes: Stroke[];
	onStroke: (stroke: Stroke) => void;
}) {
	const [live, setLive] = useState<Stroke | null>(null);
	const rootRef = useRef<HTMLDivElement>(null);

	function toLocal(event: React.PointerEvent): Point {
		return { x: event.clientX, y: event.clientY };
	}

	const path = (stroke: Stroke) => `M ${stroke.map((p) => `${p.x} ${p.y}`).join(' L ')}`;

	return (
		<div
			ref={rootRef}
			className="absolute inset-0 z-20 cursor-crosshair touch-none"
			onPointerDown={(event) => {
				event.currentTarget.setPointerCapture(event.pointerId);
				setLive([toLocal(event)]);
			}}
			onPointerMove={(event) => {
				if (!live) return;
				setLive((prev) => (prev ? [...prev, toLocal(event)] : prev));
			}}
			onPointerUp={() => {
				if (live && live.length > 1) onStroke(live);
				setLive(null);
			}}
		>
			<svg className="pointer-events-none fixed inset-0 h-full w-full" aria-hidden>
				{[...strokes, ...(live ? [live] : [])].map((stroke, index) => (
					// biome-ignore lint/suspicious/noArrayIndexKey: strokes are append-only
					<path
						key={index}
						d={path(stroke)}
						stroke={color}
						strokeWidth={4}
						strokeLinecap="round"
						strokeLinejoin="round"
						fill="none"
					/>
				))}
			</svg>
		</div>
	);
}
