import { Button } from '~/components/ui/button';
import { authClient } from '~/lib/auth.client';

export type Providers = { google: boolean; apple: boolean };

/**
 * The front door: one tap with an account people already have. Rendered
 * above the email form — social sign-in is the primary path.
 */
export function SocialButtons({ providers, next }: { providers: Providers; next: string }) {
	if (!providers.google && !providers.apple) return null;

	return (
		<div className="grid gap-2">
			{providers.google ? (
				<Button
					type="button"
					variant="soft"
					className="w-full"
					onClick={() => {
						void authClient.signIn.social({ provider: 'google', callbackURL: next });
					}}
				>
					<GoogleMark />
					Continue with Google
				</Button>
			) : null}
			{providers.apple ? (
				<Button
					type="button"
					variant="soft"
					className="w-full"
					onClick={() => {
						void authClient.signIn.social({ provider: 'apple', callbackURL: next });
					}}
				>
					<AppleMark />
					Continue with Apple
				</Button>
			) : null}
		</div>
	);
}

/** Quiet "or with email" seam between social and the email form. */
export function AuthDivider() {
	return (
		<div className="flex items-center gap-3 text-ink-faint text-xs">
			<span className="h-px flex-1 bg-line" />
			or with email
			<span className="h-px flex-1 bg-line" />
		</div>
	);
}

function GoogleMark() {
	return (
		<svg viewBox="0 0 24 24" className="mr-2 h-4 w-4" aria-hidden>
			<path
				fill="#4285F4"
				d="M23.5 12.27c0-.85-.08-1.66-.22-2.45H12v4.64h6.45a5.52 5.52 0 0 1-2.4 3.62v3h3.87c2.27-2.09 3.58-5.17 3.58-8.81z"
			/>
			<path
				fill="#34A853"
				d="M12 24c3.24 0 5.96-1.07 7.94-2.91l-3.87-3c-1.08.72-2.45 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.29v3.1A12 12 0 0 0 12 24z"
			/>
			<path
				fill="#FBBC05"
				d="M5.27 14.28A7.2 7.2 0 0 1 4.9 12c0-.79.14-1.56.37-2.28v-3.1H1.29a12 12 0 0 0 0 10.76l3.98-3.1z"
			/>
			<path
				fill="#EA4335"
				d="M12 4.77c1.76 0 3.34.6 4.59 1.79l3.44-3.44A11.97 11.97 0 0 0 12 0 12 12 0 0 0 1.29 6.62l3.98 3.1C6.22 6.88 8.87 4.77 12 4.77z"
			/>
		</svg>
	);
}

function AppleMark() {
	return (
		<svg viewBox="0 0 24 24" className="mr-2 h-4 w-4 fill-current" aria-hidden>
			<path d="M16.36 12.79c.03 3.02 2.65 4.02 2.68 4.04-.02.07-.42 1.43-1.38 2.84-.83 1.22-1.7 2.43-3.06 2.45-1.34.03-1.77-.79-3.3-.79-1.53 0-2 .77-3.27.82-1.31.05-2.31-1.32-3.15-2.53C3.16 17.14 1.85 12.6 3.61 9.5a4.9 4.9 0 0 1 4.14-2.51c1.29-.02 2.5.87 3.3.87.79 0 2.27-1.08 3.82-.92.65.03 2.48.26 3.65 1.98-.09.06-2.18 1.28-2.16 3.87zM13.86 5.31c.7-.84 1.16-2.01 1.03-3.18-1 .04-2.21.67-2.93 1.51-.64.74-1.2 1.93-1.05 3.07 1.12.09 2.26-.57 2.95-1.4z" />
		</svg>
	);
}
