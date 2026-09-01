import { Form, Link, redirect, useNavigation, useSearchParams } from 'react-router';
import { AuthCard } from '~/components/auth-card';
import { Button } from '~/components/ui/button';
import { FormError } from '~/components/ui/field-error';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { auth } from '~/lib/auth.server';
import type { Route } from './+types/reset-password';

export function meta() {
	return [{ title: 'Choose a new password — psst' }];
}

export async function action({ request }: Route.ActionArgs) {
	const formData = await request.formData();
	const token = String(formData.get('token') ?? '');
	const password = String(formData.get('password') ?? '');

	if (!token) {
		return { error: 'That link has expired — ask for a new one.' };
	}
	if (password.length < 8) {
		return { error: 'Passwords need at least 8 characters.' };
	}

	try {
		await auth.api.resetPassword({
			body: { newPassword: password, token },
			headers: request.headers,
		});
	} catch (error) {
		console.error('[auth] password reset failed:', error);
		return { error: 'That link has expired or was already used — ask for a new one.' };
	}

	throw redirect('/login?reset=1');
}

export default function ResetPassword({ actionData }: Route.ComponentProps) {
	const navigation = useNavigation();
	const [searchParams] = useSearchParams();
	const isSubmitting = navigation.state === 'submitting';
	// better-auth sends people here with ?token=…; an error lands as ?error=…
	const token = searchParams.get('token') ?? '';

	if (!token) {
		return (
			<AuthCard title="That link is spent" subtitle="Reset links work once, within the hour.">
				<Link
					to="/forgot-password"
					className="text-accent-deep text-sm underline underline-offset-2"
				>
					Send me a new one
				</Link>
			</AuthCard>
		);
	}

	return (
		<AuthCard title="Choose a new password" subtitle="Something only you would whisper.">
			<Form method="post" className="grid gap-4">
				<FormError error={actionData?.error} />
				<input type="hidden" name="token" value={token} />

				<div className="grid gap-1.5">
					<Label htmlFor="password">New password</Label>
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
					{isSubmitting ? 'Saving…' : 'Save it'}
				</Button>
			</Form>
		</AuthCard>
	);
}
