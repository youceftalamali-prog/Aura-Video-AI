import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  boolean,
  integer,
  bigint,
  jsonb,
  numeric,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { isNull } from 'drizzle-orm';

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: varchar('email', { length: 255 }).notNull(),
    passwordHash: text('password_hash'),
    fullName: varchar('full_name', { length: 100 }).notNull(),
    preferredLanguage: varchar('preferred_language', { length: 10 }).notNull().default('en'),
    avatarUrl: text('avatar_url'),
    role: varchar('role', { length: 20 }).notNull().default('user'),
    status: varchar('status', { length: 20 }).notNull().default('active'),
    emailVerifiedAt: timestamp('email_verified_at', { withTimezone: true }),
    googleId: varchar('google_id', { length: 255 }),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    emailIdx: uniqueIndex('users_email_idx').on(table.email),
    googleIdIdx: uniqueIndex('users_google_id_idx').on(table.googleId),
  }),
);

export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    refreshTokenHash: text('refresh_token_hash').notNull(),
    userAgent: text('user_agent'),
    ipAddress: varchar('ip_address', { length: 45 }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
  },
  (table) => ({
    userIdIdx: index('sessions_user_id_idx').on(table.userId),
    expiresAtIdx: index('sessions_expires_at_idx').on(table.expiresAt),
  }),
);

export const workspaces = pgTable(
  'workspaces',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 100 }).notNull(),
    slug: varchar('slug', { length: 50 }).notNull(),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    logoUrl: text('logo_url'),
    isPersonal: boolean('is_personal').notNull().default(true),
    stripeCustomerId: varchar('stripe_customer_id', { length: 255 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    slugIdx: uniqueIndex('workspaces_slug_idx').on(table.slug),
    ownerIdIdx: index('workspaces_owner_id_idx').on(table.ownerId),
  }),
);

export const settings = pgTable('settings', {
  id: uuid('id').primaryKey().defaultRandom(),
  key: varchar('key', { length: 100 }).notNull().unique(),
  value: jsonb('value').notNull(),
  description: text('description'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const templates = pgTable(
  'templates',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 200 }).notNull(),
    slug: varchar('slug', { length: 200 }),
    description: text('description'),
    category: varchar('category', { length: 50 }).notNull().default('product'),
    subCategory: varchar('sub_category', { length: 80 }),
    thumbnailUrl: text('thumbnail_url'),
    previewVideoUrl: text('preview_video_url'),
    durationSeconds: integer('duration_seconds'),
    resolution: varchar('resolution', { length: 20 }).notNull().default('1080p'),
    aspectRatio: varchar('aspect_ratio', { length: 20 }).notNull().default('9:16'),
    creditsCost: integer('credits_cost').notNull().default(10),
    status: varchar('status', { length: 20 }).notNull().default('published'),
    isPremium: boolean('is_premium').notNull().default(false),
    isFeatured: boolean('is_featured').notNull().default(false),
    sortOrder: integer('sort_order').notNull().default(0),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    statusIdx: index('templates_status_idx').on(table.status),
    categoryIdx: index('templates_category_idx').on(table.category),
    slugIdx: uniqueIndex('templates_slug_idx').on(table.slug),
  }),
);

export const assets = pgTable(
  'assets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    type: varchar('type', { length: 20 }).notNull(),
    mimeType: varchar('mime_type', { length: 100 }).notNull(),
    sizeBytes: bigint('size_bytes', { mode: 'number' }).notNull(),
    storageKey: text('storage_key').notNull(),
    url: text('url').notNull(),
    thumbnailUrl: text('thumbnail_url'),
    status: varchar('status', { length: 20 }).notNull().default('ready'),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    workspaceIdIdx: index('assets_workspace_id_idx').on(table.workspaceId),
    userIdIdx: index('assets_user_id_idx').on(table.userId),
  }),
);

export const products = pgTable(
  'products',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 200 }).notNull(),
    description: text('description'),
    imageUrl: text('image_url'),
    imageAssetId: uuid('image_asset_id').references(() => assets.id, { onDelete: 'set null' }),
    price: numeric('price', { precision: 12, scale: 2 }),
    currency: varchar('currency', { length: 3 }),
    externalId: varchar('external_id', { length: 255 }),
    externalSource: varchar('external_source', { length: 100 }),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    workspaceIdIdx: index('products_workspace_id_idx').on(table.workspaceId),
  }),
);

export const projects = pgTable(
  'projects',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 200 }).notNull(),
    description: text('description'),
    status: varchar('status', { length: 20 }).notNull().default('draft'),
    templateId: uuid('template_id').references(() => templates.id, { onDelete: 'set null' }),
    productId: uuid('product_id').references(() => products.id, { onDelete: 'set null' }),
    thumbnailUrl: text('thumbnail_url'),
    videoUrl: text('video_url'),
    durationSeconds: integer('duration_seconds'),
    resolution: varchar('resolution', { length: 20 }),
    creditsUsed: integer('credits_used').notNull().default(0),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    workspaceIdIdx: index('projects_workspace_id_idx').on(table.workspaceId),
    userIdIdx: index('projects_user_id_idx').on(table.userId),
    statusIdx: index('projects_status_idx').on(table.status),
  }),
);

export const subscriptions = pgTable(
  'subscriptions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    planId: uuid('plan_id').notNull(),
    status: varchar('status', { length: 20 }).notNull().default('active'),
    interval: varchar('interval', { length: 10 }).notNull().default('month'),
    currentPeriodStart: timestamp('current_period_start', { withTimezone: true }).notNull(),
    currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }).notNull(),
    periodCreditsGranted: boolean('period_credits_granted').notNull().default(false),
    cancelAtPeriodEnd: boolean('cancel_at_period_end').notNull().default(false),
    canceledAt: timestamp('canceled_at', { withTimezone: true }),
    trialEndsAt: timestamp('trial_ends_at', { withTimezone: true }),
    externalId: varchar('external_id', { length: 255 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    userIdIdx: index('subscriptions_user_id_idx').on(table.userId),
    workspaceIdIdx: index('subscriptions_workspace_id_idx').on(table.workspaceId),
    statusIdx: index('subscriptions_status_idx').on(table.status),
  }),
);

export const creditWallets = pgTable(
  'credit_wallets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' })
      .unique(),
    balance: integer('balance').notNull().default(0),
    lifetimeGranted: integer('lifetime_granted').notNull().default(0),
    lifetimeUsed: integer('lifetime_used').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    workspaceIdIdx: uniqueIndex('credit_wallets_workspace_id_idx').on(table.workspaceId),
  }),
);


export const videoGenerationJobs = pgTable(
  'video_generation_jobs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    provider: varchar('provider', { length: 40 }).notNull().default('none'),
    providerJobId: varchar('provider_job_id', { length: 255 }),
    status: varchar('status', { length: 20 }).notNull().default('queued'),
    progress: integer('progress'),
    currentStage: varchar('current_stage', { length: 40 }),
    prompt: text('prompt'),
    input: jsonb('input').notNull(),
    outputUrl: text('output_url'),
    assetId: uuid('asset_id').references(() => assets.id, { onDelete: 'set null' }),
    error: text('error'),
    creditsCharged: integer('credits_charged').notNull().default(0),
    idempotencyKey: varchar('idempotency_key', { length: 128 }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    workspaceIdIdx: index('video_jobs_workspace_id_idx').on(table.workspaceId),
    projectIdIdx: index('video_jobs_project_id_idx').on(table.projectId),
    userIdIdx: index('video_jobs_user_id_idx').on(table.userId),
    statusIdx: index('video_jobs_status_idx').on(table.status),
    providerJobIdx: index('video_jobs_provider_job_id_idx').on(table.providerJobId),
    idempotencyIdx: uniqueIndex('video_jobs_idempotency_idx').on(table.workspaceId, table.idempotencyKey),
  }),
);

export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  workspaces: many(workspaces),
  projects: many(projects),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

export const workspacesRelations = relations(workspaces, ({ one, many }) => ({
  owner: one(users, { fields: [workspaces.ownerId], references: [users.id] }),
  projects: many(projects),
  assets: many(assets),
  products: many(products),
  creditWallet: one(creditWallets),
}));

export const projectsRelations = relations(projects, ({ one }) => ({
  workspace: one(workspaces, { fields: [projects.workspaceId], references: [workspaces.id] }),
  user: one(users, { fields: [projects.userId], references: [users.id] }),
  template: one(templates, { fields: [projects.templateId], references: [templates.id] }),
  product: one(products, { fields: [projects.productId], references: [products.id] }),
}));

export const assetsRelations = relations(assets, ({ one }) => ({
  workspace: one(workspaces, { fields: [assets.workspaceId], references: [workspaces.id] }),
  user: one(users, { fields: [assets.userId], references: [users.id] }),
}));

export const productsRelations = relations(products, ({ one }) => ({
  workspace: one(workspaces, { fields: [products.workspaceId], references: [workspaces.id] }),
  user: one(users, { fields: [products.userId], references: [users.id] }),
  imageAsset: one(assets, { fields: [products.imageAssetId], references: [assets.id] }),
}));


export const paypalWebhookEvents = pgTable(
  'paypal_webhook_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    paypalEventId: varchar('paypal_event_id', { length: 255 }).notNull().unique(),
    eventType: varchar('event_type', { length: 120 }).notNull(),
    processedAt: timestamp('processed_at', { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    eventIdIdx: uniqueIndex('paypal_webhook_events_event_id_idx').on(table.paypalEventId),
  }),
);

export const stripeWebhookEvents = pgTable(
  'stripe_webhook_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    stripeEventId: varchar('stripe_event_id', { length: 255 }).notNull().unique(),
    eventType: varchar('event_type', { length: 100 }).notNull(),
    processedAt: timestamp('processed_at', { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    eventIdIdx: uniqueIndex('stripe_webhook_events_event_id_idx').on(table.stripeEventId),
  }),
);

export const creditWalletsRelations = relations(creditWallets, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [creditWallets.workspaceId],
    references: [workspaces.id],
  }),
}));


export const socialConnections = pgTable(
  'social_connections',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    platform: varchar('platform', { length: 40 }).notNull(),
    platformAccountId: varchar('platform_account_id', { length: 255 }).notNull(),
    accountName: varchar('account_name', { length: 200 }).notNull(),
    accountAvatarUrl: text('account_avatar_url'),
    encryptedAccessToken: text('encrypted_access_token').notNull(),
    encryptedRefreshToken: text('encrypted_refresh_token'),
    tokenExpiresAt: timestamp('token_expires_at', { withTimezone: true }),
    scopes: jsonb('scopes').notNull().default([]),
    status: varchar('status', { length: 20 }).notNull().default('active'),
    metadata: jsonb('metadata').default({}),
    lastValidatedAt: timestamp('last_validated_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    workspaceIdx: index('social_connections_workspace_idx').on(table.workspaceId),
    platformAccountIdx: uniqueIndex('social_connections_platform_account_idx').on(
      table.workspaceId,
      table.platform,
      table.platformAccountId,
    ),
  }),
);

export const publishingJobs = pgTable(
  'publishing_jobs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id').references(() => projects.id, { onDelete: 'set null' }),
    assetId: uuid('asset_id')
      .notNull()
      .references(() => assets.id, { onDelete: 'cascade' }),
    socialConnectionId: uuid('social_connection_id')
      .notNull()
      .references(() => socialConnections.id, { onDelete: 'cascade' }),
    platform: varchar('platform', { length: 40 }).notNull(),
    status: varchar('status', { length: 20 }).notNull().default('queued'),
    scheduledAt: timestamp('scheduled_at', { withTimezone: true }),
    startedAt: timestamp('started_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    externalPostId: varchar('external_post_id', { length: 255 }),
    externalPostUrl: text('external_post_url'),
    caption: text('caption'),
    hashtags: jsonb('hashtags').notNull().default([]),
    platformOptions: jsonb('platform_options').notNull().default({}),
    errorCode: varchar('error_code', { length: 80 }),
    errorMessage: text('error_message'),
    retryCount: integer('retry_count').notNull().default(0),
    idempotencyKey: varchar('idempotency_key', { length: 128 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    workspaceIdx: index('publishing_jobs_workspace_idx').on(table.workspaceId),
    statusIdx: index('publishing_jobs_status_idx').on(table.status),
    assetIdx: index('publishing_jobs_asset_idx').on(table.assetId),
    idempotencyIdx: uniqueIndex('publishing_jobs_idempotency_idx').on(
      table.workspaceId,
      table.idempotencyKey,
    ),
  }),
);

export const aiProviderConfigs = pgTable(
  'ai_provider_configs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // NULL = system/default scope; set = workspace-specific override
    workspaceId: uuid('workspace_id').references(() => workspaces.id, { onDelete: 'cascade' }),
    providerId: varchar('provider_id', { length: 40 }).notNull(),
    enabled: boolean('enabled').notNull().default(true),
    baseUrl: varchar('base_url', { length: 500 }),
    encryptedApiKey: text('encrypted_api_key'),
    defaultModelId: varchar('default_model_id', { length: 200 }),
    capabilities: jsonb('capabilities').notNull().default([]),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    workspaceProviderIdx: uniqueIndex('ai_provider_configs_workspace_provider_idx').on(
      table.workspaceId,
      table.providerId,
    ),
    systemProviderIdx: uniqueIndex('ai_provider_configs_system_provider_idx')
      .on(table.providerId)
      .where(isNull(table.workspaceId)),
    workspaceIdx: index('ai_provider_configs_workspace_idx').on(table.workspaceId),
  }),
);

export const aiProviderConfigsRelations = relations(aiProviderConfigs, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [aiProviderConfigs.workspaceId],
    references: [workspaces.id],
  }),
}));

export const agentConversations = pgTable(
  'agent_conversations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    title: varchar('title', { length: 200 }).notNull().default('New conversation'),
    status: varchar('status', { length: 20 }).notNull().default('active'),
    selectedProductId: uuid('selected_product_id').references(() => products.id, { onDelete: 'set null' }),
    selectedTemplateId: uuid('selected_template_id').references(() => templates.id, { onDelete: 'set null' }),
    activeVideoJobId: uuid('active_video_job_id').references(() => videoGenerationJobs.id, { onDelete: 'set null' }),
    language: varchar('language', { length: 20 }),
    pendingConfirmation: jsonb('pending_confirmation'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    userIdIdx: index('agent_conversations_user_id_idx').on(table.userId),
    workspaceIdIdx: index('agent_conversations_workspace_id_idx').on(table.workspaceId),
  }),
);

export const agentMessages = pgTable(
  'agent_messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => agentConversations.id, { onDelete: 'cascade' }),
    role: varchar('role', { length: 20 }).notNull(),
    content: text('content'),
    toolName: varchar('tool_name', { length: 120 }),
    toolArgs: jsonb('tool_args'),
    toolResult: jsonb('tool_result'),
    modelInfo: jsonb('model_info'),
    step: integer('step'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    conversationIdx: index('agent_messages_conversation_idx').on(table.conversationId, table.createdAt),
  }),
);
