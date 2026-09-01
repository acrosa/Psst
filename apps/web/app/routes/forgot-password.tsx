import { Form, Link, useNavigation } from 'react-router';
import { AuthCard } from '~/components/auth-card';
import { Button } from '~/components/ui/button';
import { FormError } from '~/components/ui/field-error';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { auth } from '~/lib/auth.server';
import { appUrl } from '~/lib/env.server';
import type { Route } from './+types/forgot-password';

export function meta() {
	return [{ title: 'Forgot your password — psst' }];
}

export async function action({ request }: Route.ActionArgs) {
	const formData = await request.formData();
	const email = String(formData.get('email') ?? '').trim();
	if (!email || !email.includes('@')) {
		return { error: 'That email looks off — try again?' };
	}

	try {
		await auth.api.requestPasswordReset({
			body: { email, redirectTo: new URL('/reset-password', appUrl).toString() },
			headers: request.headers,
		});
	} catch (error) {
		// Never reveal whether an address has an account — always the same reply.
		console.error('[auth] password reset request failed:', error);
	}

	return { sent: true };
}

export default function ForgotPassword({ actionData }: Route.ComponentProps) {
	const navigation = useNavigation();
	const isSubmitting = navigation.state === 'submitting';

	if (actionData?.sent) {
		return (
			<AuthCard
				title="Check your email"
				subtitle="If that address has an account, a link to choose a new password is on its way. It works once, within the hour."
			>
				<Link to="/login" className="text-accent-deep text-sm underline underline-offset-2">
					Back to sign in
				</Link>
			</AuthCard>
		);
	}

	return (
		<AuthCard
			title="Forgot your password?"
			subtitle="Tell us your email and we'll send a way back in."
		>
			<Form method="post" className="grid gap-4">
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

				<Button type="submit" disabled={isSubmitting} className="w-full">
					{isSubmitting ? 'Sending…' : 'Send the link'}
				</Button>

				<Link
					to="/login"
					className="text-center text-ink-faint text-sm underline underline-offset-2"
				>
					Back to sign in
				</Link>
			</Form>
		</AuthCard>
	);
}
