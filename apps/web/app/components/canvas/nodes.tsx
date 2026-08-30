import type { NodeProps } from '@xyflow/react';
import { useRef, useState } from 'react';
import { useFetcher } from 'react-router';
import { ArrowUpRightIcon, ChatIcon, PauseIcon, PlayIcon, XIcon } from '~/components/icons';
import { Avatar } from '~/components/ui/avatar';
import { ConfirmDialog } from '~/components/ui/confirm-dialog';
import { cn } from '~/lib/cn';
import { ITEM_SIZES } from '~/lib/design';
import type { Mentionable } from '~/lib/mentions';
import type { BoardItem } from '~/lib/services/canvases.server';
import { BlurhashCanvas } from './blurhash-canvas';
import { CardBack } from './card-back';
import { FlipCard } from './flip-card';
import { MentionText } from './mention';

export type BoardNodeData = {
	item: BoardItem;
	currentUserId: string;
	frozen: boolean;
	/** Space members, for rendering and completing @mentions. */
	members?: Mentionable[];
	onResize?: (itemId: string, scale: number) => void;
	onLike?: (itemId: string) => void;
};

type BoardNodeProps = NodeProps & { data: BoardNodeData };

function useFlip() {
	return useState(false);
}

function hostnameOf(url: string | null): string {
	if (!url) return '';
	try {
		return new URL(url).hostname.replace(/^www\./, '');
	} catch {
		return '';
	}
}

/** Link → postcard. Pending shimmer until the unfurl lands. */
export function PostcardNode({ data }: BoardNodeProps) {
	const { item, currentUserId, frozen } = data;
	const [flipped, setFlipped] = useFlip();
	const size = ITEM_SIZES.link;
	const unfurl = item.unfurl;
	const host = hostnameOf(item.url);

	const front =
		!unfurl || unfurl.status === 'pending' ? (
			<div className="flex h-full w-full flex-col rounded-lg border border-line bg-card p-3 shadow-card">
				<div className="animate-shimmer flex-1 rounded-md bg-paper-deep" />
				<div className="mt-2 space-y-1.5">
					<div className="animate-shimmer h-3 w-3/4 rounded bg-paper-deep" />
					<div className="text-xs text-ink-faint">{host}</div>
				</div>
				<PostageStamp />
				<OpenLink url={item.url} />
			</div>
		) : unfurl.status === 'ok' ? (
			<div className="relative flex h-full w-full flex-col overflow-hidden rounded-lg border border-line bg-card shadow-card">
				{unfurl.imageUrl ? (
					<div className="min-h-0 flex-1 bg-paper-deep">
						<img
							src={unfurl.imageUrl}
							alt=""
							draggable={false}
							className="h-full w-full object-cover"
						/>
					</div>
				) : (
					<div className="flex min-h-0 flex-1 items-center justify-center bg-sky text-4xl">🔗</div>
				)}
				<div className="space-y-1 p-3">
					<div className="line-clamp-2 text-sm font-medium leading-snug">
						{unfurl.title ?? host}
					</div>
					<div className="flex items-center gap-1.5 text-xs text-ink-faint">
						{unfurl.faviconUrl ? (
							<img src={unfurl.faviconUrl} alt="" className="h-3.5 w-3.5 rounded-sm" />
						) : null}
						<span className="truncate">{unfurl.siteName ?? host}</span>
					</div>
				</div>
				<PostageStamp />
				<OpenLink url={item.url} />
			</div>
		) : (
			<div className="relative flex h-full w-full flex-col items-center justify-center gap-2 rounded-lg border border-line bg-sky p-3 shadow-card">
				<div className="text-4xl">🔗</div>
				<div className="max-w-full truncate text-sm font-medium">{host}</div>
				<PostageStamp />
				<OpenLink url={item.url} />
			</div>
		);

	return (
		<FlipCard
			width={size.w}
			height={size.h}
			rotation={item.rotation}
			flipped={flipped}
			badges={<CardBadges item={item} onFlip={() => setFlipped((f) => !f)} />}
			scale={item.scale}
			onResize={data.onResize ? (scale) => data.onResize?.(item.id, scale) : undefined}
			onLike={data.onLike ? () => data.onLike?.(item.id) : undefined}
			onToggle={() => setFlipped((f) => !f)}
			front={front}
			back={
				<CardBack
					item={item}
					currentUserId={currentUserId}
					frozen={frozen}
					members={data.members ?? []}
				/>
			}
		/>
	);
}

/** A torn-paper outline: straight-ish edges with a seeded deckle. */
export function tornEdge(seed: string, width: number, height: number): string {
	let hash = 0;
	for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) % 100000;
	const rand = () => {
		hash = (hash * 9301 + 49297) % 233280;
		return hash / 233280;
	};
	const jitter = () => rand() * 5 - 2.5;
	const STEP = 16;
	const points: Array<[number, number]> = [];
	for (let x = STEP; x < width; x += STEP) points.push([x + jitter(), Math.abs(jitter())]);
	points.push([width - Math.abs(jitter()), Math.abs(jitter())]);
	for (let y = STEP; y < height; y += STEP) points.push([width - Math.abs(jitter()), y + jitter()]);
	points.push([width - Math.abs(jitter()), height - Math.abs(jitter())]);
	for (let x = width - STEP; x > 0; x -= STEP)
		points.push([x + jitter(), height - Math.abs(jitter())]);
	points.push([Math.abs(jitter()), height - Math.abs(jitter())]);
	for (let y = height - STEP; y > 0; y -= STEP) points.push([Math.abs(jitter()), y + jitter()]);
	return `M ${Math.abs(jitter()).toFixed(1)} ${Math.abs(jitter()).toFixed(1)} L ${points
		.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`)
		.join(' L ')} Z`;
}

/** Scraps tear to size: a few words get a slim strip, a paragraph a page. */
function slipSize(text: string | null) {
	const length = text?.length ?? 0;
	const w = ITEM_SIZES.note.w;
	if (length <= 60) return { w, h: 120 };
	if (length <= 160) return { w, h: 164 };
	return { w, h: ITEM_SIZES.note.h };
}

/** Note → a torn paper scrap taped to the board, spoken in typewriter. */
export function SlipNode({ data }: BoardNodeProps) {
	const { item, currentUserId, frozen } = data;
	const [flipped, setFlipped] = useFlip();
	const size = slipSize(item.text);

	return (
		<FlipCard
			width={size.w}
			height={size.h}
			rotation={item.rotation}
			flipped={flipped}
			badges={<CardBadges item={item} onFlip={() => setFlipped((f) => !f)} />}
			scale={item.scale}
			onResize={data.onResize ? (scale) => data.onResize?.(item.id, scale) : undefined}
			onLike={data.onLike ? () => data.onLike?.(item.id) : undefined}
			onToggle={() => setFlipped((f) => !f)}
			front={
				<div className="relative h-full w-full">
					<svg
						viewBox={`0 0 ${size.w} ${size.h}`}
						preserveAspectRatio="none"
						className="absolute inset-0 h-full w-full [filter:drop-shadow(0_3px_7px_rgb(64_56_47/0.16))]"
						aria-hidden
					>
						<path d={tornEdge(item.id, size.w, size.h)} fill="var(--color-card)" />
					</svg>
					{/* washi tape */}
					<span
						aria-hidden
						className="-top-2.5 -translate-x-1/2 absolute left-1/2 h-6 w-24 rotate-[-2deg] bg-butter/70 shadow-sm"
					/>
					<div
						className={cn(
							'absolute inset-0 flex',
							(item.text?.length ?? 0) <= 60 ? 'items-center p-6' : 'items-start px-5 pt-6 pb-4',
						)}
					>
						<p
							className={cn(
								'max-h-full text-ink [overflow-wrap:anywhere]',
								(item.text?.length ?? 0) <= 60
									? 'line-clamp-4 text-[16px] leading-relaxed'
									: (item.text?.length ?? 0) <= 160
										? 'line-clamp-6 text-[13.5px] leading-normal'
										: 'line-clamp-7 text-[12px] leading-snug',
							)}
							style={{
								fontFamily: "'American Typewriter', 'Courier Prime', 'Courier New', monospace",
							}}
						>
							<MentionText text={item.text ?? ''} members={data.members ?? []} />
						</p>
					</div>
				</div>
			}
			back={
				<CardBack
					item={item}
					currentUserId={currentUserId}
					frozen={frozen}
					members={data.members ?? []}
				/>
			}
		/>
	);
}

/**
 * A hand-cut sticker backing: a circle with a gently irregular edge, seeded
 * per item so no two cuts are identical.
 */
function stickerCut(seed: string): string {
	let hash = 0;
	for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) % 100000;
	const rand = () => {
		hash = (hash * 9301 + 49297) % 233280;
		return hash / 233280;
	};
	const POINTS = 22;
	const pts: Array<[number, number]> = [];
	for (let i = 0; i < POINTS; i++) {
		const angle = (i / POINTS) * Math.PI * 2;
		const radius = 45 + rand() * 3.6 - 1.8;
		pts.push([50 + Math.cos(angle) * radius, 50 + Math.sin(angle) * radius]);
	}
	const mid = (a: [number, number], b: [number, number]) => [
		((a[0] + b[0]) / 2).toFixed(1),
		((a[1] + b[1]) / 2).toFixed(1),
	];
	let d = `M ${mid(pts[POINTS - 1], pts[0]).join(' ')}`;
	for (let i = 0; i < POINTS; i++) {
		const p = pts[i];
		const m = mid(p, pts[(i + 1) % POINTS]);
		d += ` Q ${p[0].toFixed(1)} ${p[1].toFixed(1)} ${m.join(' ')}`;
	}
	return `${d} Z`;
}

/** Emoji → die-cut sticker: the glyph on a white hand-cut pad. Silent. */
export function StickerNode({ data }: BoardNodeProps) {
	const { item, currentUserId, frozen } = data;
	const size = ITEM_SIZES.emoji;
	const [confirming, setConfirming] = useState(false);
	const canDelete = !frozen && item.authorId === currentUserId;
	const longPress = useLongPress(() => canDelete && setConfirming(true));

	return (
		<FlipCard
			width={size.w}
			height={size.h}
			rotation={item.rotation}
			flipped={false}
			flippable={false}
			scale={item.scale}
			onResize={data.onResize ? (scale) => data.onResize?.(item.id, scale) : undefined}
			onToggle={() => {}}
			front={
				<div
					className="group/sticker relative h-full w-full select-none [-webkit-touch-callout:none]"
					{...longPress}
				>
					<svg
						viewBox="0 0 100 100"
						className="absolute inset-0 h-full w-full [filter:drop-shadow(0_4px_8px_rgb(64_56_47/0.2))]"
						aria-hidden
					>
						<path d={stickerCut(item.id)} fill="var(--color-card)" />
					</svg>
					<span className="absolute inset-0 grid place-items-center text-[62px] leading-none">
						{item.text}
					</span>
					<HoverDelete
						item={item}
						currentUserId={currentUserId}
						frozen={frozen}
						open={confirming}
						onOpenChange={setConfirming}
					/>
				</div>
			}
		/>
	);
}

type AudioMeta = { duration: number; peaks: number[] };

function parseAudioMeta(raw: string | null): AudioMeta {
	try {
		const parsed = JSON.parse(raw ?? '');
		if (parsed.duration > 0) {
			return {
				duration: parsed.duration,
				peaks: Array.isArray(parsed.peaks) && parsed.peaks.length > 0 ? parsed.peaks : [],
			};
		}
	} catch {
		// fall through
	}
	return { duration: 0, peaks: [] };
}

function clock(seconds: number): string {
	const s = Math.max(0, Math.round(seconds));
	return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

const FLAT_PEAKS = Array.from({ length: 40 }, () => 0.35);

/** The waveform at rest is all ink; playback leaves the road ahead faint. */
function Waveform({ peaks, progress }: { peaks: number[]; progress: number }) {
	const bars = peaks.length > 0 ? peaks : FLAT_PEAKS;
	const played = Math.floor(progress * bars.length);
	return (
		<svg
			className="h-8 min-w-0 flex-1"
			viewBox={`0 0 ${bars.length * 3} 32`}
			preserveAspectRatio="none"
			aria-hidden
		>
			{bars.map((peak, index) => {
				const height = Math.max(2.5, peak * 26);
				const ahead = progress > 0 && index >= played;
				return (
					<rect
						key={`${index}-${peak}`}
						x={index * 3}
						y={16 - height / 2}
						width={1.5}
						height={height}
						rx={0.75}
						fill={ahead ? 'var(--color-ink-faint)' : 'var(--color-ink)'}
					/>
				);
			})}
		</svg>
	);
}

/** Voice note → a slip of paper that speaks: play, waveform, duration. */
export function AudioNode({ data }: BoardNodeProps) {
	const { item, currentUserId, frozen } = data;
	const [flipped, setFlipped] = useFlip();
	const [playing, setPlaying] = useState(false);
	const [progress, setProgress] = useState(0);
	const audioRef = useRef<HTMLAudioElement>(null);
	const meta = parseAudioMeta(item.text);
	const src = item.assets.find((asset) => asset.kind === 'original')?.url ?? null;
	const size = ITEM_SIZES.audio;

	return (
		<FlipCard
			width={size.w}
			height={size.h}
			rotation={item.rotation}
			flipped={flipped}
			badges={<CardBadges item={item} onFlip={() => setFlipped((f) => !f)} />}
			scale={item.scale}
			onResize={data.onResize ? (scale) => data.onResize?.(item.id, scale) : undefined}
			onLike={data.onLike ? () => data.onLike?.(item.id) : undefined}
			onToggle={() => setFlipped((f) => !f)}
			front={
				<div className="flex h-full w-full items-center gap-3.5 rounded-[22px] bg-card px-4 shadow-card">
					{src ? (
						// biome-ignore lint/a11y/useMediaCaption: short voice notes; transcript is a seed
						<audio
							ref={audioRef}
							src={src}
							preload="metadata"
							onPlay={() => setPlaying(true)}
							onPause={() => setPlaying(false)}
							onEnded={() => {
								setPlaying(false);
								setProgress(0);
							}}
							onTimeUpdate={(event) => {
								const el = event.currentTarget;
								setProgress(el.duration > 0 ? el.currentTime / el.duration : 0);
							}}
						/>
					) : null}
					<button
						type="button"
						data-noflip
						aria-label={playing ? 'Pause voice note' : 'Play voice note'}
						onClick={() => {
							const el = audioRef.current;
							if (!el) return;
							if (el.paused) void el.play();
							else el.pause();
						}}
						className="nodrag grid h-12 w-12 shrink-0 place-items-center rounded-full bg-ink/10 text-ink transition hover:bg-ink/15"
					>
						{playing ? (
							<PauseIcon className="h-5 w-5 fill-current" />
						) : (
							<PlayIcon className="ml-0.5 h-5 w-5 fill-current" />
						)}
					</button>
					<Waveform peaks={meta.peaks} progress={progress} />
					<span className="shrink-0 text-[13px] text-ink-soft">{clock(meta.duration)}</span>
				</div>
			}
			back={
				<CardBack
					item={item}
					currentUserId={currentUserId}
					frozen={frozen}
					members={data.members ?? []}
				/>
			}
		/>
	);
}

/** Drawing → a free pencil stroke, floating on the paper. Silent like stickers. */
export function DrawingNode({ data }: BoardNodeProps) {
	const { item, currentUserId, frozen } = data;
	const drawing = parseDrawing(item.text);
	const [confirming, setConfirming] = useState(false);
	const canDelete = !frozen && item.authorId === currentUserId;
	const longPress = useLongPress(() => canDelete && setConfirming(true));

	return (
		<FlipCard
			width={drawing.w}
			height={drawing.h}
			rotation={item.rotation}
			flipped={false}
			flippable={false}
			scale={item.scale}
			onResize={data.onResize ? (scale) => data.onResize?.(item.id, scale) : undefined}
			onToggle={() => {}}
			front={
				<div
					className="group/sticker h-full w-full select-none [-webkit-touch-callout:none]"
					{...longPress}
				>
					<svg
						viewBox={`0 0 ${drawing.w} ${drawing.h}`}
						className="h-full w-full overflow-visible"
						aria-hidden
					>
						<path
							d={drawing.d}
							stroke={drawing.color}
							strokeWidth={4}
							strokeLinecap="round"
							strokeLinejoin="round"
							fill="none"
						/>
					</svg>
					<HoverDelete
						item={item}
						currentUserId={currentUserId}
						frozen={frozen}
						open={confirming}
						onOpenChange={setConfirming}
					/>
				</div>
			}
		/>
	);
}

export type DrawingData = { color: string; d: string; w: number; h: number };

function parseDrawing(raw: string | null): DrawingData {
	try {
		const parsed = JSON.parse(raw ?? '');
		if (typeof parsed.d === 'string' && parsed.w > 0 && parsed.h > 0) return parsed;
	} catch {
		// fall through
	}
	return { color: 'var(--color-ink)', d: '', w: 96, h: 96 };
}

/** Long-press (touch/pen, 500ms) — the mobile way to reach delete on silent items. */
function useLongPress(onLongPress: () => void) {
	const timer = useRef<number | null>(null);
	const touches = useRef(0);
	const clear = () => {
		if (timer.current) {
			window.clearTimeout(timer.current);
			timer.current = null;
		}
	};
	const release = () => {
		touches.current = Math.max(0, touches.current - 1);
		clear();
	};
	return {
		onPointerDown: (event: React.PointerEvent) => {
			if (event.pointerType === 'mouse') return;
			touches.current += 1;
			// A second finger means pinch, not press.
			if (touches.current > 1) {
				clear();
				return;
			}
			timer.current = window.setTimeout(onLongPress, 500);
		},
		onPointerUp: release,
		onPointerMove: clear,
		onPointerLeave: release,
		onPointerCancel: release,
	};
}

/** Author-only ×, on hover (desktop) or via long-press (the `open` control). */
function HoverDelete({
	item,
	currentUserId,
	frozen,
	open,
	onOpenChange,
}: {
	item: BoardItem;
	currentUserId: string;
	frozen: boolean;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const deleteFetcher = useFetcher();
	if (frozen || item.authorId !== currentUserId) return null;

	return (
		<>
			<button
				type="button"
				aria-label="Remove from the board"
				onClick={() => onOpenChange(true)}
				className="nodrag -top-1.5 -right-1.5 absolute grid h-6 w-6 place-items-center rounded-full border border-line bg-card text-ink-soft opacity-0 shadow-card transition-opacity hover:text-accent-deep group-hover/sticker:opacity-100"
			>
				<XIcon className="h-3 w-3" />
			</button>
			<ConfirmDialog
				open={open}
				onClose={() => onOpenChange(false)}
				onConfirm={() =>
					deleteFetcher.submit({ intent: 'delete-item', itemId: item.id }, { method: 'post' })
				}
				title="Take this off the board?"
				message="It leaves the canvas for everyone — quietly, no trace."
				confirmLabel="Take it off"
			/>
		</>
	);
}

/**
 * The caption row beneath the card's bottom-left corner — the chat chip (with
 * count once there's a thread) and the reactions so far. Clicking it flips the
 * card: this row IS the flip affordance.
 */
function CardBadges({ item, onFlip }: { item: BoardItem; onFlip: () => void }) {
	const reactionCounts = new Map<string, number>();
	for (const reaction of item.reactions) {
		reactionCounts.set(reaction.emoji, (reactionCounts.get(reaction.emoji) ?? 0) + 1);
	}
	const count = item.comments.length;
	const latest = item.comments.slice(-2);
	const label =
		count > 0
			? `Read the back — ${count} ${count === 1 ? 'note' : 'notes'}`
			: 'Flip to write on the back';

	return (
		<button
			type="button"
			onClick={onFlip}
			aria-label={label}
			title={label}
			data-testid="card-badges"
			className="nodrag absolute top-full left-0 mt-2 flex w-full flex-col items-start gap-1.5 text-left"
		>
			<span className="flex items-center gap-1.5">
				<span
					className={cn(
						'flex items-center gap-1.5 rounded-lg bg-card/90 px-2 py-1.5 font-semibold text-ink-soft text-xs shadow-card backdrop-blur transition hover:scale-105 hover:text-ink',
						count === 0 && 'opacity-70 hover:opacity-100',
					)}
				>
					<ChatIcon className="h-3.5 w-3.5" />
					{count > 0 ? count : null}
				</span>
				{[...reactionCounts].map(([emoji, total]) => (
					<span
						key={emoji}
						className="flex items-center gap-1 rounded-lg bg-card/90 px-2 py-1.5 text-xs shadow-card backdrop-blur"
					>
						{emoji}
						{total > 1 ? <span className="font-semibold text-ink-soft">{total}</span> : null}
					</span>
				))}
			</span>
			{/* The tail of the thread, peeking out without a flip */}
			{latest.map((comment) => (
				<span key={comment.id} className="flex max-w-full items-center gap-1.5">
					<Avatar
						name={comment.authorName}
						image={comment.authorImage}
						size="sm"
						className="!h-4 !w-4 shrink-0 !text-[8px]"
					/>
					<span className="truncate font-serif text-[13px] text-ink-soft leading-tight">
						{comment.text}
					</span>
				</span>
			))}
		</button>
	);
}

/** A real postage stamp: scalloped perforations, inked in the accent. */
function PostageStamp() {
	const size = 28;
	const step = 7;
	const holes: Array<[number, number]> = [];
	for (let at = 0; at <= size; at += step) {
		holes.push([at, 0], [at, size], [0, at], [size, at]);
	}
	return (
		<div className="absolute top-1.5 right-1.5 rotate-6" aria-hidden>
			<svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
				<mask id="stamp-perforations">
					<rect width={size} height={size} fill="white" />
					{holes.map(([x, y]) => (
						<circle key={`${x}-${y}`} cx={x} cy={y} r={2.2} fill="black" />
					))}
				</mask>
				<rect
					width={size}
					height={size}
					fill="var(--color-accent)"
					opacity={0.9}
					mask="url(#stamp-perforations)"
				/>
			</svg>
			<span className="absolute inset-0 grid place-items-center text-[10px] text-white">✷</span>
		</div>
	);
}

function OpenLink({ url }: { url: string | null }) {
	if (!url) return null;
	return (
		<a
			href={url}
			target="_blank"
			rel="noreferrer noopener"
			data-noflip
			className="nodrag absolute right-2 bottom-2 flex items-center gap-1.5 rounded-md bg-card/90 px-2.5 py-1.5 font-semibold text-[11px] text-ink-soft uppercase tracking-wider shadow-card backdrop-blur transition hover:bg-accent hover:text-white"
		>
			Visit
			<ArrowUpRightIcon className="h-3 w-3" />
		</a>
	);
}

// The polaroid frame around the photo, in px (p-2.5 sides/top, pb-8 chin).
const PRINT_FRAME_X = 20;
const PRINT_FRAME_TOP = 10;
const PRINT_FRAME_BOTTOM = 32;
const PRINT_PHOTO_MAX = 240;

/**
 * Size the print to the photo's aspect ratio (fit inside a square), so
 * nothing gets clipped. Extreme panoramas/slivers are gently clamped.
 */
function printSize(photo?: { width: number | null; height: number | null }) {
	const ratio = photo?.width && photo?.height ? photo.width / photo.height : 1;
	const clamped = Math.min(1.8, Math.max(0.6, ratio));
	const photoW = clamped >= 1 ? PRINT_PHOTO_MAX : PRINT_PHOTO_MAX * clamped;
	const photoH = clamped >= 1 ? PRINT_PHOTO_MAX / clamped : PRINT_PHOTO_MAX;
	return {
		w: Math.round(photoW + PRINT_FRAME_X),
		h: Math.round(photoH + PRINT_FRAME_TOP + PRINT_FRAME_BOTTOM),
	};
}

/** Image → photo print with blurhash bloom. */
export function PrintNode({ data }: BoardNodeProps) {
	const { item, currentUserId, frozen } = data;
	const [flipped, setFlipped] = useFlip();
	const [loaded, setLoaded] = useState(false);

	const photo =
		item.assets.find((asset) => asset.kind === 'thumb') ??
		item.assets.find((asset) => asset.kind === 'original');
	const blurhash = photo?.blurhash ?? null;
	const size = printSize(photo);

	return (
		<FlipCard
			width={size.w}
			height={size.h}
			rotation={item.rotation}
			flipped={flipped}
			badges={<CardBadges item={item} onFlip={() => setFlipped((f) => !f)} />}
			scale={item.scale}
			onResize={data.onResize ? (scale) => data.onResize?.(item.id, scale) : undefined}
			onLike={data.onLike ? () => data.onLike?.(item.id) : undefined}
			onToggle={() => setFlipped((f) => !f)}
			front={
				<div className="flex h-full w-full flex-col rounded-lg border border-line bg-card p-2.5 pb-8 shadow-card">
					<div className="relative min-h-0 flex-1 overflow-hidden rounded-sm bg-paper-deep">
						{blurhash ? (
							<BlurhashCanvas
								hash={blurhash}
								className={cn(
									'absolute inset-0 h-full w-full transition-opacity duration-700',
									loaded ? 'opacity-0' : 'opacity-100',
								)}
							/>
						) : null}
						{photo ? (
							<img
								src={photo.url}
								alt=""
								draggable={false}
								onLoad={() => setLoaded(true)}
								className={cn(
									'h-full w-full object-cover transition-opacity duration-700',
									loaded ? 'opacity-100' : 'opacity-0',
								)}
							/>
						) : (
							<div className="grid h-full w-full place-items-center text-3xl">🖼️</div>
						)}
					</div>
				</div>
			}
			back={
				<CardBack
					item={item}
					currentUserId={currentUserId}
					frozen={frozen}
					members={data.members ?? []}
				/>
			}
		/>
	);
}
