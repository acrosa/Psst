import { useState } from 'react';
import { Form, redirect, useNavigation } from 'react-router';
import { AppHeader } from '~/components/app-header';
import { EmojiPicker } from '~/components/emoji-picker';
import { SpaceCard } from '~/components/space-card';
import { TimezoneInput } from '~/components/timezone-input';
import { Button } from '~/components/ui/button';
import { Dialog } from '~/components/ui/dialog';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { requireUser } from '~/lib/auth.server';
import { createSpace, listSpacesForUser } from '~/lib/services/spaces.server';
import type { Route } from './+types/spaces';

export function meta() {
	return [{ title: 'Your spaces — psst' }];
}

export async function loader({ request }: Route.LoaderArgs) {
	const user = await requireUser(request);
	const spaces = await listSpacesForUser(user.id);
	if (spaces.length === 0) {
		throw redirect('/onboarding');
	}
	return { user: { name: user.name ?? null, image: user.image ?? null }, spaces };
}

export async function action({ request }: Route.ActionArgs) {
	const user = await requireUser(request);
	const formData = await request.formData();

	if (formData.get('intent') === 'create-space') {
		const name = String(formData.get('name') ?? '').trim();
		const emoji = String(formData.get('emoji') ?? '🌷');
		const timezone = String(formData.get('timezone') ?? 'UTC');
		if (!name) {
			return { error: 'Give it a name first.' };
		}
		const space = await createSpace({ userId: user.id, name, emoji, timezone });
		throw redirect(`/spaces/${space.id}`);
	}

	return null;
}

export default function Spaces({ loaderData, actionData }: Route.ComponentProps) {
	const [creating, setCreating] = useState(false);
	const navigation = useNavigation();

	return (
		<div className="min-h-svh">
			<AppHeader user={loaderData.user} />
			<main className="mx-auto max-w-3xl p-6">
				<div className="mb-6 flex items-center justify-between">
					<h1 className="font-serif text-3xl">Your spaces</h1>
					<Button variant="soft" onClick={() => setCreating(true)}>
						＋ New space
					</Button>
				</div>

				<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{loaderData.spaces.map((space) => (
						<SpaceCard key={space.id} space={space} />
					))}
				</div>

				<Dialog open={creating} onClose={() => setCreating(false)} title="A new space">
					<Form method="post" className="grid gap-4">
						<input type="hidden" name="intent" value="create-space" />
						{actionData?.error ? (
							<p className="text-sm text-accent-deep">{actionData.error}</p>
						) : null}

						<div className="grid gap-1.5">
							<Label htmlFor="new-space-name">Space name</Label>
							<Input
								id="new-space-name"
								name="name"
								placeholder="weekend plans"
								maxLength={60}
								required
							/>
						</div>

						<div className="grid gap-1.5">
							<Label>Pick a mood</Label>
							<EmojiPicker />
						</div>

						<TimezoneInput />

						<Button type="submit" disabled={navigation.state === 'submitting'}>
							{navigation.state === 'submitting' ? 'Creating…' : 'Create'}
						</Button>
					</Form>
				</Dialog>
			</main>
		</div>
	);
}
