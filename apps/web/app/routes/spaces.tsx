import { AppHeader } from '~/components/app-header';
import { requireUser } from '~/lib/auth.server';
import type { Route } from './+types/spaces';

export function meta() {
	return [{ title: 'Your spaces — psst' }];
}

export async function loader({ request }: Route.LoaderArgs) {
	const user = await requireUser(request);
	return { user: { name: user.name ?? null } };
}

export default function Spaces({ loaderData }: Route.ComponentProps) {
	return (
		<div className="min-h-svh">
			<AppHeader userName={loaderData.user.name} />
			<main className="mx-auto max-w-3xl p-6">
				<h1 className="font-hand text-3xl">Your spaces</h1>
				<p className="mt-2 text-ink-soft">Spaces will appear here.</p>
			</main>
		</div>
	);
}
