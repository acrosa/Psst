import { useEffect, useRef, useState } from 'react';
import { Link, useFetcher, useRevalidator } from 'react-router';
import { AppHeader } from '~/components/app-header';
import { Board } from '~/components/canvas/board';
import { Composer } from '~/components/canvas/composer';
import { InviteDialog } from '~/components/invite-dialog';
import { AvatarStack } from '~/components/ui/avatar';
import { Button } from '~/components/ui/button';
import { requireUser } from '~/lib/auth.server';
import { formatDay } from '~/lib/dates';
import { env } from '~/lib/env.server';
import { getBoardItems, getOrCreateTodayCanvas } from '~/lib/services/canvases.server';
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
		throw new Response('Not found', { status: 404 });
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
		board: { date: canvas.date, items },
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
	const [boardReady, setBoardReady] = useState(false);
	const dragging = useRef(false);
	const revalidator = useRevalidator();
	const moveFetcher = useFetcher();

	// The board is client-only (pan/zoom/drag) — mount after hydration.
	useEffect(() => setBoardReady(true), []);

	// Ambient sync: gentle polling, paused while dragging. Background tabs keep
	// polling (browser throttling caps the rate) so the board is current the
	// moment you glance back at it.
	useEffect(() => {
		const id = setInterval(() => {
			if (dragging.current || revalidator.state !== 'idle') return;
			revalidator.revalidate();
		}, pollMs);
		return () => clearInterval(id);
	}, [revalidator, pollMs]);

	return (
		<div className="flex h-svh flex-col">
			<AppHeader
				user={user}
				menuLinks={[
					{ label: 'Invite', onClick: () => setInviting(true), icon: 'invite', mobileOnly: true },
					{
						label: 'Timeline',
						to: `/spaces/${space.id}/days`,
						icon: 'timeline',
						mobileOnly: true,
					},
					{ label: 'Space settings', to: `/spaces/${space.id}/settings`, icon: 'settings' },
				]}
			>
				<div className="flex min-w-0 items-center gap-2 sm:gap-3">
					<span className="shrink-0 text-xl sm:text-2xl" aria-hidden>
						{space.emoji}
					</span>
					<div className="min-w-0">
						<div className="truncate font-medium text-sm leading-tight sm:text-base">
							{space.name}
						</div>
						<div className="hidden truncate text-ink-faint text-xs leading-tight sm:block">
							Today · {formatDay(board.date)}
						</div>
					</div>
					<span className="hidden shrink-0 sm:block">
						<Button size="sm" onClick={() => setInviting(true)}>
							Invite
						</Button>
					</span>
					<Link
						to={`/spaces/${space.id}/days`}
						className="hidden shrink-0 rounded-lg px-1.5 py-1.5 text-ink-soft text-sm transition hover:bg-paper-deep hover:text-ink sm:block sm:px-2"
					>
						Timeline
					</Link>
				</div>
			</AppHeader>

			<main className="relative min-h-0 flex-1">
				{boardReady ? (
					<Board
						items={board.items}
						currentUserId={user.id}
						frozen={false}
						composer={<Composer />}
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
				{/* The people at the table, tucked under the account corner */}
				<div className="pointer-events-none absolute top-3 right-4 z-10 hidden sm:block">
					<AvatarStack people={members} />
				</div>
			</main>

			<InviteDialog open={inviting} onClose={() => setInviting(false)} />
		</div>
	);
}
