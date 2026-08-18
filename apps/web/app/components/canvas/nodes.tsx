import type { NodeProps } from '@xyflow/react';
import { useState } from 'react';
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
				<div className="space-y-0.5 p-2.5">
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
			onToggle={() => setFlipped((f) => !f)}
			front={
				<div
					className={cn(
						'flex h-full w-full items-center justify-center overflow-hidden rounded-lg border border-line p-4 shadow-card',
						seededTone(item.id),
					)}
				>
					<p className="line-clamp-6 max-h-full font-hand text-2xl leading-snug [overflow-wrap:anywhere]">
						{item.text}
					</p>
				</div>
			}
			back={<CardBack item={item} currentUserId={currentUserId} frozen={frozen} />}
		/>
	);
}

/** Emoji → oversized sticker. */
export function StickerNode({ data }: BoardNodeProps) {
	const { item, currentUserId, frozen } = data;
	const [flipped, setFlipped] = useFlip();
	const size = ITEM_SIZES.emoji;

	return (
		<FlipCard
			width={size.w}
			height={size.h}
			rotation={item.rotation}
			flipped={flipped}
			onToggle={() => setFlipped((f) => !f)}
			front={
				<div className="grid h-full w-full place-items-center text-7xl [filter:drop-shadow(0_6px_10px_rgb(64_56_47/0.18))]">
					<span>{item.text}</span>
				</div>
			}
			back={<CardBack item={item} currentUserId={currentUserId} frozen={frozen} />}
		/>
	);
}

function PostageStamp() {
	return (
		<div
			className="absolute top-1.5 right-1.5 grid h-7 w-7 rotate-6 place-items-center rounded-sm border border-white/70 border-dashed bg-accent/85 text-xs text-white"
			aria-hidden
		>
			✷
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
			aria-label="Open link"
			data-noflip
			className="nodrag absolute right-1.5 bottom-1.5 rounded-md bg-card/80 px-1.5 py-0.5 text-xs text-ink-soft shadow-card backdrop-blur transition hover:text-ink"
		>
			↗
		</a>
	);
}

/** Image → photo print with blurhash bloom. */
export function PrintNode({ data }: BoardNodeProps) {
	const { item, currentUserId, frozen } = data;
	const [flipped, setFlipped] = useFlip();
	const [loaded, setLoaded] = useState(false);
	const size = ITEM_SIZES.image;

	const photo =
		item.assets.find((asset) => asset.kind === 'thumb') ??
		item.assets.find((asset) => asset.kind === 'original');
	const blurhash = photo?.blurhash ?? null;

	return (
		<FlipCard
			width={size.w}
			height={size.h}
			rotation={item.rotation}
			flipped={flipped}
			onToggle={() => setFlipped((f) => !f)}
			front={
				<div className="flex h-full w-full flex-col rounded-lg border border-line bg-card p-2 pb-7 shadow-card">
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
