import { NextRequest, NextResponse } from 'next/server'
import { auth } from '~/server/auth'
import { withTenantContext } from '@playground/db'
import { playlists, tracks } from '@playground/db/schema'
import { eq } from 'drizzle-orm'
import { redirect } from 'next/navigation'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.tenantId) {
    redirect('/auth/signin')
  }

  const tenantId = session.user.tenantId
  const { id: playlistId } = await params

  if (!playlistId || typeof playlistId !== 'string') {
    return NextResponse.json({ error: 'Playlist ID is required.' }, { status: 400 })
  }

  try {
    const result = await withTenantContext(tenantId, async (tx) => {
      const [playlist] = await tx
        .select()
        .from(playlists)
        .where(eq(playlists.id, playlistId))
        .limit(1)

      if (!playlist) {
        return null
      }

      const playlistTracks = await tx
        .select()
        .from(tracks)
        .where(eq(tracks.playlistId, playlistId))
        .orderBy(tracks.position)

      return {
        id: playlist.id,
        name: playlist.name,
        sourceType: playlist.sourceType,
        trackCount: playlist.trackCount,
        createdAt: playlist.createdAt,
        updatedAt: playlist.updatedAt,
        tracks: playlistTracks.map((track) => ({
          id: track.id,
          title: track.title,
          artist: track.artist,
          durationSeconds: track.durationSeconds,
          sourceType: track.sourceType,
          sourceId: track.sourceId,
          position: track.position,
        })),
      }
    })

    if (!result) {
      return NextResponse.json({ error: 'Playlist not found.' }, { status: 404 })
    }

    const filename = `${result.name.replace(/[^a-z0-9\-_]/gi, '_')}.json`

    return NextResponse.json(result, {
      status: 200,
      headers: {
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Type': 'application/json',
      },
    })
  } catch (err: unknown) {
    const error = err as Error
    return NextResponse.json(
      { error: error.message ?? 'An unexpected error occurred.' },
      { status: 500 }
    )
  }
}
