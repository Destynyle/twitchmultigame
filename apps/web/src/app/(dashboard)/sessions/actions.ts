'use server'
import { auth } from '~/server/auth'
import { redirect } from 'next/navigation'
import { withTenantContext } from '@playground/db'
import { sessions, sessionScores, tracks } from '@playground/db/schema'
import { eq, and, desc, asc } from 'drizzle-orm'
import { getRedisPublisher, SESSION_CMD_CHANNEL, SESSIONS_EVENTS_CHANNEL } from '~/server/redis'
import { getSpotifyToken } from '~/server/spotify'

export async function createSessionAction(formData: FormData) {
  const session = await auth()
  if (!session?.user?.tenantId) redirect('/auth/signin')

  const gameType = formData.get('gameType') as 'blindtest' | 'quiz'
  const playlistId = formData.get('playlistId') as string
  const isTestMode = formData.get('isTestMode') === 'true'

  if (!playlistId || !gameType) return { error: 'Missing required fields' }

  const tenantId = session.user.tenantId
  const [newSession] = await withTenantContext(tenantId, async (tx) => {
    return tx.insert(sessions).values({
      tenantId,
      gameType,
      playlistId,
      status: 'pending',
      isTestMode: isTestMode ? 'true' : 'false',
    }).returning()
  })

  return { success: true, sessionId: newSession?.id }
}

export async function updateSessionStatusAction(
  sessionId: string,
  action: 'launch' | 'pause' | 'resume' | 'end'
) {
  const session = await auth()
  if (!session?.user?.tenantId) redirect('/auth/signin')
  const tenantId = session.user.tenantId

  const updates: Record<string, unknown> = {}
  let statusFilter: string | undefined

  switch (action) {
    case 'launch':
      updates.status = 'active'
      updates.startedAt = new Date()
      statusFilter = 'pending'
      break
    case 'pause':
      updates.status = 'paused'
      statusFilter = 'active'
      break
    case 'resume':
      updates.status = 'active'
      statusFilter = 'paused'
      break
    case 'end':
      updates.status = 'ended'
      updates.endedAt = new Date()
      break
  }

  await withTenantContext(tenantId, async (tx) => {
    const where = statusFilter
      ? and(eq(sessions.id, sessionId), eq(sessions.status, statusFilter as 'pending' | 'active' | 'paused' | 'ended' | 'test_ended'))
      : eq(sessions.id, sessionId)
    await tx.update(sessions).set(updates as Partial<typeof sessions.$inferInsert>).where(where)
  })

  // Publish command to bot-worker
  await getRedisPublisher().publish(SESSION_CMD_CHANNEL(sessionId), JSON.stringify({ action }))

  // On launch: also publish session lifecycle event so bot-worker can start a BotSession
  if (action === 'launch') {
    const twitchLogin = session.user.twitchLogin
    const [sessionRow] = await withTenantContext(tenantId, async (tx) =>
      tx.select({ gameType: sessions.gameType }).from(sessions).where(eq(sessions.id, sessionId))
    )
    await getRedisPublisher().publish(
      SESSIONS_EVENTS_CHANNEL,
      JSON.stringify({ type: 'session_launched', sessionId, tenantId, twitchLogin, gameType: sessionRow?.gameType })
    )
  }

  if (action === 'end') {
    await getRedisPublisher().publish(
      SESSIONS_EVENTS_CHANNEL,
      JSON.stringify({ type: 'session_ended', sessionId })
    )
  }

  return { success: true }
}

export async function nextTrackAction(sessionId: string) {
  const session = await auth()
  if (!session?.user?.tenantId) redirect('/auth/signin')
  const tenantId = session.user.tenantId

  await withTenantContext(tenantId, async (tx) => {
    const [current] = await tx
      .select({ currentTrackIndex: sessions.currentTrackIndex })
      .from(sessions)
      .where(eq(sessions.id, sessionId))

    if (!current) return

    await tx
      .update(sessions)
      .set({ currentTrackIndex: current.currentTrackIndex + 1 })
      .where(eq(sessions.id, sessionId))
  })

  await getRedisPublisher().publish(SESSION_CMD_CHANNEL(sessionId), JSON.stringify({ action: 'next' }))

  return { success: true }
}

export async function getSessionScoresAction(sessionId: string) {
  const session = await auth()
  if (!session?.user?.tenantId) return { error: 'Unauthorized' }
  const tenantId = session.user.tenantId

  return withTenantContext(tenantId, async (tx) => {
    return tx
      .select()
      .from(sessionScores)
      .where(eq(sessionScores.sessionId, sessionId))
      .orderBy(desc(sessionScores.score))
  })
}

export async function getSpotifyAccessTokenAction(): Promise<{ token: string } | { error: string }> {
  const session = await auth()
  if (!session?.user?.tenantId) return { error: 'Unauthorized' }
  const tenantId = session.user.tenantId

  const token = await getSpotifyToken(tenantId)
  if (!token) return { error: 'Spotify not connected' }
  return { token }
}

export async function getCurrentTrackAction(sessionId: string): Promise<{
  title: string
  artist: string | null
  sourceType: string | null
  sourceId: string | null
  position: number
} | { error: string }> {
  const session = await auth()
  if (!session?.user?.tenantId) return { error: 'Unauthorized' }
  const tenantId = session.user.tenantId

  return withTenantContext(tenantId, async (tx) => {
    // Get current track index for the session
    const [sessionRow] = await tx
      .select({ currentTrackIndex: sessions.currentTrackIndex, playlistId: sessions.playlistId })
      .from(sessions)
      .where(eq(sessions.id, sessionId))

    if (!sessionRow?.playlistId) return { error: 'Session not found or no playlist' }

    // Get tracks ordered by position
    const trackList = await tx
      .select()
      .from(tracks)
      .where(eq(tracks.playlistId, sessionRow.playlistId))
      .orderBy(asc(tracks.position))

    const track = trackList[sessionRow.currentTrackIndex]
    if (!track) return { error: 'Track not found at current index' }

    return {
      title: track.title,
      artist: track.artist ?? null,
      sourceType: track.sourceType ?? null,
      sourceId: track.sourceId ?? null,
      position: track.position,
    }
  })
}
