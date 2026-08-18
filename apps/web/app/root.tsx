import {
	Link,
	Links,
	Meta,
	Outlet,
	Scripts,
	ScrollRestoration,
	isRouteErrorResponse,
} from 'react-router';
import type { Route } from './+types/root';
import './app.css';

export const links: Route.LinksFunction = () => [
	{ rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' },
	{ rel: 'preconnect', href: 'https://fonts.googleapis.com' },
	{ rel: 'preconnect', href: 'https://fonts.gstatic.com', crossOrigin: 'anonymous' },
	{
		rel: 'stylesheet',
		href: 'https://fonts.googleapis.com/css2?family=Inter:opsz,wght@14..32,100..900&family=Caveat:wght@400..700&display=swap',
	},
];

export function Layout({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en">
			<head>
				<meta charSet="utf-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1" />
				<Meta />
				<Links />
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
	return <Outlet />;
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
			<h1 className="font-hand text-3xl">{title}</h1>
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
