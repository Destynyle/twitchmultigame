import { NextResponse } from 'next/server'
import { auth } from '~/server/auth'
import { env } from '@playground/shared/env'

const SPOTIFY_SCOPES = 'playlist-read-private playlist-read-collaborative'

export async function GET() {
  const session = await auth()
  if (!session?.user?.tenantId) {
    return NextResponse.redirect(
      new URL('/signin', process.env.NEXTAUTH_URL ?? 'http://localhost:3000')
    )
  }

  const params = new URLSearchParams({
    client_id: env.SPOTIFY_CLIENT_ID,
    response_type: 'code',
    redirect_uri: `${process.env.NEXTAUTH_URL ?? 'http://localhost:3000'}/api/spotify/callback`,
    scope: SPOTIFY_SCOPES,
    state: session.user.tenantId,
  })

  return NextResponse.redirect(`https://accounts.spotify.com/authorize?${params}`)
}
