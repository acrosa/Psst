import { eq } from 'drizzle-orm';
import { useEffect } from 'react';
import { Form, Link, redirect, useRevalidator } from 'react-router';
import { isAdminEmail } from '~/lib/admin.server';
import { getUser } from '~/lib/auth.server';
import { db, schema } from '~/lib/db/client.server';
import { ogMeta } from '~/lib/og';
import type { Route } from './+types/waitlist';

export function meta() {
	return [
		{ title: "You're on the list — psst" },
		...ogMeta({
			title: 'psst',
			description: 'A little shared canvas for the people you whisper to.',
		}),
	];
}

export async function loader({ request }: Route.LoaderArgs) {
	const user = await getUser(request);
	if (!user) {
		throw redirect('/login');
	}
	if (isAdminEmail(user.email)) {
		throw redirect('/spaces');
	}
	const [row] = await db
		.select({ acceptedAt: schema.users.acceptedAt })
		.from(schema.users)
		.where(eq(schema.users.id, user.id));
	if (row?.acceptedAt) {
		throw redirect('/spaces');
	}
	return { email: user.email, name: user.name ?? null };
}

export default function Waitlist({ loaderData }: Route.ComponentProps) {
	const revalidator = useRevalidator();

	// A quiet check now and then — the moment you're in, the page walks you in.
	useEffect(() => {
		const id = setInterval(() => {
			if (revalidator.state === 'idle') revalidator.revalidate();
		}, 20_000);
		const onVisible = () => {
			if (document.visibilityState === 'visible' && revalidator.state === 'idle') {
				revalidator.revalidate();
			}
		};
		document.addEventListener('visibilitychange', onVisible);
		return () => {
			clearInterval(id);
			document.removeEventListener('visibilitychange', onVisible);
		};
	}, [revalidator]);

	const firstName = loaderData.name?.split(/\s+/)[0];

	return (
		<main className="mx-auto flex min-h-svh w-full max-w-md flex-col justify-center gap-6 px-6 py-16">
			<Link to="/" className="font-serif text-2xl italic leading-none">
				psst
			</Link>

			<h1 className="font-serif text-4xl leading-tight">
				{firstName ? `${firstName}, you're` : "You're"} on the list
			</h1>

			<p className="text-ink-soft leading-relaxed">
				psst is a quiet place — we let people in a few at a time. You'll get an email at{' '}
				<span className="text-ink">{loaderData.email}</span> the moment your spot opens. Nothing
				else to do.
			</p>

			<p className="font-mono font-semibold text-[11px] text-ink-faint uppercase tracking-[0.2em]">
				not a chat · no pressure · just keepsakes
			</p>

			<Form method="post" action="/logout">
				<button type="submit" className="text-ink-faint text-sm underline underline-offset-2">
					Sign out
				</button>
			</Form>
		</main>
	);
}
