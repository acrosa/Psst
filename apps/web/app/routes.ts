import { type RouteConfig, index, route } from '@react-router/dev/routes';

export default [
	// Public
	index('routes/home.tsx'),
	route('home2', 'routes/home2.tsx'),
	route('login', 'routes/login.tsx'),
	route('register', 'routes/register.tsx'),
	route('logout', 'routes/logout.tsx'),
	route('forgot-password', 'routes/forgot-password.tsx'),
	route('reset-password', 'routes/reset-password.tsx'),
	route('waitlist', 'routes/waitlist.tsx'),
	route('admin', 'routes/admin.tsx'),
	route('privacy', 'routes/privacy.tsx'),
	route('terms', 'routes/terms.tsx'),

	// App
	route('onboarding', 'routes/onboarding.tsx'),
	route('spaces', 'routes/spaces.tsx'),
	route('spaces/:spaceId', 'routes/space.tsx'),
	route('spaces/:spaceId/days', 'routes/space.days.tsx'),
	route('spaces/:spaceId/days/:date', 'routes/space.day.tsx'),
	route('spaces/:spaceId/settings', 'routes/space.settings.tsx'),
	route('invite/:token', 'routes/invite.tsx'),
	route('b/:token', 'routes/board.public.tsx'),

	// API
	route('api/auth/*', 'routes/api.auth.$.ts'),
	route('api/profile', 'routes/api.profile.ts'),
	route('api/devices', 'routes/api.devices.ts'),
	route('api/board', 'routes/api.board.ts'),
	route('api/spaces', 'routes/api.spaces.ts'),

	// API v1 — the native board's JSON surface (thin wrappers over services)
	route('api/v1/me', 'routes/api.v1.me.ts'),
	route('api/v1/spaces', 'routes/api.v1.spaces.ts'),
	route('api/v1/spaces/:spaceId', 'routes/api.v1.space.ts'),
	route('api/v1/spaces/:spaceId/board', 'routes/api.v1.space.board.ts'),
	route('api/v1/spaces/:spaceId/items', 'routes/api.v1.space.items.ts'),
	route('api/v1/spaces/:spaceId/days', 'routes/api.v1.space.days.ts'),
	route('api/v1/spaces/:spaceId/days/:date', 'routes/api.v1.space.day.ts'),
	route('api/v1/spaces/:spaceId/share', 'routes/api.v1.space.share.ts'),
	route('api/v1/spaces/:spaceId/invites', 'routes/api.v1.space.invites.ts'),
	route('api/v1/spaces/:spaceId/invites/:inviteId', 'routes/api.v1.space.invite.ts'),
	route('api/v1/spaces/:spaceId/members/me', 'routes/api.v1.space.membership.ts'),
	route('api/v1/items/:itemId', 'routes/api.v1.item.ts'),
	route('api/v1/items/:itemId/comments', 'routes/api.v1.item.comments.ts'),
	route('api/v1/items/:itemId/reactions', 'routes/api.v1.item.reactions.ts'),
	route('api/v1/invites/:token/accept', 'routes/api.v1.invite.accept.ts'),
	route('auth/continue', 'routes/auth.continue.ts'),
	route('health', 'routes/health.ts'),
	route('.well-known/apple-app-site-association', 'routes/aasa.ts'),
	route('files/*', 'routes/files.$.ts'),

	// Dev/test-only OpenGraph fixture for exercising the unfurl pipeline locally
	route('e2e/og-fixture', 'routes/e2e.og-fixture.ts'),
	route('design', 'routes/design.tsx'),
] satisfies RouteConfig;
