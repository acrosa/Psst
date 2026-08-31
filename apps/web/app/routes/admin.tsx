import { desc, eq, isNull } from 'drizzle-orm';
import { Link, useFetcher } from 'react-router';
import { Button } from '~/components/ui/button';
import { isAdminEmail } from '~/lib/admin.server';
import { requireUser } from '~/lib/auth.server';
import { db, schema } from '~/lib/db/client.server';
import { sendAcceptedEmail } from '~/lib/email.server';
import type { Route } from './+types/admin';

export function meta() {
	return [{ title: 'The door — psst' }];
}

async function requireAdmin(request: Request) {
	const user = await requireUser(request);
	if (!isAdminEmail(user.email)) {
		throw new Response('Not found', { status: 404 });
	}
	return user;
}

export async function loader({ request }: Route.LoaderArgs) {
	await requireAdmin(request);
	const users = await db
		.select({
			id: schema.users.id,
			name: schema.users.name,
			email: schema.users.email,
			createdAt: schema.users.createdAt,
			acceptedAt: schema.users.acceptedAt,
		})
		.from(schema.users)
		.orderBy(desc(schema.users.createdAt));
	return {
		waiting: users.filter((u) => !u.acceptedAt && !isAdminEmail(u.email)),
		accepted: users.filter((u) => u.acceptedAt || isAdminEmail(u.email)),
	};
}

export async function action({ request }: Route.ActionArgs) {
	await requireAdmin(request);
	const formData = await request.formData();
	if (formData.get('intent') !== 'accept') return null;

	const userId = String(formData.get('userId') ?? '');
	const [user] = await db
		.select({ id: schema.users.id, email: schema.users.email, name: schema.users.name })
		.from(schema.users)
		.where(eq(schema.users.id, userId));
	if (!user) return { error: 'No such person.' };

	await db.update(schema.users).set({ acceptedAt: new Date() }).where(eq(schema.users.id, user.id));
	await sendAcceptedEmail({ to: user.email, name: user.name });
	return { ok: true };
}

function when(date: Date | null): string {
	if (!date) return '';
	return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date);
}

export default function Admin({ loaderData }: Route.ComponentProps) {
	const { waiting, accepted } = loaderData;

	return (
		<main className="mx-auto w-full max-w-2xl px-6 py-16">
			<Link to="/spaces" className="font-serif text-2xl italic leading-none">
				psst
			</Link>

			<h1 className="mt-10 font-serif text-4xl">The door</h1>
			<p className="mt-2 text-ink-soft">
				{waiting.length === 0
					? 'No one waiting — the list is clear.'
					: waiting.length === 1
						? 'One person waiting.'
						: `${waiting.length} people waiting.`}
			</p>

			{waiting.length > 0 ? (
				<ul className="mt-8 divide-y divide-line rounded-xl border border-line bg-card">
					{waiting.map((person) => (
						<WaitingRow key={person.id} person={person} />
					))}
				</ul>
			) : null}

			<h2 className="mt-12 font-mono font-semibold text-[11px] text-ink-faint uppercase tracking-[0.2em]">
				Inside · {accepted.length}
			</h2>
			<ul className="mt-3 space-y-1.5">
				{accepted.map((person) => (
					<li key={person.id} className="flex items-baseline justify-between gap-3 text-sm">
						<span className="truncate">
							{person.name ?? 'Unnamed'} <span className="text-ink-faint">{person.email}</span>
						</span>
						<span className="shrink-0 font-mono text-[11px] text-ink-faint">
							{when(person.acceptedAt)}
						</span>
					</li>
				))}
			</ul>
		</main>
	);
}

function WaitingRow({
	person,
}: {
	person: { id: string; name: string | null; email: string; createdAt: Date | null };
}) {
	const fetcher = useFetcher();
	const accepting = fetcher.state !== 'idle';

	return (
		<li className="flex items-center justify-between gap-3 px-4 py-3">
			<div className="min-w-0">
				<div className="truncate font-medium text-sm">{person.name ?? 'Unnamed'}</div>
				<div className="truncate text-ink-soft text-sm">{person.email}</div>
			</div>
			<div className="flex shrink-0 items-center gap-3">
				<span className="font-mono text-[11px] text-ink-faint">since {when(person.createdAt)}</span>
				<fetcher.Form method="post">
					<input type="hidden" name="intent" value="accept" />
					<input type="hidden" name="userId" value={person.id} />
					<Button type="submit" size="sm" disabled={accepting}>
						{accepting ? 'Opening…' : 'Let in'}
					</Button>
				</fetcher.Form>
			</div>
		</li>
	);
}
