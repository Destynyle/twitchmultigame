'use server'

import { auth } from '~/server/auth'
import { db } from '@playground/db'
import { users, tenants, sessions, adminAuditLog } from '@playground/db/schema'
import { eq, ilike, inArray, and, desc, isNull } from 'drizzle-orm'
import { getRedisPublisher, SESSION_CMD_CHANNEL, SESSIONS_EVENTS_CHANNEL } from '~/server/redis'
import { logAdminAction } from './log-action'

async function requireAdmin() {
  const session = await auth()
  if (!session || session.user.role !== 'admin') throw new Error('Forbidden')
  return session.user
}

// ─── Search users ─────────────────────────────────────────────────────────────

export async function searchUsersAction(query: string): Promise<{
  results: Array<{
    tenantId: string
    twitchLogin: string
    displayName: string
    role: string
    subscriptionStatus: string
    createdAt: Date
  }>
} | { error: string }> {
  try {
    await requireAdmin()
    if (!query.trim()) return { results: [] }

    const rows = await db
      .select({
        tenantId: tenants.id,
        twitchLogin: tenants.twitchLogin,
        displayName: tenants.displayName,
        role: users.role,
        subscriptionStatus: users.subscriptionStatus,
        createdAt: tenants.createdAt,
      })
      .from(tenants)
      .innerJoin(users, eq(users.tenantId, tenants.id))
      .where(
        and(
          ilike(tenants.twitchLogin, `%${query}%`),
          isNull(tenants.deletedAt)
        )
      )
      .limit(20)

    return { results: rows }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Unknown error' }
  }
}

// ─── Quarantine account ───────────────────────────────────────────────────────

export async function quarantineAccountAction(
  tenantId: string,
  reason: string
): Promise<{ success: true } | { error: string }> {
  try {
    const admin = await requireAdmin()

    // Get current role before quarantine (to store for restore)
    const [userRow] = await db
      .select({ role: users.role })
      .from(users)
      .where(eq(users.tenantId, tenantId))
    if (!userRow) return { error: 'User not found' }

    const previousRole = userRow.role

    // Set role to quarantined
    await db
      .update(users)
      .set({ role: 'quarantined', updatedAt: new Date() })
      .where(eq(users.tenantId, tenantId))

    // End all active/paused sessions for this tenant
    const activeSessions = await db
      .select({ id: sessions.id })
      .from(sessions)
      .where(
        and(
          eq(sessions.tenantId, tenantId),
          inArray(sessions.status, ['active', 'paused', 'pending'])
        )
      )

    const redis = getRedisPublisher()
    for (const s of activeSessions) {
      await db
        .update(sessions)
        .set({ status: 'ended', endedAt: new Date(), updatedAt: new Date() })
        .where(eq(sessions.id, s.id))
      await redis.publish(SESSION_CMD_CHANNEL(s.id), JSON.stringify({ action: 'end' }))
      await redis.publish(SESSIONS_EVENTS_CHANNEL, JSON.stringify({ type: 'session_ended', sessionId: s.id }))
    }

    // Push notification to the affected streamer
    await redis.setex(
      `admin:notification:${tenantId}`,
      300,
      JSON.stringify({
        message: 'Your account is under review. Contact support.',
        sessionId: '',
      })
    )

    // Audit log — store previousRole in metadata for restore
    await logAdminAction({
      actorId: admin.tenantId,
      action: 'account.quarantine',
      targetType: 'tenant',
      targetId: tenantId,
      metadata: { reason, previousRole, endedSessions: activeSessions.length },
    })

    return { success: true }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Unknown error' }
  }
}

// ─── Restore account ──────────────────────────────────────────────────────────

export async function restoreAccountAction(
  tenantId: string
): Promise<{ success: true } | { error: string }> {
  try {
    const admin = await requireAdmin()

    // Retrieve previous role from most recent quarantine audit log entry
    const [lastQuarantine] = await db
      .select({ metadata: adminAuditLog.metadata })
      .from(adminAuditLog)
      .where(
        and(
          eq(adminAuditLog.action, 'account.quarantine'),
          eq(adminAuditLog.targetId, tenantId)
        )
      )
      .orderBy(desc(adminAuditLog.createdAt))
      .limit(1)

    const previousRole =
      (lastQuarantine?.metadata as { previousRole?: string } | null)?.previousRole ?? 'free'

    await db
      .update(users)
      .set({
        role: previousRole as 'free' | 'premium' | 'admin',
        updatedAt: new Date(),
      })
      .where(eq(users.tenantId, tenantId))

    await logAdminAction({
      actorId: admin.tenantId,
      action: 'account.restore',
      targetType: 'tenant',
      targetId: tenantId,
      metadata: { restoredRole: previousRole },
    })

    return { success: true }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Unknown error' }
  }
}

// ─── Quarantine queue ─────────────────────────────────────────────────────────

export async function getQuarantineQueueAction(): Promise<{
  queue: Array<{
    tenantId: string
    twitchLogin: string
    displayName: string
    quarantinedAt: Date
    reason: string
    actorId: string
  }>
} | { error: string }> {
  try {
    await requireAdmin()

    const quarantinedUsers = await db
      .select({
        tenantId: tenants.id,
        twitchLogin: tenants.twitchLogin,
        displayName: tenants.displayName,
      })
      .from(tenants)
      .innerJoin(users, eq(users.tenantId, tenants.id))
      .where(eq(users.role, 'quarantined'))

    if (quarantinedUsers.length === 0) return { queue: [] }

    // Fetch last quarantine log entry per tenant
    const tenantIds = quarantinedUsers.map((u) => u.tenantId)
    const logEntries = await db
      .select({
        targetId: adminAuditLog.targetId,
        actorId: adminAuditLog.actorId,
        metadata: adminAuditLog.metadata,
        createdAt: adminAuditLog.createdAt,
      })
      .from(adminAuditLog)
      .where(
        and(
          eq(adminAuditLog.action, 'account.quarantine'),
          inArray(adminAuditLog.targetId, tenantIds)
        )
      )
      .orderBy(desc(adminAuditLog.createdAt))

    // Keep only most recent entry per tenant
    const latestMap = new Map<string, typeof logEntries[0]>()
    for (const entry of logEntries) {
      if (entry.targetId && !latestMap.has(entry.targetId)) {
        latestMap.set(entry.targetId, entry)
      }
    }

    const queue = quarantinedUsers.map((u) => {
      const log = latestMap.get(u.tenantId)
      return {
        tenantId: u.tenantId,
        twitchLogin: u.twitchLogin,
        displayName: u.displayName,
        quarantinedAt: log?.createdAt ?? new Date(0),
        reason: (log?.metadata as { reason?: string } | null)?.reason ?? '—',
        actorId: log?.actorId ?? '—',
      }
    })

    return { queue }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Unknown error' }
  }
}
