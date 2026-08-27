import type { NodeProps } from '@xyflow/react';
import { useState } from 'react';
import { useFetcher } from 'react-router';
import { ArrowUpRightIcon, ChatIcon, XIcon } from '~/components/icons';
import { ConfirmDialog } from '~/components/ui/confirm-dialog';
import { cn } from '~/lib/cn';
import { ITEM_SIZES, seededTone } from '~/lib/design';
import type { BoardItem } from '~/lib/services/canvases.server';
import { BlurhashCanvas } from './blurhash-canvas';
import { CardBack } from './card-back';
import { FlipCard } from './flip-card';

export type BoardNodeData = {
	item: BoardItem;
	currentUserId: string;
	frozen: boolean;
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
			back={<CardBack item={item} currentUserId={currentUserId} frozen={frozen} />}
		/>
	);
}

/** Note → paper slip. */
export function SlipNode({ data }: BoardNodeProps) {
	const { item, currentUserId, frozen } = data;
	const [flipped, setFlipped] = useFlip();
	const size = ITEM_SIZES.note;

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
				<div
					className={cn(
						'flex h-full w-full items-center justify-center overflow-hidden rounded-lg border border-line p-4 shadow-card',
						seededTone(item.id),
					)}
				>
					<p className="line-clamp-6 max-h-full font-serif text-2xl leading-snug [overflow-wrap:anywhere]">
						{item.text}
					</p>
				</div>
			}
			back={<CardBack item={item} currentUserId={currentUserId} frozen={frozen} />}
		/>
	);
}

/** Emoji → oversized sticker. Stickers stay silent: no back, no thread. */
export function StickerNode({ data }: BoardNodeProps) {
	const { item, currentUserId, frozen } = data;
	const size = ITEM_SIZES.emoji;

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
				<div className="group/sticker grid h-full w-full place-items-center">
					<span className="grid h-full w-full place-items-center rounded-[38%] bg-card text-6xl shadow-card ring-1 ring-line/60 [filter:drop-shadow(0_5px_8px_rgb(64_56_47/0.14))]">
						{item.text}
					</span>
					<HoverDelete item={item} currentUserId={currentUserId} frozen={frozen} />
				</div>
			}
		/>
	);
}

/** Drawing → a free pencil stroke, floating on the paper. Silent like stickers. */
export function DrawingNode({ data }: BoardNodeProps) {
	const { item, currentUserId, frozen } = data;
	const drawing = parseDrawing(item.text);

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
				<div className="group/sticker h-full w-full">
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
					<HoverDelete item={item} currentUserId={currentUserId} frozen={frozen} />
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

/** Author-only ×, fading in on hover — silent items still leave the board. */
function HoverDelete({
	item,
	currentUserId,
	frozen,
}: {
	item: BoardItem;
	currentUserId: string;
	frozen: boolean;
}) {
	const deleteFetcher = useFetcher();
	const [confirming, setConfirming] = useState(false);
	if (frozen || item.authorId !== currentUserId) return null;

	return (
		<>
			<button
				type="button"
				aria-label="Remove from the board"
				onClick={() => setConfirming(true)}
				className="nodrag -top-1.5 -right-1.5 absolute grid h-6 w-6 place-items-center rounded-full border border-line bg-card text-ink-soft opacity-0 shadow-card transition-opacity hover:text-accent-deep group-hover/sticker:opacity-100"
			>
				<XIcon className="h-3 w-3" />
			</button>
			<ConfirmDialog
				open={confirming}
				onClose={() => setConfirming(false)}
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
				<span
					key={comment.id}
					className="max-w-full truncate font-serif text-[13px] text-ink-soft leading-tight"
				>
					<span className="text-ink-faint">{comment.authorName ?? 'Someone'}:</span> {comment.text}
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
			back={<CardBack item={item} currentUserId={currentUserId} frozen={frozen} />}
		/>
	);
}
