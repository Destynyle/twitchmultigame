import { pgTable, uuid, text, timestamp, pgEnum, pgPolicy, index, integer, jsonb } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { tenants } from './tenants'
import { playlists } from './playlists'

export const sessionStatusEnum = pgEnum('session_status', [
  'pending', 'active', 'paused', 'ended', 'test_ended'
])

export const gameTypeEnum = pgEnum('game_type', ['blindtest', 'quiz'])

export const sessions = pgTable('sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  playlistId: uuid('playlist_id').references(() => playlists.id, { onDelete: 'set null' }),
  gameType: gameTypeEnum('game_type').notNull(),
  status: sessionStatusEnum('status').notNull().default('pending'),
  isTestMode: text('is_test_mode').notNull().default('false'),
  currentTrackIndex: integer('current_track_index').notNull().default(0),
  startedAt: timestamp('started_at', { withTimezone: true }),
  endedAt: timestamp('ended_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_sessions_tenant_id').on(table.tenantId),
  index('idx_sessions_status').on(table.status),
  pgPolicy('sessions_tenant_isolation', {
    as: 'permissive', for: 'all', to: 'public',
    using: sql`${table.tenantId} = current_setting('app.current_tenant_id', true)::uuid`,
  }),
])

export const sessionScores = pgTable('session_scores', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: uuid('session_id').notNull().references(() => sessions.id, { onDelete: 'cascade' }),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  viewerUsername: text('viewer_username').notNull(),
  viewerDisplayName: text('viewer_display_name').notNull(),
  gameType: gameTypeEnum('game_type').notNull(),
  score: integer('score').notNull().default(0),
  correctAnswers: integer('correct_answers').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_session_scores_session_id').on(table.sessionId),
  index('idx_session_scores_tenant_id').on(table.tenantId),
  pgPolicy('session_scores_tenant_isolation', {
    as: 'permissive', for: 'all', to: 'public',
    using: sql`${table.tenantId} = current_setting('app.current_tenant_id', true)::uuid`,
  }),
])

export const gameConfigs = pgTable('game_configs', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  sessionId: uuid('session_id').references(() => sessions.id, { onDelete: 'cascade' }),
  config: jsonb('config').notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_game_configs_tenant_id').on(table.tenantId),
  pgPolicy('game_configs_tenant_isolation', {
    as: 'permissive', for: 'all', to: 'public',
    using: sql`${table.tenantId} = current_setting('app.current_tenant_id', true)::uuid`,
  }),
])

export type Session = typeof sessions.$inferSelect
export type NewSession = typeof sessions.$inferInsert
export type SessionScore = typeof sessionScores.$inferSelect
export type GameConfig = typeof gameConfigs.$inferSelect
