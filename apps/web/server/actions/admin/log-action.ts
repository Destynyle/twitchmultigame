import { db } from '@playground/db'
import { adminAuditLog } from '@playground/db/schema'

export type AdminActionType =
  | 'session.force_reconnect'
  | 'session.force_token_refresh'
  | 'session.force_bot_reconnect'
  | 'session.end'
  | 'account.quarantine'
  | 'account.restore'
  | 'content.remove'
  | 'content.dismiss_report'
  | 'playlist.publish'
  | 'playlist.edit'
  | 'playlist.official_publish'
  | 'playlist.official_edit'

/**
 * Inserts an immutable audit log entry for an admin action.
 * Must be called inside the same transaction as the action itself
 * so that failures roll back both the action and the log entry.
 */
export async function logAdminAction(params: {
  actorId: string
  action: AdminActionType
  targetType?: string
  targetId?: string
  metadata?: Record<string, unknown>
  tx?: typeof db
}): Promise<void> {
  const client = params.tx ?? db
  await client.insert(adminAuditLog).values({
    actorId: params.actorId,
    action: params.action,
    targetType: params.targetType ?? null,
    targetId: params.targetId ?? null,
    metadata: params.metadata ?? {},
  })
}
