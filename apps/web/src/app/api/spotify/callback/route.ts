import { NextRequest, NextResponse } from 'next/server'

import { db } from '@playground/db'
import { oauthTokens } from '@playground/db/schema'
import { env } from '@playground/shared/env'
import { encrypt } from '@playground/shared/utils/encrypt'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const tenantId = searchParams.get('state')
  const error = searchParams.get('error')

  if (error || !code || !tenantId) {
    return NextResponse.redirect(
      new URL('/dashboard/settings?spotify=error', req.url)
    )
  }

  const baseUrl = process.env.NEXTAUTH_URL ?? 'http://localhost:3000'

  const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${env.SPOTIFY_CLIENT_ID}:${env.SPOTIFY_CLIENT_SECRET}`).toString('base64')}`,
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: `${baseUrl}/api/spotify/callback`,
    }),
  })

  if (!tokenRes.ok) {
    return NextResponse.redirect(
      new URL('/dashboard/settings?spotify=error', req.url)
    )
  }

  const tokenData = (await tokenRes.json()) as {
    access_token: string
    refresh_token?: string
    expires_in: number
  }

  const encryptedAccess = encrypt(tokenData.access_token, env.TOKEN_ENCRYPTION_KEY)
  const encryptedRefresh = tokenData.refresh_token
    ? encrypt(tokenData.refresh_token, env.TOKEN_ENCRYPTION_KEY)
    : null
  const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000)

  await db
    .insert(oauthTokens)
    .values({
      tenantId,
      provider: 'spotify',
      encryptedAccessToken: encryptedAccess,
      encryptedRefreshToken: encryptedRefresh,
      expiresAt,
    })
    .onConflictDoUpdate({
      target: [oauthTokens.tenantId, oauthTokens.provider],
      set: {
        encryptedAccessToken: encryptedAccess,
        encryptedRefreshToken: encryptedRefresh,
        expiresAt,
      },
    })

  return NextResponse.redirect(
    new URL('/dashboard/settings?spotify=connected', req.url)
  )
}
