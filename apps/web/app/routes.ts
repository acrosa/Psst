import { type RouteConfig, index, route } from '@react-router/dev/routes';

export default [
	// Public
	index('routes/home.tsx'),
	route('login', 'routes/login.tsx'),
	route('register', 'routes/register.tsx'),
	route('logout', 'routes/logout.tsx'),

	// App
	route('onboarding', 'routes/onboarding.tsx'),
	route('spaces', 'routes/spaces.tsx'),
	route('spaces/:spaceId', 'routes/space.tsx'),
	route('spaces/:spaceId/settings', 'routes/space.settings.tsx'),
	route('invite/:token', 'routes/invite.tsx'),

	// API
	route('api/auth/*', 'routes/api.auth.$.ts'),
	route('health', 'routes/health.ts'),
	route('files/*', 'routes/files.$.ts'),

	// Dev/test-only OpenGraph fixture for exercising the unfurl pipeline locally
	route('e2e/og-fixture', 'routes/e2e.og-fixture.ts'),
] satisfies RouteConfig;
