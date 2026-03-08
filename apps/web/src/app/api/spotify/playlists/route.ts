import { NextResponse } from 'next/server'
import { auth } from '~/server/auth'
import { getSpotifyToken } from '~/server/spotify'

export async function GET() {
  const session = await auth()
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const accessToken = await getSpotifyToken(session.user.tenantId)
  if (!accessToken) {
    return NextResponse.json({ error: 'Spotify not connected' }, { status: 403 })
  }

  const res = await fetch('https://api.spotify.com/v1/me/playlists?limit=50', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!res.ok) {
    return NextResponse.json({ error: 'Spotify API error' }, { status: 502 })
  }

  const data = (await res.json()) as {
    items: Array<{
      id: string
      name: string
      tracks: { total: number }
      images: Array<{ url: string }>
    }>
  }

  return NextResponse.json({
    playlists: data.items.map((p) => ({
      id: p.id,
      name: p.name,
      trackCount: p.tracks.total,
      imageUrl: p.images[0]?.url ?? null,
    })),
  })
}
