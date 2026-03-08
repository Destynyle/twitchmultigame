import { pgTable, uuid, text, jsonb, timestamp, index } from 'drizzle-orm/pg-core'

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
