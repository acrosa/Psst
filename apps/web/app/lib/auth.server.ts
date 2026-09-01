import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { bearer } from 'better-auth/plugins';
import { eq } from 'drizzle-orm';
import { redirect } from 'react-router';
import { isAdminEmail } from './admin.server';
import { db, schema, useSqlite } from './db/client.server';
import { sendResetPasswordEmail } from './email.server';
import { env } from './env.server';

export const auth = betterAuth({
	// Bearer lets native clients (iOS) authenticate with the token from the
	// set-auth-token response header instead of cookies.
	plugins: [bearer()],

	database: drizzleAdapter(db, {
		provider: useSqlite ? 'sqlite' : 'pg',
		schema: {
			user: schema.users,
			session: schema.sessions,
			account: schema.accounts,
			verification: schema.verifications,
		},
	}),

	emailAndPassword: {
		enabled: true,
		requireEmailVerification: false,
		async sendResetPassword({ user, url }) {
			await sendResetPasswordEmail({ to: user.email, name: user.name ?? null, url });
		},
	},

	socialProviders: {
		...(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
			? {
					google: {
						clientId: env.GOOGLE_CLIENT_ID,
						clientSecret: env.GOOGLE_CLIENT_SECRET,
					},
				}
			: {}),
		...(env.APPLE_CLIENT_ID && env.APPLE_CLIENT_SECRET
			? {
					apple: {
						clientId: env.APPLE_CLIENT_ID,
						clientSecret: env.APPLE_CLIENT_SECRET,
						// Native Sign in with Apple: idTokens minted for the iOS app
						// carry the bundle id as audience.
						...(env.APPLE_APP_BUNDLE_IDENTIFIER
							? { appBundleIdentifier: env.APPLE_APP_BUNDLE_IDENTIFIER }
							: {}),
					},
				}
			: {}),
	},

	// Apple's OAuth flow posts back from appleid.apple.com; EXTRA_TRUSTED_ORIGINS
	// adds e.g. the tailnet address so other devices can sign in against dev.
	trustedOrigins: [
		'https://appleid.apple.com',
		...(env.EXTRA_TRUSTED_ORIGINS?.split(',')
			.map((origin) => origin.trim())
			.filter(Boolean) ?? []),
	],

	session: {
		expiresIn: 60 * 60 * 24 * 30, // 30 days — this is an ambient place, stay signed in
		updateAge: 60 * 60 * 24,
	},

	secret:
		env.BETTER_AUTH_SECRET ??
		(env.NODE_ENV === 'production' ? undefined : 'psst-dev-secret-change-me-32-characters!'),
	baseURL: env.BETTER_AUTH_URL,
	logger: { disabled: env.NODE_ENV === 'test' },
});

export type SessionUser = (typeof auth.$Infer.Session)['user'];

/** Current user, or null. Never throws. */
export async function getUser(request: Request): Promise<SessionUser | null> {
	try {
		const session = await auth.api.getSession({ headers: request.headers });
		return session?.user ?? null;
	} catch (error) {
		console.error('[auth] getSession failed:', error);
		return null;
	}
}

/** Current user, or a redirect to /login (preserving the destination). */
export async function requireUser(request: Request): Promise<SessionUser> {
	const user = await getUser(request);
	if (!user) {
		const url = new URL(request.url);
		throw redirect(`/login?next=${encodeURIComponent(url.pathname + url.search)}`);
	}
	// The velvet rope: signed up but not yet let in → the waitlist page.
	if (!isAdminEmail(user.email)) {
		const [row] = await db
			.select({ acceptedAt: schema.users.acceptedAt })
			.from(schema.users)
			.where(eq(schema.users.id, user.id));
		if (!row?.acceptedAt) {
			throw redirect('/waitlist');
		}
	}
	return user;
}

/** Which social providers are configured — drives the sign-in buttons. */
export function enabledProviders() {
	return {
		google: Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
		apple: Boolean(env.APPLE_CLIENT_ID && env.APPLE_CLIENT_SECRET),
	};
}
