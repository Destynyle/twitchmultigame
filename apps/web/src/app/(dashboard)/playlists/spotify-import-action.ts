'use server'

import { auth } from '~/server/auth'
import { redirect } from 'next/navigation'
import { getSpotifyToken } from '~/server/spotify'
import { withTenantContext } from '@playground/db'
import { playlists, tracks } from '@playground/db/schema'
import { sql } from 'drizzle-orm'

const FREE_TIER_PLAYLIST_LIMIT = 3

export type SpotifyImportResult =
  | { success: true; playlistId: string }
  | { success: false; error: string; upgradeRequired?: boolean }

export async function importSpotifyPlaylistAction(
  spotifyPlaylistId: string,
  spotifyPlaylistName: string
): Promise<SpotifyImportResult> {
  const session = await auth()
  if (!session?.user?.tenantId) redirect('/auth/signin')

  const tenantId = session.user.tenantId
  const role = session.user.role
  const accessToken = await getSpotifyToken(tenantId)

  if (!accessToken) {
    return { success: false, error: 'Spotify is not connected. Please connect Spotify in Settings.' }
  }

  // Check free tier limit
  if (role === 'free') {
    const count = await withTenantContext(tenantId, async (tx) => {
      const [r] = await tx.select({ count: sql<number>`count(*)::int` }).from(playlists)
      return r?.count ?? 0
    })
    if (count >= FREE_TIER_PLAYLIST_LIMIT) {
      return {
        success: false,
        error: 'Free tier limit reached (3 playlists). Upgrade to Pro.',
        upgradeRequired: true,
      }
    }
  }

  // Fetch tracks from Spotify (up to 200 tracks, paginating)
  const spotifyTracks: Array<{
    title: string
    artist: string
    durationSeconds: number
    sourceId: string
  }> = []
  let nextUrl: string | null =
    `https://api.spotify.com/v1/playlists/${spotifyPlaylistId}/tracks?limit=100&fields=next,items(track(id,name,artists,duration_ms))`

  while (nextUrl && spotifyTracks.length < 200) {
    const res = await fetch(nextUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!res.ok) return { success: false, error: 'Failed to fetch tracks from Spotify.' }

    const data = (await res.json()) as {
      next: string | null
      items: Array<{
        track: {
          id: string
          name: string
          artists: Array<{ name: string }>
          duration_ms: number
        } | null
      }>
    }

    for (const item of data.items) {
      if (!item.track) continue
      spotifyTracks.push({
        title: item.track.name,
        artist: item.track.artists.map((a) => a.name).join(', '),
        durationSeconds: Math.round(item.track.duration_ms / 1000),
        sourceId: item.track.id,
      })
    }
    nextUrl = data.next
  }

  if (spotifyTracks.length === 0) {
    return { success: false, error: 'This Spotify playlist has no tracks.' }
  }

  // Insert playlist + tracks
  const playlist = await withTenantContext(tenantId, async (tx) => {
    const [p] = await tx
      .insert(playlists)
      .values({
        tenantId,
        name: spotifyPlaylistName,
        sourceType: 'spotify',
        sourceId: spotifyPlaylistId,
        trackCount: spotifyTracks.length,
      })
      .returning()
    if (!p) throw new Error('Failed to create playlist')

    await tx.insert(tracks).values(
      spotifyTracks.map((t, i) => ({
        playlistId: p.id,
        tenantId,
        title: t.title,
        artist: t.artist,
        durationSeconds: t.durationSeconds,
        sourceType: 'spotify' as const,
        sourceId: t.sourceId,
        position: i,
      }))
    )
    return p
  })

  return { success: true, playlistId: playlist.id }
}
