import { Form, Link, redirect, useNavigation } from 'react-router';
import { Button } from '~/components/ui/button';
import { getUser, requireUser } from '~/lib/auth.server';
import { acceptInvite, getInviteByToken } from '~/lib/services/invites.server';
import { getMembership } from '~/lib/services/spaces.server';
import type { Route } from './+types/invite';

export function meta() {
	return [{ title: "You're invited — psst" }];
}

export async function loader({ request, params }: Route.LoaderArgs) {
	const [lookup, user] = await Promise.all([getInviteByToken(params.token), getUser(request)]);

	if (lookup.status !== 'ok') {
		return { status: lookup.status, user: null, invite: null, alreadyMember: false };
	}

	const alreadyMember = user ? Boolean(await getMembership(lookup.space.id, user.id)) : false;

	return {
		status: 'ok' as const,
		user: user ? { name: user.name ?? null } : null,
		invite: {
			token: params.token,
			email: lookup.invite.email,
			spaceId: lookup.space.id,
			spaceName: lookup.space.name,
			spaceEmoji: lookup.space.emoji,
			inviterName: lookup.inviterName,
		},
		alreadyMember,
	};
}

export async function action({ request, params }: Route.ActionArgs) {
	const user = await requireUser(request);
	const result = await acceptInvite({ token: params.token, userId: user.id });

	if (result.status === 'joined' || result.status === 'already-member') {
		throw redirect(`/spaces/${result.spaceId}`);
	}
	return { error: result.status };
}

function InviteShell({ children }: { children: React.ReactNode }) {
	return (
		<main className="flex min-h-svh flex-col items-center justify-center p-6">
			<div className="w-full max-w-sm animate-pop-in rounded-xl border border-line bg-card p-8 text-center shadow-lift">
				{children}
			</div>
		</main>
	);
}

const SAD_STATES: Record<string, { title: string; detail: string }> = {
	invalid: {
		title: 'This invite wandered off',
		detail: "The link doesn't match any invite — it may have been revoked. Ask for a fresh one.",
	},
	expired: {
		title: 'This invite expired',
		detail: 'Invites last a week. Ask them to send you a fresh link — it takes one tap.',
	},
	used: {
		title: 'This invite was already used',
		detail: 'Each link seats one person. Ask them to send you a fresh one — it takes one tap.',
	},
	full: {
		title: 'This space is full',
		detail: 'Spaces stay small on purpose — eight people max, to keep it intimate.',
	},
};

export default function InvitePage({ loaderData, actionData }: Route.ComponentProps) {
	const navigation = useNavigation();

	const sad =
		loaderData.status !== 'ok'
			? SAD_STATES[loaderData.status]
			: actionData?.error
				? SAD_STATES[actionData.error]
				: null;

	if (sad || !loaderData.invite) {
		const fallback = SAD_STATES.invalid;
		return (
			<InviteShell>
				<div className="text-5xl">🫥</div>
				<h1 className="mt-4 font-hand text-3xl">{sad?.title ?? fallback.title}</h1>
				<p className="mt-2 text-sm text-ink-soft">{sad?.detail ?? fallback.detail}</p>
				<Link
					to="/"
					className="mt-6 inline-block text-sm text-accent-deep underline underline-offset-2"
				>
					Go home
				</Link>
			</InviteShell>
		);
	}

	const { invite, user, alreadyMember } = loaderData;
	const invitePath = `/invite/${invite.token}`;
	const registerTo = `/register?next=${encodeURIComponent(invitePath)}${
		invite.email ? `&email=${encodeURIComponent(invite.email)}` : ''
	}`;
	const loginTo = `/login?next=${encodeURIComponent(invitePath)}`;

	return (
		<InviteShell>
			<div className="text-6xl">{invite.spaceEmoji}</div>
			<h1 className="mt-4 font-hand text-3xl leading-tight">
				{invite.inviterName ?? 'Someone'} saved you a spot
			</h1>
			<p className="mt-2 text-ink-soft">
				on <strong className="text-ink">{invite.spaceName}</strong> — a little canvas you'll share.
				Drop links, notes and photos; every day becomes a page in your scrapbook.
			</p>

			{user ? (
				alreadyMember ? (
					<div className="mt-6 grid gap-3">
						<p className="text-sm text-ink-soft">You're already in! 🎉</p>
						<Link
							to={`/spaces/${invite.spaceId}`}
							className="rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white shadow-card transition hover:bg-accent-deep"
						>
							Open {invite.spaceName}
						</Link>
					</div>
				) : (
					<Form method="post" className="mt-6">
						<Button type="submit" className="w-full" disabled={navigation.state === 'submitting'}>
							{navigation.state === 'submitting' ? 'Joining…' : `Join ${invite.spaceName}`}
						</Button>
					</Form>
				)
			) : (
				<div className="mt-6 grid gap-2">
					<Link
						to={registerTo}
						className="rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white shadow-card transition hover:bg-accent-deep"
					>
						Sign up to join
					</Link>
					<Link to={loginTo} className="py-1.5 text-sm text-ink-soft transition hover:text-ink">
						I already have an account
					</Link>
				</div>
			)}
		</InviteShell>
	);
}
