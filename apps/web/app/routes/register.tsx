import { Form, Link, redirect, useNavigation, useSearchParams } from 'react-router';
import { AuthCard } from '~/components/auth-card';
import { GoogleButton } from '~/components/google-button';
import { TimezoneInput } from '~/components/timezone-input';
import { Button } from '~/components/ui/button';
import { FormError } from '~/components/ui/field-error';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { auth, getUser, isGoogleEnabled } from '~/lib/auth.server';
import { track } from '~/lib/metrics.server';
import { safeNext } from '~/lib/redirects';
import { createSpace } from '~/lib/services/spaces.server';
import type { Route } from './+types/register';

export function meta() {
	return [{ title: 'Join psst' }];
}

export async function loader({ request }: Route.LoaderArgs) {
	const user = await getUser(request);
	if (user) {
		throw redirect(safeNext(new URL(request.url).searchParams.get('next')));
	}
	return { googleEnabled: isGoogleEnabled() };
}

export async function action({ request }: Route.ActionArgs) {
	const formData = await request.formData();
	const name = String(formData.get('name') ?? '').trim();
	const email = String(formData.get('email') ?? '').trim();
	const password = String(formData.get('password') ?? '');

	if (!name || !email || !password) {
		return { error: 'Please fill in your name, email and password.' };
	}

	try {
		const response = await auth.api.signUpEmail({
			body: { name, email, password },
			asResponse: true,
			headers: request.headers,
		});

		if (!response.ok) {
			let message = 'Registration failed. Please try again.';
			try {
				const body = await response.json();
				message = body?.message || body?.error || message;
			} catch {
				// keep the default message
			}
			return { error: message };
		}

		let userId: string | undefined;
		try {
			const body = await response.clone().json();
			userId = body?.user?.id;
			track({ event: 'signup', icon: '🌱', userId, description: email });
		} catch {
			// metrics are best-effort
		}

		const next = safeNext(new URL(request.url).searchParams.get('next'));
		let location = next;

		// Zero-friction first canvas: unless this signup is on its way somewhere
		// (an invite), create a starter space and land straight on its board.
		// It can be renamed any time in settings.
		if (next === '/spaces' && userId) {
			const firstName = name.split(/\s+/)[0] ?? '';
			const space = await createSpace({
				userId,
				name: firstName ? `${firstName}'s corner` : 'our little corner',
				emoji: '🌷',
				timezone: String(formData.get('timezone') ?? 'UTC'),
			});
			location = `/spaces/${space.id}`;
		}

		return new Response(null, {
			status: 302,
			headers: {
				Location: location,
				'Set-Cookie': response.headers.get('set-cookie') ?? '',
			},
		});
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Registration failed';
		return { error: message };
	}
}

export default function Register({ loaderData, actionData }: Route.ComponentProps) {
	const navigation = useNavigation();
	const [searchParams] = useSearchParams();
	const isSubmitting = navigation.state === 'submitting';
	const next = searchParams.get('next');
	const loginTo = next ? `/login?next=${encodeURIComponent(next)}` : '/login';

	return (
		<AuthCard
			title="Make your first canvas"
			subtitle={
				<>
					Already have one?{' '}
					<Link to={loginTo} className="text-accent-deep underline underline-offset-2">
						Sign in
					</Link>
				</>
			}
		>
			<Form method="post" className="grid gap-4">
				<FormError error={actionData?.error} />
				<TimezoneInput />

				<div className="grid gap-1.5">
					<Label htmlFor="name">Name</Label>
					<Input id="name" name="name" autoComplete="name" placeholder="Sam" required />
				</div>

				<div className="grid gap-1.5">
					<Label htmlFor="email">Email</Label>
					<Input
						id="email"
						name="email"
						type="email"
						autoComplete="email"
						placeholder="you@example.com"
						defaultValue={searchParams.get('email') ?? ''}
						required
					/>
				</div>

				<div className="grid gap-1.5">
					<Label htmlFor="password">Password</Label>
					<Input
						id="password"
						name="password"
						type="password"
						autoComplete="new-password"
						placeholder="8+ characters"
						minLength={8}
						required
					/>
				</div>

				<Button type="submit" disabled={isSubmitting} className="w-full">
					{isSubmitting ? 'Creating…' : 'Create account'}
				</Button>

				{loaderData.googleEnabled ? <GoogleButton next={safeNext(next)} /> : null}
			</Form>
		</AuthCard>
	);
}
