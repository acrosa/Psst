import { Form, redirect, useNavigation } from 'react-router';
import { AppHeader } from '~/components/app-header';
import { EmojiPicker } from '~/components/emoji-picker';
import { TimezoneInput } from '~/components/timezone-input';
import { Button } from '~/components/ui/button';
import { FormError } from '~/components/ui/field-error';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { requireUser } from '~/lib/auth.server';
import { createSpace, listSpacesForUser } from '~/lib/services/spaces.server';
import type { Route } from './+types/onboarding';

export function meta() {
	return [{ title: 'Name your canvas — psst' }];
}

export async function loader({ request }: Route.LoaderArgs) {
	const user = await requireUser(request);
	const spaces = await listSpacesForUser(user.id);
	if (spaces.length > 0) {
		throw redirect('/spaces');
	}
	return { user: { name: user.name ?? null } };
}

export async function action({ request }: Route.ActionArgs) {
	const user = await requireUser(request);
	const formData = await request.formData();
	const name = String(formData.get('name') ?? '').trim();
	const emoji = String(formData.get('emoji') ?? '🌷');
	const timezone = String(formData.get('timezone') ?? 'UTC');

	if (!name) {
		return { error: 'Give your canvas a name — anything cozy works.' };
	}

	const space = await createSpace({ userId: user.id, name, emoji, timezone });
	throw redirect(`/spaces/${space.id}`);
}

export default function Onboarding({ loaderData, actionData }: Route.ComponentProps) {
	const navigation = useNavigation();
	const isSubmitting = navigation.state === 'submitting';

	return (
		<div className="min-h-svh">
			<AppHeader user={loaderData.user} />
			<main className="mx-auto flex max-w-md flex-col gap-6 p-6 pt-10">
				<div className="animate-pop-in text-center">
					<div className="text-5xl">🎨</div>
					<h1 className="mt-3 font-serif text-3xl">Name your first canvas</h1>
					<p className="mt-2 text-sm text-ink-soft">
						This is the board you'll share — a little corner for links, notes, photos and stickers.
						You can invite someone the moment it exists.
					</p>
				</div>

				<Form
					method="post"
					className="grid gap-5 rounded-xl border border-line bg-card p-6 shadow-card"
				>
					<FormError error={actionData?.error} />

					<div className="grid gap-1.5">
						<Label htmlFor="space-name">Space name</Label>
						<Input
							id="space-name"
							name="name"
							placeholder="our little corner"
							maxLength={60}
							required
						/>
					</div>

					<div className="grid gap-1.5">
						<Label>Pick a mood</Label>
						<EmojiPicker />
					</div>

					<TimezoneInput />

					<Button type="submit" disabled={isSubmitting}>
						{isSubmitting ? 'Opening…' : 'Open the canvas →'}
					</Button>
				</Form>
			</main>
		</div>
	);
}
