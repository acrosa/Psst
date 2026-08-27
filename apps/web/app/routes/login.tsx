import { Form, Link, redirect, useNavigation, useSearchParams } from 'react-router';
import { AuthCard } from '~/components/auth-card';
import { AuthDivider, SocialButtons } from '~/components/social-buttons';
import { Button } from '~/components/ui/button';
import { FormError } from '~/components/ui/field-error';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { auth, enabledProviders, getUser } from '~/lib/auth.server';
import { safeNext } from '~/lib/redirects';
import type { Route } from './+types/login';

export function meta() {
	return [{ title: 'Sign in — psst' }];
}

export async function loader({ request }: Route.LoaderArgs) {
	const user = await getUser(request);
	if (user) {
		throw redirect(safeNext(new URL(request.url).searchParams.get('next')));
	}
	return { providers: enabledProviders() };
}

export async function action({ request }: Route.ActionArgs) {
	const formData = await request.formData();
	const email = String(formData.get('email') ?? '').trim();
	const password = String(formData.get('password') ?? '');

	if (!email || !password) {
		return { error: 'Please enter your email and password.' };
	}

	try {
		const response = await auth.api.signInEmail({
			body: { email, password },
			asResponse: true,
			headers: request.headers,
		});

		if (!response.ok) {
			let message = 'Sign in failed. Check your email and password.';
			try {
				const body = await response.json();
				message = body?.message || body?.error || message;
			} catch {
				// keep the default message
			}
			return { error: message };
		}

		const next = safeNext(new URL(request.url).searchParams.get('next'));
		return new Response(null, {
			status: 302,
			headers: {
				Location: next,
				'Set-Cookie': response.headers.get('set-cookie') ?? '',
			},
		});
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Sign in failed';
		return { error: message };
	}
}

export default function Login({ loaderData, actionData }: Route.ComponentProps) {
	const navigation = useNavigation();
	const [searchParams] = useSearchParams();
	const isSubmitting = navigation.state === 'submitting';
	const next = searchParams.get('next');
	const registerTo = next ? `/register?next=${encodeURIComponent(next)}` : '/register';

	return (
		<AuthCard
			title="Welcome back"
			subtitle={
				<>
					New here?{' '}
					<Link to={registerTo} className="text-accent-deep underline underline-offset-2">
						Make your first canvas
					</Link>
				</>
			}
		>
			<div className="grid gap-4">
				<SocialButtons providers={loaderData.providers} next={safeNext(next)} />
				{loaderData.providers.google || loaderData.providers.apple ? <AuthDivider /> : null}
			</div>

			<Form method="post" className="mt-4 grid gap-4">
				<FormError error={actionData?.error} />

				<div className="grid gap-1.5">
					<Label htmlFor="email">Email</Label>
					<Input
						id="email"
						name="email"
						type="email"
						autoComplete="email"
						placeholder="you@example.com"
						required
					/>
				</div>

				<div className="grid gap-1.5">
					<Label htmlFor="password">Password</Label>
					<Input
						id="password"
						name="password"
						type="password"
						autoComplete="current-password"
						required
					/>
				</div>

				<Button type="submit" disabled={isSubmitting} className="w-full">
					{isSubmitting ? 'Signing in…' : 'Sign in'}
				</Button>
			</Form>
		</AuthCard>
	);
}
