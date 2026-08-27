import {
	Link,
	Links,
	Meta,
	Outlet,
	Scripts,
	ScrollRestoration,
	isRouteErrorResponse,
	useNavigation,
	useRouteLoaderData,
} from 'react-router';
import { env } from '~/lib/env.server';
import type { Route } from './+types/root';
import './app.css';

export const links: Route.LinksFunction = () => [
	{ rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' },
];

export async function loader() {
	// Web fonts are progressive enhancement — skipped in tests so an unreachable
	// fonts CDN can never block the document load event.
	return { withFonts: env.NODE_ENV !== 'test' };
}

export function Layout({ children }: { children: React.ReactNode }) {
	const data = useRouteLoaderData<typeof loader>('root');
	const withFonts = data?.withFonts ?? true;

	return (
		<html lang="en" suppressHydrationWarning>
			<head>
				<meta charSet="utf-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1" />
				{/* Theme follows the device, nothing to configure: set .dark before
				    first paint and track prefers-color-scheme live. */}
				<script
					// biome-ignore lint/security/noDangerouslySetInnerHtml: static theme bootstrap, no user input
					dangerouslySetInnerHTML={{
						__html: `(function(){try{var media=matchMedia('(prefers-color-scheme: dark)');var apply=function(){document.documentElement.classList.toggle('dark',media.matches)};apply();media.addEventListener('change',apply)}catch(e){}})()`,
					}}
				/>
				<Meta />
				<Links />
				{withFonts ? (
					<>
						<link rel="preconnect" href="https://fonts.googleapis.com" />
						<link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
						<link
							rel="stylesheet"
							href="https://fonts.googleapis.com/css2?family=Geist:wght@100..900&family=Newsreader:ital,opsz,wght@0,6..72,400..600;1,6..72,400..600&display=swap"
						/>
					</>
				) : null}
			</head>
			<body>
				{children}
				<ScrollRestoration />
				<Scripts />
			</body>
		</html>
	);
}

export default function App() {
	const navigation = useNavigation();
	return (
		<>
			{navigation.state !== 'idle' ? <div className="nav-progress" aria-hidden /> : null}
			<Outlet />
		</>
	);
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
	let title = 'psst… something went sideways';
	let detail = 'An unexpected error occurred.';

	if (isRouteErrorResponse(error)) {
		title = error.status === 404 ? 'psst… that page wandered off' : `Error ${error.status}`;
		detail =
			error.status === 404
				? 'Nothing lives at this address. Maybe it was archived with yesterday.'
				: error.statusText || detail;
	} else if (import.meta.env.DEV && error instanceof Error) {
		detail = error.message;
	}

	return (
		<main className="flex min-h-svh flex-col items-center justify-center gap-4 p-8 text-center">
			<div className="text-5xl">🫥</div>
			<h1 className="font-serif text-3xl">{title}</h1>
			<p className="max-w-sm text-ink-soft">{detail}</p>
			<Link
				to="/"
				className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white shadow-card transition hover:bg-accent-deep"
			>
				Take me home
			</Link>
		</main>
	);
}
