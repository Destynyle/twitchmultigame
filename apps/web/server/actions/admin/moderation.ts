'use server'

import { auth } from '~/server/auth'
import { db } from '@playground/db'
import { contentReports, playlists } from '@playground/db/schema'
import { eq, and, inArray } from 'drizzle-orm'
import { getRedisPublisher } from '~/server/redis'
import { logAdminAction } from './log-action'

async function requireAdmin() {
  const session = await auth()
  if (!session || session.user.role !== 'admin') throw new Error('Forbidden')
  return session.user
}

export interface ReportGroup {
  contentType: string
  contentId: string
  contentPreview: string
  reporterCount: number
  reasons: string[]
  firstReportedAt: Date
  reportIds: string[]
}

// ─── Get moderation queue ─────────────────────────────────────────────────────

export async function getModerationQueueAction(
  filterReason?: string
): Promise<{ groups: ReportGroup[] } | { error: string }> {
  try {
    await requireAdmin()

    const where = filterReason
      ? and(eq(contentReports.status, 'pending'), eq(contentReports.reason, filterReason))
      : eq(contentReports.status, 'pending')

    const reports = await db
      .select()
      .from(contentReports)
      .where(where)

    if (reports.length === 0) return { groups: [] }

    // Group by contentType + contentId in JS
    const groupMap = new Map<string, ReportGroup>()
    for (const r of reports) {
      const key = `${r.contentType}:${r.contentId}`
      const existing = groupMap.get(key)
      if (existing) {
        existing.reporterCount++
        if (!existing.reasons.includes(r.reason)) existing.reasons.push(r.reason)
        if (r.createdAt < existing.firstReportedAt) existing.firstReportedAt = r.createdAt
        existing.reportIds.push(r.id)
      } else {
        groupMap.set(key, {
          contentType: r.contentType,
          contentId: r.contentId,
          contentPreview: '',
          reporterCount: 1,
          reasons: [r.reason],
          firstReportedAt: r.createdAt,
          reportIds: [r.id],
        })
      }
    }

    // Fetch content previews for playlists
    const playlistIds = [...groupMap.values()]
      .filter((g) => g.contentType === 'playlist')
      .map((g) => g.contentId)

    if (playlistIds.length > 0) {
      const playlistRows = await db
        .select({ id: playlists.id, name: playlists.name })
        .from(playlists)
        .where(inArray(playlists.id, playlistIds))

      const nameMap = new Map(playlistRows.map((p) => [p.id, p.name]))
      for (const group of groupMap.values()) {
        if (group.contentType === 'playlist') {
          group.contentPreview = nameMap.get(group.contentId) ?? `Playlist ${group.contentId.slice(0, 8)}`
        }
      }
    }

    const groups = [...groupMap.values()].sort(
      (a, b) => a.firstReportedAt.getTime() - b.firstReportedAt.getTime()
    )

    return { groups }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Unknown error' }
  }
}

// ─── Remove reported content ──────────────────────────────────────────────────

export async function removeContentAction(
  contentType: string,
  contentId: string,
  reportIds: string[]
): Promise<{ success: true } | { error: string }> {
  try {
    const admin = await requireAdmin()

    if (contentType === 'playlist') {
      // Soft-delete the playlist
      const [playlist] = await db
        .select({ id: playlists.id, tenantId: playlists.tenantId })
        .from(playlists)
        .where(eq(playlists.id, contentId))

      if (!playlist) return { error: 'Playlist not found' }

      await db
        .update(playlists)
        .set({ deletedAt: new Date(), updatedAt: new Date() })
        .where(eq(playlists.id, contentId))

      // Mark all reports for this content as actioned
      await db
        .update(contentReports)
        .set({ status: 'actioned' })
        .where(inArray(contentReports.id, reportIds))

      // Notify the content owner streamer
      const redis = getRedisPublisher()
      await redis.setex(
        `admin:notification:${playlist.tenantId}`,
        300,
        JSON.stringify({
          message: 'A playlist was removed following a moderation review',
          sessionId: '',
        })
      )

      await logAdminAction({
        actorId: admin.tenantId,
        action: 'content.remove',
        targetType: 'playlist',
        targetId: contentId,
        metadata: { tenantId: playlist.tenantId, reportCount: reportIds.length },
      })
    } else {
      return { error: `Unsupported content type: ${contentType}` }
    }

    return { success: true }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Unknown error' }
  }
}

// ─── Dismiss report ───────────────────────────────────────────────────────────

export async function dismissReportAction(
  contentType: string,
  contentId: string,
  reportIds: string[]
): Promise<{ success: true } | { error: string }> {
  try {
    const admin = await requireAdmin()

    await db
      .update(contentReports)
      .set({ status: 'dismissed' })
      .where(inArray(contentReports.id, reportIds))

    await logAdminAction({
      actorId: admin.tenantId,
      action: 'content.dismiss_report',
      targetType: contentType,
      targetId: contentId,
      metadata: { reportCount: reportIds.length },
    })

    return { success: true }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Unknown error' }
  }
}
