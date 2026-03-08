import { NextResponse } from 'next/server'
import { auth } from '~/server/auth'
import { db } from '@playground/db'
import { sessions, sessionScores, tenants } from '@playground/db/schema'
import { inArray, count, eq } from 'drizzle-orm'
import { getRedisPublisher } from '~/server/redis'

export const runtime = 'nodejs'

export async function GET() {
  const session = await auth()
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Query all active/paused sessions without RLS (admin bypasses tenant isolation)
  const activeSessions = await db
    .select({
      id: sessions.id,
      tenantId: sessions.tenantId,
      gameType: sessions.gameType,
      status: sessions.status,
      startedAt: sessions.startedAt,
      twitchLogin: tenants.twitchLogin,
      displayName: tenants.displayName,
    })
    .from(sessions)
    .innerJoin(tenants, eq(sessions.tenantId, tenants.id))
    .where(inArray(sessions.status, ['active', 'paused']))

  if (activeSessions.length === 0) {
    return NextResponse.json({ sessions: [] })
  }

  // Viewer counts per session
  const sessionIds = activeSessions.map((s) => s.id)
  const viewerCounts = await db
    .select({
      sessionId: sessionScores.sessionId,
      viewers: count(sessionScores.id),
    })
    .from(sessionScores)
    .where(inArray(sessionScores.sessionId, sessionIds))
    .groupBy(sessionScores.sessionId)

  const viewerMap = new Map(viewerCounts.map((v) => [v.sessionId, v.viewers]))

  // Bot status from Redis
  const redis = getRedisPublisher()
  const botStatuses = await Promise.all(
    activeSessions.map(async (s) => {
      const raw = await redis.get(`bot:status:${s.id}`)
      if (!raw) return { sessionId: s.id, status: 'disconnected' as const, since: null }
      try {
        const parsed = JSON.parse(raw) as { status: 'connected' | 'reconnecting'; since: string }
        return { sessionId: s.id, status: parsed.status, since: parsed.since }
      } catch {
        return { sessionId: s.id, status: 'disconnected' as const, since: null }
      }
    })
  )
  const botStatusMap = new Map(botStatuses.map((b) => [b.sessionId, b]))

  const result = activeSessions.map((s) => {
    const bot = botStatusMap.get(s.id)
    return {
      id: s.id,
      tenantId: s.tenantId,
      gameType: s.gameType,
      status: s.status,
      startedAt: s.startedAt?.toISOString() ?? null,
      twitchLogin: s.twitchLogin,
      displayName: s.displayName,
      viewerCount: viewerMap.get(s.id) ?? 0,
      botStatus: bot?.status ?? 'disconnected',
      botStatusSince: bot?.since ?? null,
    }
  })

  return NextResponse.json({ sessions: result })
}
