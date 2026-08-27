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
	route('spaces/:spaceId/days', 'routes/space.days.tsx'),
	route('spaces/:spaceId/days/:date', 'routes/space.day.tsx'),
	route('spaces/:spaceId/settings', 'routes/space.settings.tsx'),
	route('invite/:token', 'routes/invite.tsx'),

	// API
	route('api/auth/*', 'routes/api.auth.$.ts'),
	route('api/avatar', 'routes/api.avatar.ts'),
	route('auth/continue', 'routes/auth.continue.ts'),
	route('health', 'routes/health.ts'),
	route('files/*', 'routes/files.$.ts'),

	// Dev/test-only OpenGraph fixture for exercising the unfurl pipeline locally
	route('e2e/og-fixture', 'routes/e2e.og-fixture.ts'),
	route('design', 'routes/design.tsx'),
] satisfies RouteConfig;
