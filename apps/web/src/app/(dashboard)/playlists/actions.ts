'use server'

import { auth } from '~/server/auth'
import { withTenantContext } from '@playground/db'
import { playlists, tracks } from '@playground/db/schema'
import { sql, eq } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

const FREE_TIER_PLAYLIST_LIMIT = 3

export type TrackInput = {
  title: string
  artist?: string
  durationSeconds?: number
  sourceType?: string
  sourceId?: string
  position?: number
}

export type CreatePlaylistResult =
  | { success: true; playlistId: string }
  | { success: false; error: string; upgradeRequired?: boolean }

/**
 * Server Action: creates a new playlist with tracks.
 * Enforces free-tier limit (max 3 playlists).
 * Validates that every track has a title.
 */
export async function createPlaylistAction(
  name: string,
  trackInputs: TrackInput[]
): Promise<CreatePlaylistResult> {
  const session = await auth()
  if (!session?.user?.tenantId) {
    redirect('/signin')
  }

  const tenantId = session.user.tenantId
  const role = session.user.role

  // Validate playlist name
  if (!name || name.trim().length === 0) {
    return { success: false, error: 'Playlist name is required.' }
  }

  // Validate tracks
  if (!trackInputs || trackInputs.length === 0) {
    return { success: false, error: 'At least one track is required.' }
  }

  for (let i = 0; i < trackInputs.length; i++) {
    const track = trackInputs[i]
    if (!track || !track.title || track.title.trim().length === 0) {
      return {
        success: false,
        // Track title is required
        error: `Track ${i + 1}: title is required.`,
      }
    }
  }

  try {
    const playlist = await withTenantContext(tenantId, async (tx) => {
      // Enforce free-tier limit
      if (role === 'free') {
        const [countResult] = await tx
          .select({ count: sql<number>`count(*)::int` })
          .from(playlists)

        const currentCount = countResult?.count ?? 0
        if (currentCount >= FREE_TIER_PLAYLIST_LIMIT) {
          // Using a special error signal to distinguish upgrade prompt
          throw Object.assign(
            new Error(
              `Free tier is limited to ${FREE_TIER_PLAYLIST_LIMIT} playlists. Upgrade to Pro for unlimited playlists.`
            ),
            { upgradeRequired: true }
          )
        }
      }

      // Insert playlist
      const [newPlaylist] = await tx
        .insert(playlists)
        .values({
          tenantId,
          name: name.trim(),
          sourceType: 'manual',
          trackCount: trackInputs.length,
        })
        .returning()

      if (!newPlaylist) {
        throw new Error('Failed to create playlist.')
      }

      // Insert tracks
      const trackValues = trackInputs.map((track, index) => ({
        playlistId: newPlaylist.id,
        tenantId,
        title: track.title.trim(),
        artist: track.artist?.trim() ?? null,
        sourceType: 'manual',
        position: index,
      }))

      await tx.insert(tracks).values(trackValues)

      return newPlaylist
    })

    revalidatePath('/playlists')
    return { success: true, playlistId: playlist.id }
  } catch (err: unknown) {
    const error = err as Error & { upgradeRequired?: boolean }
    if (error.upgradeRequired) {
      return {
        success: false,
        error: error.message,
        upgradeRequired: true,
      }
    }
    return {
      success: false,
      error: error.message ?? 'An unexpected error occurred.',
    }
  }
}

export type DeletePlaylistResult =
  | { success: true; id: string }
  | { success: false; error: string }

/**
 * Server Action: deletes a playlist and all its tracks.
 */
export async function deletePlaylistAction(
  playlistId: string
): Promise<DeletePlaylistResult> {
  const session = await auth()
  if (!session?.user?.tenantId) {
    redirect('/signin')
  }

  const tenantId = session.user.tenantId

  if (!playlistId) {
    return { success: false, error: 'Playlist ID is required.' }
  }

  try {
    await withTenantContext(tenantId, async (tx) => {
      const [deleted] = await tx
        .delete(playlists)
        .where(eq(playlists.id, playlistId))
        .returning()

      if (!deleted) {
        throw new Error('Playlist not found.')
      }
    })

    revalidatePath('/playlists')
    return { success: true, id: playlistId }
  } catch (err: unknown) {
    const error = err as Error
    return {
      success: false,
      error: error.message ?? 'An unexpected error occurred.',
    }
  }
}

export type UpdatePlaylistResult =
  | { success: true; playlistId: string }
  | { success: false; error: string }

/**
 * Server Action: renames a playlist and/or replaces its track list.
 */
export async function updatePlaylistAction(data: {
  id: string
  name?: string
  tracks?: TrackInput[]
}): Promise<UpdatePlaylistResult> {
  const session = await auth()
  if (!session?.user?.tenantId) {
    redirect('/signin')
  }

  const tenantId = session.user.tenantId

  if (!data.id) {
    return { success: false, error: 'Playlist ID is required.' }
  }

  if (data.name !== undefined && data.name.trim().length === 0) {
    return { success: false, error: 'Playlist name cannot be empty.' }
  }

  if (data.tracks !== undefined) {
    if (data.tracks.length === 0) {
      return { success: false, error: 'At least one track is required.' }
    }
    for (let i = 0; i < data.tracks.length; i++) {
      const track = data.tracks[i]
      if (!track || !track.title || track.title.trim().length === 0) {
        return {
          success: false,
          error: `Track ${i + 1}: title is required.`,
        }
      }
    }
  }

  try {
    await withTenantContext(tenantId, async (tx) => {
      // Verify the playlist exists
      const [existing] = await tx
        .select()
        .from(playlists)
        .where(eq(playlists.id, data.id))
        .limit(1)

      if (!existing) {
        throw new Error('Playlist not found.')
      }

      // Build update values
      const updateValues: Record<string, unknown> = { updatedAt: new Date() }
      if (data.name !== undefined) {
        updateValues.name = data.name.trim()
      }
      if (data.tracks !== undefined) {
        updateValues.trackCount = data.tracks.length
      }

      await tx
        .update(playlists)
        .set(updateValues)
        .where(eq(playlists.id, data.id))

      // Replace tracks if provided
      if (data.tracks !== undefined) {
        await tx.delete(tracks).where(eq(tracks.playlistId, data.id))

        if (data.tracks.length > 0) {
          const trackValues = data.tracks.map((track, index) => ({
            playlistId: data.id,
            tenantId,
            title: track.title.trim(),
            artist: track.artist?.trim() ?? null,
            durationSeconds: track.durationSeconds ?? null,
            sourceType: track.sourceType ?? 'manual',
            sourceId: track.sourceId ?? null,
            position: track.position ?? index,
          }))
          await tx.insert(tracks).values(trackValues)
        }
      }
    })

    revalidatePath('/playlists')
    return { success: true, playlistId: data.id }
  } catch (err: unknown) {
    const error = err as Error
    return {
      success: false,
      error: error.message ?? 'An unexpected error occurred.',
    }
  }
}
