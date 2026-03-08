'use server'

import { auth } from '~/server/auth'
import { withTenantContext } from '@playground/db'
import { playlists, tracks } from '@playground/db/schema'
import { sql } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

const FREE_TIER_PLAYLIST_LIMIT = 3

export type TrackInput = {
  title: string
  artist?: string
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
    redirect('/auth/signin')
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
