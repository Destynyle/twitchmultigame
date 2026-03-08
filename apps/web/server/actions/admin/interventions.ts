'use server'

import { auth } from '~/server/auth'
import { db } from '@playground/db'
import { sessions, oauthTokens } from '@playground/db/schema'
import { eq, and } from 'drizzle-orm'
import { getRedisPublisher, SESSION_CMD_CHANNEL, SESSIONS_EVENTS_CHANNEL, overlayChannel } from '~/server/redis'
import { decrypt, encrypt } from '@playground/shared/utils/encrypt'
import { env } from '@playground/shared/env'
import { logAdminAction } from './log-action'

async function requireAdmin() {
  const session = await auth()
  if (!session || session.user.role !== 'admin') {
    throw new Error('Forbidden')
  }
  return session.user
}

async function getSessionTenant(sessionId: string) {
  const [row] = await db
    .select({ tenantId: sessions.tenantId, status: sessions.status })
    .from(sessions)
    .where(eq(sessions.id, sessionId))
  if (!row) throw new Error(`Session ${sessionId} not found`)
  return row
}

// ─── Force SSE Reconnect ──────────────────────────────────────────────────────

export async function forceSSEReconnectAction(
  sessionId: string
): Promise<{ success: true } | { error: string }> {
  try {
    const admin = await requireAdmin()
    const { tenantId } = await getSessionTenant(sessionId)
    const redis = getRedisPublisher()

    await redis.publish(overlayChannel(tenantId), JSON.stringify({ type: 'force_reconnect' }))
    await logAdminAction({
      actorId: admin.tenantId,
      action: 'session.force_reconnect',
      targetType: 'session',
      targetId: sessionId,
    })

    return { success: true }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Unknown error' }
  }
}

// ─── Force Token Refresh ──────────────────────────────────────────────────────

export async function forceTokenRefreshAction(
  sessionId: string
): Promise<{ success: true } | { error: string }> {
  try {
    const admin = await requireAdmin()
    const { tenantId } = await getSessionTenant(sessionId)

    const [tokenRow] = await db
      .select({
        id: oauthTokens.id,
        encryptedRefreshToken: oauthTokens.encryptedRefreshToken,
      })
      .from(oauthTokens)
      .where(and(eq(oauthTokens.tenantId, tenantId), eq(oauthTokens.provider, 'twitch')))

    if (!tokenRow?.encryptedRefreshToken) {
      return { error: 'No refresh token available for this tenant' }
    }

    const refreshToken = decrypt(tokenRow.encryptedRefreshToken, env.TOKEN_ENCRYPTION_KEY)

    const resp = await fetch('https://id.twitch.tv/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: env.TWITCH_CLIENT_ID,
        client_secret: env.TWITCH_CLIENT_SECRET,
      }),
    })

    if (!resp.ok) {
      const body = await resp.text()
      return { error: `Twitch token refresh failed: ${body}` }
    }

    const data = (await resp.json()) as {
      access_token: string
      refresh_token?: string
      expires_in?: number
    }

    await db
      .update(oauthTokens)
      .set({
        encryptedAccessToken: encrypt(data.access_token, env.TOKEN_ENCRYPTION_KEY),
        ...(data.refresh_token && {
          encryptedRefreshToken: encrypt(data.refresh_token, env.TOKEN_ENCRYPTION_KEY),
        }),
        ...(data.expires_in && {
          expiresAt: new Date(Date.now() + data.expires_in * 1000),
        }),
        updatedAt: new Date(),
      })
      .where(eq(oauthTokens.id, tokenRow.id))

    await logAdminAction({
      actorId: admin.tenantId,
      action: 'session.force_token_refresh',
      targetType: 'tenant',
      targetId: tenantId,
      metadata: { sessionId },
    })

    return { success: true }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Unknown error' }
  }
}

// ─── Force Bot Reconnect ──────────────────────────────────────────────────────

export async function forceBotReconnectAction(
  sessionId: string
): Promise<{ success: true } | { error: string }> {
  try {
    const admin = await requireAdmin()
    const redis = getRedisPublisher()

    await redis.publish(SESSION_CMD_CHANNEL(sessionId), JSON.stringify({ action: 'reconnect' }))
    await logAdminAction({
      actorId: admin.tenantId,
      action: 'session.force_bot_reconnect',
      targetType: 'session',
      targetId: sessionId,
    })

    return { success: true }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Unknown error' }
  }
}

// ─── Admin End Session ────────────────────────────────────────────────────────

export async function adminEndSessionAction(
  sessionId: string
): Promise<{ success: true } | { error: string }> {
  try {
    const admin = await requireAdmin()
    const { tenantId } = await getSessionTenant(sessionId)
    const redis = getRedisPublisher()

    // End session in DB (bypasses RLS — admin operation)
    await db
      .update(sessions)
      .set({ status: 'ended', endedAt: new Date(), updatedAt: new Date() })
      .where(eq(sessions.id, sessionId))

    // Tell bot-worker to stop the session
    await redis.publish(SESSION_CMD_CHANNEL(sessionId), JSON.stringify({ action: 'end' }))
    await redis.publish(SESSIONS_EVENTS_CHANNEL, JSON.stringify({ type: 'session_ended', sessionId }))

    // Push notification to the affected streamer's dashboard (TTL 5 min)
    await redis.setex(
      `admin:notification:${tenantId}`,
      300,
      JSON.stringify({ message: 'Session ended by platform admin', sessionId })
    )

    await logAdminAction({
      actorId: admin.tenantId,
      action: 'session.end',
      targetType: 'session',
      targetId: sessionId,
      metadata: { tenantId, reason: 'admin_remote_end' },
    })

    return { success: true }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Unknown error' }
  }
}
