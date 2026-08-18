import { useState } from 'react';
import { Link } from 'react-router';
import { AppHeader } from '~/components/app-header';
import { InviteDialog } from '~/components/invite-dialog';
import { AvatarStack } from '~/components/ui/avatar';
import { Button } from '~/components/ui/button';
import { requireUser } from '~/lib/auth.server';
import { createInvite } from '~/lib/services/invites.server';
import { getSpace, getSpaceMembers, requireMember } from '~/lib/services/spaces.server';
import type { Route } from './+types/space';

export function meta({ data }: Route.MetaArgs) {
	const title = data ? `${data.space.emoji} ${data.space.name} — psst` : 'psst';
	return [{ title }];
}

export async function loader({ request, params }: Route.LoaderArgs) {
	const user = await requireUser(request);
	await requireMember(params.spaceId, user.id);
	const space = await getSpace(params.spaceId);
	if (!space) {
		throw new Response('Not found', { status: 404 });
	}
	const members = await getSpaceMembers(space.id);
	return {
		user: { id: user.id, name: user.name ?? null },
		space: { id: space.id, name: space.name, emoji: space.emoji, timezone: space.timezone },
		members,
	};
}

export async function action({ request, params }: Route.ActionArgs) {
	const user = await requireUser(request);
	await requireMember(params.spaceId, user.id);
	const formData = await request.formData();
	const intent = formData.get('intent');

	if (intent === 'create-invite') {
		const { url } = await createInvite({ spaceId: params.spaceId, userId: user.id });
		return { inviteUrl: url };
	}

	if (intent === 'email-invite') {
		const email = String(formData.get('email') ?? '').trim();
		if (!email || !email.includes('@')) {
			return { error: 'That email looks off — try again?' };
		}
		await createInvite({ spaceId: params.spaceId, userId: user.id, email });
		return { emailedTo: email };
	}

	return null;
}

export default function Space({ loaderData }: Route.ComponentProps) {
	const { space, members, user } = loaderData;
	const [inviting, setInviting] = useState(false);

	return (
		<div className="flex min-h-svh flex-col">
			<AppHeader userName={user.name}>
				<div className="flex min-w-0 items-center gap-3">
					<span className="text-2xl" aria-hidden>
						{space.emoji}
					</span>
					<span className="truncate font-medium">{space.name}</span>
					<AvatarStack people={members} className="hidden sm:flex" />
					<Button size="sm" onClick={() => setInviting(true)}>
						Invite
					</Button>
					<Link
						to={`/spaces/${space.id}/settings`}
						aria-label="Space settings"
						className="rounded-lg p-1.5 text-ink-soft transition hover:bg-paper-deep hover:text-ink"
					>
						⚙︎
					</Link>
				</div>
			</AppHeader>

			<main className="flex flex-1 items-center justify-center p-6">
				<p className="text-ink-faint">🖼️ The canvas lands here next.</p>
			</main>

			<InviteDialog open={inviting} onClose={() => setInviting(false)} />
		</div>
	);
}
