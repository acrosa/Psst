import {
	index,
	integer,
	primaryKey,
	real,
	sqliteTable,
	text,
	unique,
} from 'drizzle-orm/sqlite-core';

/**
 * SQLite mirror of schema.ts — used when USE_SQLITE=true (the E2E suite).
 * Keep BOTH schemas in sync and regenerate both migration sets:
 *   pnpm db:generate && pnpm db:generate:sqlite
 * Conventions: uuid → text + randomUUID default, timestamp → integer(mode:
 * 'timestamp'), boolean → integer(mode: 'boolean').
 */

const uuidPk = () =>
	text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID());

const createdAt = () => integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date());

// ============================================================================
// Auth tables (Better Auth)
// ============================================================================

export const users = sqliteTable('users', {
	id: text('id').primaryKey(),
	email: text('email').notNull().unique(),
	name: text('name'),
	image: text('image'),
	emailVerified: integer('email_verified', { mode: 'boolean' }).default(false),
	createdAt: createdAt(),
	updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

export const sessions = sqliteTable('sessions', {
	id: text('id').primaryKey(),
	userId: text('user_id')
		.notNull()
		.references(() => users.id),
	token: text('token').notNull().unique(),
	expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
	ipAddress: text('ip_address'),
	userAgent: text('user_agent'),
	createdAt: createdAt(),
	updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

export const accounts = sqliteTable('accounts', {
	id: text('id').primaryKey(),
	userId: text('user_id')
		.notNull()
		.references(() => users.id),
	accountId: text('account_id').notNull(),
	providerId: text('provider_id').notNull(),
	accessToken: text('access_token'),
	refreshToken: text('refresh_token'),
	accessTokenExpiresAt: integer('access_token_expires_at', { mode: 'timestamp' }),
	refreshTokenExpiresAt: integer('refresh_token_expires_at', { mode: 'timestamp' }),
	scope: text('scope'),
	idToken: text('id_token'),
	password: text('password'),
	createdAt: createdAt(),
	updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

export const verifications = sqliteTable('verifications', {
	id: text('id').primaryKey(),
	identifier: text('identifier').notNull(),
	value: text('value').notNull(),
	expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
	createdAt: createdAt(),
	updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// ============================================================================
// psst: spaces & membership
// ============================================================================

export const spaces = sqliteTable('spaces', {
	id: uuidPk(),
	name: text('name').notNull(),
	emoji: text('emoji').notNull().default('🌷'),
	timezone: text('timezone').notNull().default('UTC'),
	createdBy: text('created_by')
		.notNull()
		.references(() => users.id),
	createdAt: createdAt().notNull(),
});

export const spaceMembers = sqliteTable(
	'space_members',
	{
		spaceId: text('space_id')
			.notNull()
			.references(() => spaces.id, { onDelete: 'cascade' }),
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		role: text('role', { enum: ['owner', 'member'] })
			.notNull()
			.default('member'),
		joinedAt: integer('joined_at', { mode: 'timestamp' })
			.$defaultFn(() => new Date())
			.notNull(),
	},
	(t) => [primaryKey({ columns: [t.spaceId, t.userId] })],
);

export const invites = sqliteTable(
	'invites',
	{
		id: uuidPk(),
		spaceId: text('space_id')
			.notNull()
			.references(() => spaces.id, { onDelete: 'cascade' }),
		token: text('token').notNull().unique(),
		email: text('email'),
		createdBy: text('created_by')
			.notNull()
			.references(() => users.id),
		expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
		acceptedBy: text('accepted_by').references(() => users.id),
		acceptedAt: integer('accepted_at', { mode: 'timestamp' }),
		createdAt: createdAt().notNull(),
	},
	(t) => [index('invites_space_idx').on(t.spaceId)],
);

// ============================================================================
// psst: canvases & items
// ============================================================================

export const canvases = sqliteTable(
	'canvases',
	{
		id: uuidPk(),
		spaceId: text('space_id')
			.notNull()
			.references(() => spaces.id, { onDelete: 'cascade' }),
		date: text('date').notNull(),
		createdAt: createdAt().notNull(),
	},
	(t) => [unique('canvases_space_date_unique').on(t.spaceId, t.date)],
);

export const pushDevices = sqliteTable('push_devices', {
	id: uuidPk(),
	userId: text('user_id')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' }),
	token: text('token').notNull().unique(),
	platform: text('platform').notNull().default('ios'),
	createdAt: createdAt().notNull(),
	updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

export const items = sqliteTable(
	'items',
	{
		id: uuidPk(),
		canvasId: text('canvas_id')
			.notNull()
			.references(() => canvases.id, { onDelete: 'cascade' }),
		spaceId: text('space_id')
			.notNull()
			.references(() => spaces.id, { onDelete: 'cascade' }),
		authorId: text('author_id')
			.notNull()
			.references(() => users.id),
		type: text('type', { enum: ['link', 'note', 'image', 'emoji', 'drawing', 'audio'] }).notNull(),
		url: text('url'),
		text: text('text'),
		x: real('x').notNull().default(0),
		y: real('y').notNull().default(0),
		z: integer('z').notNull().default(0),
		rotation: real('rotation').notNull().default(0),
		scale: real('scale').notNull().default(1),
		createdAt: createdAt().notNull(),
		deletedAt: integer('deleted_at', { mode: 'timestamp' }),
	},
	(t) => [index('items_canvas_idx').on(t.canvasId)],
);

export const itemUnfurls = sqliteTable('item_unfurls', {
	itemId: text('item_id')
		.primaryKey()
		.references(() => items.id, { onDelete: 'cascade' }),
	title: text('title'),
	description: text('description'),
	imageUrl: text('image_url'),
	faviconUrl: text('favicon_url'),
	siteName: text('site_name'),
	status: text('status', { enum: ['pending', 'ok', 'failed'] })
		.notNull()
		.default('pending'),
	fetchedAt: integer('fetched_at', { mode: 'timestamp' }),
});

export const itemComments = sqliteTable(
	'item_comments',
	{
		id: uuidPk(),
		itemId: text('item_id')
			.notNull()
			.references(() => items.id, { onDelete: 'cascade' }),
		authorId: text('author_id')
			.notNull()
			.references(() => users.id),
		text: text('text').notNull(),
		createdAt: createdAt().notNull(),
	},
	(t) => [index('item_comments_item_idx').on(t.itemId)],
);

export const itemReactions = sqliteTable(
	'item_reactions',
	{
		id: uuidPk(),
		itemId: text('item_id')
			.notNull()
			.references(() => items.id, { onDelete: 'cascade' }),
		userId: text('user_id')
			.notNull()
			.references(() => users.id),
		emoji: text('emoji').notNull(),
		createdAt: createdAt().notNull(),
	},
	(t) => [unique('item_reactions_unique').on(t.itemId, t.userId, t.emoji)],
);

export const itemAssets = sqliteTable(
	'item_assets',
	{
		id: uuidPk(),
		itemId: text('item_id')
			.notNull()
			.references(() => items.id, { onDelete: 'cascade' }),
		kind: text('kind', { enum: ['original', 'thumb'] }).notNull(),
		storageKey: text('storage_key').notNull(),
		width: integer('width'),
		height: integer('height'),
		blurhash: text('blurhash'),
		createdAt: createdAt().notNull(),
	},
	(t) => [index('item_assets_item_idx').on(t.itemId)],
);
