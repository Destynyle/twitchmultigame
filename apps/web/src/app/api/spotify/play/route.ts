import { NextRequest, NextResponse } from 'next/server'
import { auth } from '~/server/auth'
import { getSpotifyToken } from '~/server/spotify'

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await auth()
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const tenantId = session.user.tenantId

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { spotifyTrackId, deviceId } = body as { spotifyTrackId?: string; deviceId?: string }
  if (!spotifyTrackId || !deviceId) {
    return NextResponse.json({ error: 'Missing spotifyTrackId or deviceId' }, { status: 400 })
  }

  const token = await getSpotifyToken(tenantId)
  if (!token) {
    return NextResponse.json({ error: 'Spotify not connected' }, { status: 400 })
  }

  const res = await fetch(
    `https://api.spotify.com/v1/me/player/play?device_id=${encodeURIComponent(deviceId)}`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ uris: [`spotify:track:${spotifyTrackId}`] }),
    }
  )

  if (!res.ok) {
    const errText = await res.text()
    return NextResponse.json({ error: `Spotify API error: ${errText}` }, { status: res.status })
  }

  return NextResponse.json({ success: true })
}
