import { and, eq } from 'drizzle-orm'
import { db } from '@playground/db'
import { oauthTokens } from '@playground/db/schema'
import { env } from '@playground/shared/env'
import { decrypt, encrypt } from '@playground/shared/utils/encrypt'

/**
 * Returns a valid Spotify access token for the given tenant.
 * Refreshes the token automatically if expired.
 * Returns null if Spotify is not connected.
 */
export async function getSpotifyToken(tenantId: string): Promise<string | null> {
  const [token] = await db
    .select()
    .from(oauthTokens)
    .where(and(eq(oauthTokens.tenantId, tenantId), eq(oauthTokens.provider, 'spotify')))
    .limit(1)

  if (!token) return null

  const now = new Date()
  const isExpired = token.expiresAt ? token.expiresAt <= new Date(now.getTime() + 60_000) : false

  if (!isExpired) {
    return decrypt(token.encryptedAccessToken, env.TOKEN_ENCRYPTION_KEY)
  }

  // Token expired — refresh it
  if (!token.encryptedRefreshToken) return null

  const refreshToken = decrypt(token.encryptedRefreshToken, env.TOKEN_ENCRYPTION_KEY)
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${env.SPOTIFY_CLIENT_ID}:${env.SPOTIFY_CLIENT_SECRET}`).toString('base64')}`,
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  })

  if (!res.ok) return null

  const data = (await res.json()) as {
    access_token: string
    expires_in: number
    refresh_token?: string
  }

  const encryptedAccess = encrypt(data.access_token, env.TOKEN_ENCRYPTION_KEY)
  const expiresAt = new Date(Date.now() + data.expires_in * 1000)

  await db
    .update(oauthTokens)
    .set({
      encryptedAccessToken: encryptedAccess,
      ...(data.refresh_token && {
        encryptedRefreshToken: encrypt(data.refresh_token, env.TOKEN_ENCRYPTION_KEY),
      }),
      expiresAt,
    })
    .where(and(eq(oauthTokens.tenantId, tenantId), eq(oauthTokens.provider, 'spotify')))

  return data.access_token
}

export async function isSpotifyConnected(tenantId: string): Promise<boolean> {
  const [token] = await db
    .select({ id: oauthTokens.id })
    .from(oauthTokens)
    .where(and(eq(oauthTokens.tenantId, tenantId), eq(oauthTokens.provider, 'spotify')))
    .limit(1)
  return !!token
}
