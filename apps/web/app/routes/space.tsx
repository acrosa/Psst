import { useEffect, useRef, useState } from 'react';
import { Link, redirect, useFetcher, useRevalidator } from 'react-router';
import { AppHeader } from '~/components/app-header';
import { Board } from '~/components/canvas/board';
import { Composer } from '~/components/canvas/composer';
import { InviteDialog } from '~/components/invite-dialog';
import { ShareDialog } from '~/components/share-dialog';
import { SpaceMenu } from '~/components/space-menu';
import { AvatarStack } from '~/components/ui/avatar';
import { Button } from '~/components/ui/button';
import { requireUser } from '~/lib/auth.server';
import { formatDay } from '~/lib/dates';
import { env } from '~/lib/env.server';
import {
	getBoardItems,
	getOrCreateTodayCanvas,
	shareCanvas,
	unshareCanvas,
} from '~/lib/services/canvases.server';
import { createInvite } from '~/lib/services/invites.server';
import {
	addComment,
	createAudioItem,
	createImageItem,
	createItem,
	deleteItem,
	moveItem,
	resizeItem,
	toggleReaction,
} from '~/lib/services/items.server';
import {
	ensureMember,
	getSpace,
	getSpaceMembers,
	requireMember,
} from '~/lib/services/spaces.server';
import { publicUrl } from '~/lib/storage.server';
import type { Route } from './+types/space';

export function meta({ data }: Route.MetaArgs) {
	const title = data ? `${data.space.emoji} ${data.space.name} — psst` : 'psst';
	return [{ title }];
}

export async function loader({ request, params }: Route.LoaderArgs) {
	const user = await requireUser(request);
	// A shared canvas link is an open door: signed-in visitors join on arrival.
	await ensureMember(params.spaceId, user.id);
	const space = await getSpace(params.spaceId);
	if (!space) {
		throw redirect('/spaces');
	}

	const [members, canvas] = await Promise.all([
		getSpaceMembers(space.id),
		getOrCreateTodayCanvas(space.id, space.timezone),
	]);
	const items = await getBoardItems(canvas.id, publicUrl);

	return {
		user: { id: user.id, name: user.name ?? null, image: user.image ?? null },
		space: { id: space.id, name: space.name, emoji: space.emoji, timezone: space.timezone },
		members,
		board: { date: canvas.date, items, shareToken: canvas.shareToken ?? null },
		pollMs: env.NODE_ENV === 'test' ? 2000 : 10_000,
	};
}

/** Optional drop/paste position; absent or malformed → collage auto-placement. */
function parsePosition(formData: FormData) {
	const x = Number.parseFloat(String(formData.get('x') ?? ''));
	const y = Number.parseFloat(String(formData.get('y') ?? ''));
	return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : undefined;
}

export async function action({ request, params }: Route.ActionArgs) {
	const user = await requireUser(request);
	await requireMember(params.spaceId, user.id);
	const formData = await request.formData();
	const intent = formData.get('intent');

	try {
		switch (intent) {
			case 'share-day': {
				const space = await getSpace(params.spaceId);
				if (!space) return { error: 'No space.' };
				const canvas = await getOrCreateTodayCanvas(space.id, space.timezone);
				const token = await shareCanvas(canvas.id);
				return { shareUrl: new URL(`/b/${token}`, request.url).toString() };
			}
			case 'unshare-day': {
				const space = await getSpace(params.spaceId);
				if (!space) return { error: 'No space.' };
				const canvas = await getOrCreateTodayCanvas(space.id, space.timezone);
				await unshareCanvas(canvas.id);
				return { unshared: true };
			}
			case 'create-invite': {
				const { url } = await createInvite({ spaceId: params.spaceId, userId: user.id });
				return { inviteUrl: url };
			}
			case 'email-invite': {
				const email = String(formData.get('email') ?? '').trim();
				if (!email || !email.includes('@')) {
					return { error: 'That email looks off — try again?' };
				}
				await createInvite({ spaceId: params.spaceId, userId: user.id, email });
				return { emailedTo: email };
			}
			case 'create-item': {
				const kind = String(formData.get('kind') ?? 'note');
				if (kind !== 'link' && kind !== 'note' && kind !== 'emoji' && kind !== 'drawing') {
					return { error: 'Unknown item kind.' };
				}
				await createItem({
					spaceId: params.spaceId,
					userId: user.id,
					kind,
					content: String(formData.get('content') ?? ''),
					position: parsePosition(formData),
				});
				return { ok: true };
			}
			case 'create-audio': {
				const audio = formData.get('file');
				if (!(audio instanceof File) || audio.size === 0) {
					return { error: 'Record something first.' };
				}
				await createAudioItem({
					spaceId: params.spaceId,
					userId: user.id,
					file: audio,
					meta: String(formData.get('content') ?? ''),
					position: parsePosition(formData),
				});
				return { ok: true };
			}
			case 'create-image': {
				const file = formData.get('file');
				if (!(file instanceof File) || file.size === 0) {
					return { error: 'Pick a photo first.' };
				}
				await createImageItem({
					spaceId: params.spaceId,
					userId: user.id,
					file,
					position: parsePosition(formData),
				});
				return { ok: true };
			}
			case 'move-item': {
				await moveItem({
					itemId: String(formData.get('itemId') ?? ''),
					userId: user.id,
					x: Number.parseFloat(String(formData.get('x'))),
					y: Number.parseFloat(String(formData.get('y'))),
				});
				return { ok: true };
			}
			case 'resize-item': {
				await resizeItem({
					itemId: String(formData.get('itemId') ?? ''),
					userId: user.id,
					scale: Number.parseFloat(String(formData.get('scale'))),
				});
				return { ok: true };
			}
			case 'add-comment': {
				await addComment({
					itemId: String(formData.get('itemId') ?? ''),
					userId: user.id,
					text: String(formData.get('text') ?? ''),
				});
				return { ok: true };
			}
			case 'toggle-reaction': {
				await toggleReaction({
					itemId: String(formData.get('itemId') ?? ''),
					userId: user.id,
					emoji: String(formData.get('emoji') ?? ''),
				});
				return { ok: true };
			}
			case 'delete-item': {
				await deleteItem({ itemId: String(formData.get('itemId') ?? ''), userId: user.id });
				return { ok: true };
			}
			case 'delete-items': {
				const ids = String(formData.get('itemIds') ?? '')
					.split(',')
					.filter(Boolean)
					.slice(0, 50);
				for (const itemId of ids) {
					await deleteItem({ itemId, userId: user.id });
				}
				return { ok: true };
			}
			default:
				return null;
		}
	} catch (error) {
		// Services throw 4xx Responses with friendly text — surface them to the
		// fetcher that asked instead of the error boundary.
		if (error instanceof Response && error.status < 500) {
			return { error: await error.text() };
		}
		throw error;
	}
}

export default function Space({ loaderData }: Route.ComponentProps) {
	const { space, members, user, board, pollMs } = loaderData;
	const [inviting, setInviting] = useState(false);
	const [sharing, setSharing] = useState(false);
	const [boardReady, setBoardReady] = useState(false);
	const dragging = useRef(false);
	const revalidator = useRevalidator();
	const moveFetcher = useFetcher();

	// The board is client-only (pan/zoom/drag) — mount after hydration.
	useEffect(() => setBoardReady(true), []);

	// Ambient sync: gentle polling, paused while dragging. Background tabs keep
	// polling (browser throttling caps the rate), and coming back into view —
	// tab switch, or the iOS app returning to the foreground — revalidates
	// immediately, so the board is current the moment you glance at it.
	useEffect(() => {
		const refresh = () => {
			if (dragging.current || revalidator.state !== 'idle') return;
			revalidator.revalidate();
		};
		const id = setInterval(refresh, pollMs);
		const onVisible = () => {
			if (document.visibilityState === 'visible') refresh();
		};
		document.addEventListener('visibilitychange', onVisible);
		window.addEventListener('focus', onVisible);
		return () => {
			clearInterval(id);
			document.removeEventListener('visibilitychange', onVisible);
			window.removeEventListener('focus', onVisible);
		};
	}, [revalidator, pollMs]);

	return (
		<div className="flex h-svh flex-col">
			<AppHeader
				user={user}
				menuLinks={[
					{ label: 'Invite', onClick: () => setInviting(true), icon: 'invite', mobileOnly: true },
					{ label: 'Share this day', onClick: () => setSharing(true), icon: 'share' },
					{ label: 'Space settings', to: `/spaces/${space.id}/settings`, icon: 'settings' },
				]}
			>
				<div className="flex min-w-0 items-center gap-2 sm:gap-3">
					{/* The name is the door: timeline, or the other spaces. */}
					<SpaceMenu
						spaceId={space.id}
						emoji={space.emoji}
						name={space.name}
						subtitle={`Today · ${formatDay(board.date)}`}
					/>
				</div>
			</AppHeader>

			<main className="relative min-h-0 flex-1">
				{boardReady ? (
					<Board
						items={board.items}
						currentUserId={user.id}
						frozen={false}
						members={members}
						composer={<Composer members={members} />}
						onLike={(itemId) =>
							moveFetcher.submit(
								{ intent: 'toggle-reaction', itemId, emoji: '🫶' },
								{ method: 'post' },
							)
						}
						onDelete={(itemIds) =>
							moveFetcher.submit(
								{ intent: 'delete-items', itemIds: itemIds.join(',') },
								{ method: 'post' },
							)
						}
						onDraggingChange={(value) => {
							dragging.current = value;
						}}
						onMove={(itemId, x, y) =>
							moveFetcher.submit(
								{ intent: 'move-item', itemId, x: String(x), y: String(y) },
								{ method: 'post' },
							)
						}
						onResize={(itemId, scale) =>
							moveFetcher.submit(
								{ intent: 'resize-item', itemId, scale: String(scale) },
								{ method: 'post' },
							)
						}
					/>
				) : (
					<div className="grid h-full place-items-center text-ink-faint">
						<span className="animate-shimmer font-serif text-2xl italic">setting the table…</span>
					</div>
				)}
				{/* The people at the table, and the way to add one more */}
				<div className="absolute top-3 right-4 z-10 hidden sm:block">
					<div className="flex items-center gap-2.5 rounded-full border border-line bg-card/90 py-1.5 pr-1.5 pl-2.5 shadow-card backdrop-blur">
						<AvatarStack people={members} />
						<Button variant="soft" size="sm" onClick={() => setInviting(true)}>
							Invite
						</Button>
					</div>
				</div>
			</main>

			<InviteDialog open={inviting} onClose={() => setInviting(false)} />
			<ShareDialog
				open={sharing}
				onClose={() => setSharing(false)}
				alreadyShared={board.shareToken !== null}
			/>
		</div>
	);
}
