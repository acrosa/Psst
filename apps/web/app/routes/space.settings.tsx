import { Form, Link, redirect } from 'react-router';
import { AppHeader } from '~/components/app-header';
import { EmojiPicker } from '~/components/emoji-picker';
import { Avatar } from '~/components/ui/avatar';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { requireUser } from '~/lib/auth.server';
import { listPendingInvites, revokeInvite } from '~/lib/services/invites.server';
import {
	getSpace,
	getSpaceMembers,
	leaveSpace,
	requireMember,
	updateSpace,
} from '~/lib/services/spaces.server';
import type { Route } from './+types/space.settings';

export function meta({ data }: Route.MetaArgs) {
	const title = data ? `Settings · ${data.space.name} — psst` : 'Settings — psst';
	return [{ title }];
}

export async function loader({ request, params }: Route.LoaderArgs) {
	const user = await requireUser(request);
	const membership = await requireMember(params.spaceId, user.id);
	const space = await getSpace(params.spaceId);
	if (!space) {
		throw new Response('Not found', { status: 404 });
	}
	const [members, invites] = await Promise.all([
		getSpaceMembers(space.id),
		listPendingInvites(space.id),
	]);
	return {
		user: { id: user.id, name: user.name ?? null },
		role: membership.role,
		space: { id: space.id, name: space.name, emoji: space.emoji, timezone: space.timezone },
		members,
		invites: invites.map((invite) => ({
			id: invite.id,
			email: invite.email,
			createdAt: invite.createdAt.toISOString(),
		})),
	};
}

export async function action({ request, params }: Route.ActionArgs) {
	const user = await requireUser(request);
	const membership = await requireMember(params.spaceId, user.id);
	const formData = await request.formData();
	const intent = formData.get('intent');

	if (intent === 'rename' && membership.role === 'owner') {
		const name = String(formData.get('name') ?? '').trim();
		const emoji = String(formData.get('emoji') ?? '').trim();
		if (!name) {
			return { error: 'A space needs a name.' };
		}
		await updateSpace(params.spaceId, { name, ...(emoji ? { emoji } : {}) });
		return { saved: true };
	}

	if (intent === 'revoke-invite') {
		const inviteId = String(formData.get('inviteId') ?? '');
		if (inviteId) {
			await revokeInvite(inviteId, params.spaceId);
		}
		return { saved: true };
	}

	if (intent === 'leave') {
		if (membership.role === 'owner') {
			return { error: "Owners can't leave their own space (yet)." };
		}
		await leaveSpace(params.spaceId, user.id);
		throw redirect('/spaces');
	}

	return null;
}

export default function SpaceSettings({ loaderData, actionData }: Route.ComponentProps) {
	const { space, members, invites, role, user } = loaderData;
	const isOwner = role === 'owner';

	return (
		<div className="min-h-svh">
			<AppHeader userName={user.name}>
				<Link
					to={`/spaces/${space.id}`}
					className="text-sm text-ink-soft transition hover:text-ink"
				>
					← back to {space.emoji} {space.name}
				</Link>
			</AppHeader>

			<main className="mx-auto grid max-w-xl gap-8 p-6">
				<h1 className="font-hand text-3xl">Space settings</h1>

				{actionData && 'error' in actionData && actionData.error ? (
					<p className="rounded-lg bg-accent-soft px-3 py-2 text-sm text-accent-deep">
						{actionData.error}
					</p>
				) : null}

				{isOwner ? (
					<section className="grid gap-4 rounded-xl border border-line bg-card p-5 shadow-card">
						<h2 className="font-medium">Look &amp; feel</h2>
						<Form method="post" className="grid gap-4">
							<input type="hidden" name="intent" value="rename" />
							<div className="grid gap-1.5">
								<Label htmlFor="settings-name">Space name</Label>
								<Input
									id="settings-name"
									name="name"
									defaultValue={space.name}
									maxLength={60}
									required
								/>
							</div>
							<div className="grid gap-1.5">
								<Label>Mood</Label>
								<EmojiPicker defaultValue={space.emoji} />
							</div>
							<Button type="submit" className="justify-self-start">
								Save
							</Button>
						</Form>
					</section>
				) : null}

				<section className="grid gap-3 rounded-xl border border-line bg-card p-5 shadow-card">
					<h2 className="font-medium">Members</h2>
					<ul className="grid gap-2">
						{members.map((member) => (
							<li key={member.id} className="flex items-center gap-3">
								<Avatar name={member.name} image={member.image} />
								<span className="flex-1 text-sm">{member.name ?? 'Someone'}</span>
								<span className="text-xs text-ink-faint">{member.role}</span>
							</li>
						))}
					</ul>
				</section>

				{invites.length > 0 ? (
					<section className="grid gap-3 rounded-xl border border-line bg-card p-5 shadow-card">
						<h2 className="font-medium">Open invites</h2>
						<ul className="grid gap-2">
							{invites.map((invite) => (
								<li key={invite.id} className="flex items-center gap-3 text-sm">
									<span className="flex-1 truncate text-ink-soft">
										{invite.email ?? 'Link invite'}
									</span>
									<Form method="post">
										<input type="hidden" name="intent" value="revoke-invite" />
										<input type="hidden" name="inviteId" value={invite.id} />
										<Button type="submit" variant="danger" size="sm">
											Revoke
										</Button>
									</Form>
								</li>
							))}
						</ul>
					</section>
				) : null}

				<section className="grid gap-3 rounded-xl border border-line bg-card p-5 shadow-card">
					<h2 className="font-medium">Leaving</h2>
					{isOwner ? (
						<p className="text-sm text-ink-soft">
							You made this place — owners can't leave it (yet).
						</p>
					) : (
						<Form method="post">
							<input type="hidden" name="intent" value="leave" />
							<Button type="submit" variant="danger">
								Leave this space
							</Button>
						</Form>
					)}
				</section>
			</main>
		</div>
	);
}
