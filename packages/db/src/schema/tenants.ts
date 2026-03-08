import {
  pgTable,
  uuid,
  text,
  timestamp,
  pgEnum,
  pgPolicy,
  index,
  unique,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

// ─── Enums ────────────────────────────────────────────────────────────────────

export const userRoleEnum = pgEnum('user_role', ['free', 'premium', 'admin'])

export const subscriptionStatusEnum = pgEnum('subscription_status', [
  'free',
  'active',
  'past_due',
  'canceled',
])

export const oauthProviderEnum = pgEnum('oauth_provider', [
  'twitch',
  'spotify',
  'youtube',
])

// ─── Tenants (root table — no tenant_id FK) ───────────────────────────────────

export const tenants = pgTable(
  'tenants',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    twitchId: text('twitch_id').notNull(),
    twitchLogin: text('twitch_login').notNull(),
    displayName: text('display_name').notNull(),
    overlayToken: text('overlay_token'),
    selectedThemeId: uuid('selected_theme_id'),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique('tenants_twitch_id_unique').on(table.twitchId),
    unique('tenants_overlay_token_unique').on(table.overlayToken),
    pgPolicy('tenants_self_isolation', {
      as: 'permissive',
      for: 'all',
      to: 'public',
      using: sql`${table.id} = current_setting('app.current_tenant_id', true)::uuid AND ${table.deletedAt} IS NULL`,
    }),
  ]
)

// ─── Users (tenant-scoped) ────────────────────────────────────────────────────

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    twitchId: text('twitch_id').notNull(),
    role: userRoleEnum('role').notNull().default('free'),
    subscriptionStatus: subscriptionStatusEnum('subscription_status')
      .notNull()
      .default('free'),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('idx_users_tenant_id').on(table.tenantId),
    unique('users_tenant_twitch_unique').on(table.tenantId, table.twitchId),
    pgPolicy('users_tenant_isolation', {
      as: 'permissive',
      for: 'all',
      to: 'public',
      using: sql`${table.tenantId} = current_setting('app.current_tenant_id', true)::uuid AND ${table.deletedAt} IS NULL`,
    }),
  ]
)

// ─── OAuth Tokens (tenant-scoped) ─────────────────────────────────────────────

export const oauthTokens = pgTable(
  'oauth_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    provider: oauthProviderEnum('provider').notNull(),
    encryptedAccessToken: text('encrypted_access_token').notNull(),
    encryptedRefreshToken: text('encrypted_refresh_token'),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('idx_oauth_tokens_tenant_id').on(table.tenantId),
    unique('oauth_tokens_tenant_provider_unique').on(table.tenantId, table.provider),
    pgPolicy('oauth_tokens_tenant_isolation', {
      as: 'permissive',
      for: 'all',
      to: 'public',
      using: sql`${table.tenantId} = current_setting('app.current_tenant_id', true)::uuid`,
    }),
  ]
)

// ─── Inferred Types ───────────────────────────────────────────────────────────

export type Tenant = typeof tenants.$inferSelect
export type NewTenant = typeof tenants.$inferInsert
export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
export type OauthToken = typeof oauthTokens.$inferSelect
export type NewOauthToken = typeof oauthTokens.$inferInsert
