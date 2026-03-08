import { pgTable, uuid, text, jsonb, timestamp, index, pgPolicy } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

// ─── Admin Audit Log (platform-wide, immutable) ───────────────────────────────

export const adminAuditLog = pgTable(
  'admin_audit_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    actorId: uuid('actor_id').notNull(),
    action: text('action').notNull(),
    targetType: text('target_type'),
    targetId: text('target_id'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('idx_audit_actor_id').on(table.actorId),
    index('idx_audit_action').on(table.action),
    index('idx_audit_target_id').on(table.targetId),
    index('idx_audit_created_at').on(table.createdAt),
  ]
)

export type AdminAuditLog = typeof adminAuditLog.$inferSelect
export type NewAdminAuditLog = typeof adminAuditLog.$inferInsert

// ─── Content Reports (cross-tenant — submitted by viewers, reviewed by admins) ─

export const contentReports = pgTable(
  'content_reports',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    contentType: text('content_type').notNull(),
    contentId: uuid('content_id').notNull(),
    reporterId: uuid('reporter_id').notNull(),
    reason: text('reason').notNull(),
    status: text('status').notNull().default('pending'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('idx_content_reports_content').on(table.contentType, table.contentId),
    index('idx_content_reports_status').on(table.status),
    index('idx_content_reports_reason').on(table.reason),
    // Allow anyone to INSERT (viewers submit reports)
    pgPolicy('content_reports_insert', {
      as: 'permissive',
      for: 'insert',
      to: 'public',
      withCheck: sql`true`,
    }),
    // Allow anyone to SELECT (server reads without RLS context)
    pgPolicy('content_reports_select', {
      as: 'permissive',
      for: 'select',
      to: 'public',
      using: sql`true`,
    }),
  ]
)

export type ContentReport = typeof contentReports.$inferSelect
export type NewContentReport = typeof contentReports.$inferInsert
