import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  pgPolicy,
  index,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { tenants } from './tenants'

// ─── Playlists ────────────────────────────────────────────────────────────────

export const playlists = pgTable(
  'playlists',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    // 'manual' | 'spotify' | 'youtube'
    sourceType: text('source_type').notNull().default('manual'),
    // external playlist ID if imported
    sourceId: text('source_id'),
    trackCount: integer('track_count').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('idx_playlists_tenant_id').on(table.tenantId),
    pgPolicy('playlists_tenant_isolation', {
      as: 'permissive',
      for: 'all',
      to: 'public',
      using: sql`${table.tenantId} = current_setting('app.current_tenant_id', true)::uuid`,
    }),
  ]
)

// ─── Tracks ───────────────────────────────────────────────────────────────────

export const tracks = pgTable(
  'tracks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    playlistId: uuid('playlist_id')
      .notNull()
      .references(() => playlists.id, { onDelete: 'cascade' }),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    artist: text('artist'),
    durationSeconds: integer('duration_seconds'),
    // 'manual' | 'spotify' | 'youtube'
    sourceType: text('source_type'),
    // Spotify track ID / YouTube video ID
    sourceId: text('source_id'),
    position: integer('position').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('idx_tracks_playlist_id').on(table.playlistId),
    index('idx_tracks_tenant_id').on(table.tenantId),
    pgPolicy('tracks_tenant_isolation', {
      as: 'permissive',
      for: 'all',
      to: 'public',
      using: sql`${table.tenantId} = current_setting('app.current_tenant_id', true)::uuid`,
    }),
  ]
)

// ─── Inferred Types ───────────────────────────────────────────────────────────

export type Playlist = typeof playlists.$inferSelect
export type NewPlaylist = typeof playlists.$inferInsert
export type Track = typeof tracks.$inferSelect
export type NewTrack = typeof tracks.$inferInsert
