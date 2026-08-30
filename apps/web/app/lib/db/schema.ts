import {
	boolean,
	index,
	integer,
	pgTable,
	primaryKey,
	real,
	text,
	timestamp,
	unique,
	uuid,
} from 'drizzle-orm/pg-core';

// ============================================================================
// Auth tables (Better Auth)
// ============================================================================

export const users = pgTable('users', {
	id: text('id').primaryKey(),
	email: text('email').notNull().unique(),
	name: text('name'),
	image: text('image'),
	emailVerified: boolean('email_verified').default(false),
	emailMentions: boolean('email_mentions').notNull().default(true),
	createdAt: timestamp('created_at').defaultNow(),
	updatedAt: timestamp('updated_at').defaultNow(),
});

export const sessions = pgTable('sessions', {
	id: text('id').primaryKey(),
	userId: text('user_id')
		.notNull()
		.references(() => users.id),
	token: text('token').notNull().unique(),
	expiresAt: timestamp('expires_at').notNull(),
	ipAddress: text('ip_address'),
	userAgent: text('user_agent'),
	createdAt: timestamp('created_at').defaultNow(),
	updatedAt: timestamp('updated_at').defaultNow(),
});

export const accounts = pgTable('accounts', {
	id: text('id').primaryKey(),
	userId: text('user_id')
		.notNull()
		.references(() => users.id),
	accountId: text('account_id').notNull(),
	providerId: text('provider_id').notNull(),
	accessToken: text('access_token'),
	refreshToken: text('refresh_token'),
	accessTokenExpiresAt: timestamp('access_token_expires_at'),
	refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
	scope: text('scope'),
	idToken: text('id_token'),
	password: text('password'),
	createdAt: timestamp('created_at').defaultNow(),
	updatedAt: timestamp('updated_at').defaultNow(),
});

export const verifications = pgTable('verifications', {
	id: text('id').primaryKey(),
	identifier: text('identifier').notNull(),
	value: text('value').notNull(),
	expiresAt: timestamp('expires_at').notNull(),
	createdAt: timestamp('created_at').defaultNow(),
	updatedAt: timestamp('updated_at').defaultNow(),
});

// ============================================================================
// psst: spaces & membership
// ============================================================================

export const spaces = pgTable('spaces', {
	id: uuid('id').primaryKey().defaultRandom(),
	name: text('name').notNull(),
	emoji: text('emoji').notNull().default('🌷'),
	timezone: text('timezone').notNull().default('UTC'),
	createdBy: text('created_by')
		.notNull()
		.references(() => users.id),
	createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const spaceMembers = pgTable(
	'space_members',
	{
		spaceId: uuid('space_id')
			.notNull()
			.references(() => spaces.id, { onDelete: 'cascade' }),
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		role: text('role', { enum: ['owner', 'member'] })
			.notNull()
			.default('member'),
		joinedAt: timestamp('joined_at').defaultNow().notNull(),
	},
	(t) => [primaryKey({ columns: [t.spaceId, t.userId] })],
);

export const invites = pgTable(
	'invites',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		spaceId: uuid('space_id')
			.notNull()
			.references(() => spaces.id, { onDelete: 'cascade' }),
		token: text('token').notNull().unique(),
		email: text('email'),
		createdBy: text('created_by')
			.notNull()
			.references(() => users.id),
		expiresAt: timestamp('expires_at').notNull(),
		acceptedBy: text('accepted_by').references(() => users.id),
		acceptedAt: timestamp('accepted_at'),
		createdAt: timestamp('created_at').defaultNow().notNull(),
	},
	(t) => [index('invites_space_idx').on(t.spaceId)],
);

// ============================================================================
// psst: canvases & items
// ============================================================================

export const canvases = pgTable(
	'canvases',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		spaceId: uuid('space_id')
			.notNull()
			.references(() => spaces.id, { onDelete: 'cascade' }),
		// Local date in the space's timezone, 'YYYY-MM-DD'. A canvas is archived
		// once its date is in the past — no rollover job needed.
		date: text('date').notNull(),
		createdAt: timestamp('created_at').defaultNow().notNull(),
	},
	(t) => [unique('canvases_space_date_unique').on(t.spaceId, t.date)],
);

export const pushDevices = pgTable('push_devices', {
	id: uuid('id').primaryKey().defaultRandom(),
	userId: text('user_id')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' }),
	token: text('token').notNull().unique(),
	platform: text('platform').notNull().default('ios'),
	createdAt: timestamp('created_at').defaultNow().notNull(),
	updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const items = pgTable(
	'items',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		canvasId: uuid('canvas_id')
			.notNull()
			.references(() => canvases.id, { onDelete: 'cascade' }),
		spaceId: uuid('space_id')
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
		createdAt: timestamp('created_at').defaultNow().notNull(),
		deletedAt: timestamp('deleted_at'),
	},
	(t) => [index('items_canvas_idx').on(t.canvasId)],
);

export const itemUnfurls = pgTable('item_unfurls', {
	itemId: uuid('item_id')
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
	fetchedAt: timestamp('fetched_at'),
});

export const itemComments = pgTable(
	'item_comments',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		itemId: uuid('item_id')
			.notNull()
			.references(() => items.id, { onDelete: 'cascade' }),
		authorId: text('author_id')
			.notNull()
			.references(() => users.id),
		text: text('text').notNull(),
		createdAt: timestamp('created_at').defaultNow().notNull(),
	},
	(t) => [index('item_comments_item_idx').on(t.itemId)],
);

export const itemReactions = pgTable(
	'item_reactions',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		itemId: uuid('item_id')
			.notNull()
			.references(() => items.id, { onDelete: 'cascade' }),
		userId: text('user_id')
			.notNull()
			.references(() => users.id),
		emoji: text('emoji').notNull(),
		createdAt: timestamp('created_at').defaultNow().notNull(),
	},
	(t) => [unique('item_reactions_unique').on(t.itemId, t.userId, t.emoji)],
);

export const itemAssets = pgTable(
	'item_assets',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		itemId: uuid('item_id')
			.notNull()
			.references(() => items.id, { onDelete: 'cascade' }),
		kind: text('kind', { enum: ['original', 'thumb'] }).notNull(),
		storageKey: text('storage_key').notNull(),
		width: integer('width'),
		height: integer('height'),
		blurhash: text('blurhash'),
		createdAt: timestamp('created_at').defaultNow().notNull(),
	},
	(t) => [index('item_assets_item_idx').on(t.itemId)],
);

// ============================================================================
// Types
// ============================================================================

export type User = typeof users.$inferSelect;
export type Space = typeof spaces.$inferSelect;
export type SpaceMember = typeof spaceMembers.$inferSelect;
export type Invite = typeof invites.$inferSelect;
export type Canvas = typeof canvases.$inferSelect;
export type Item = typeof items.$inferSelect;
export type ItemUnfurl = typeof itemUnfurls.$inferSelect;
export type ItemComment = typeof itemComments.$inferSelect;
export type ItemReaction = typeof itemReactions.$inferSelect;
export type ItemAsset = typeof itemAssets.$inferSelect;
export type ItemType = Item['type'];
