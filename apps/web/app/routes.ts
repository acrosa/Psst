import { type RouteConfig, index, route } from '@react-router/dev/routes';

export default [
	// Public
	index('routes/home.tsx'),
	route('login', 'routes/login.tsx'),
	route('register', 'routes/register.tsx'),
	route('logout', 'routes/logout.tsx'),

	// App
	route('spaces', 'routes/spaces.tsx'),

	// API
	route('api/auth/*', 'routes/api.auth.$.ts'),
	route('health', 'routes/health.ts'),
] satisfies RouteConfig;
