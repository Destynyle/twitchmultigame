import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { eq, sql } from 'drizzle-orm'
import { createTRPCRouter, protectedProcedure } from '../trpc'
import { withTenantContext } from '@playground/db'
import { playlists, tracks } from '@playground/db/schema'

const FREE_TIER_PLAYLIST_LIMIT = 3

const trackInputSchema = z.object({
  title: z.string().min(1, 'Track title is required'),
  artist: z.string().optional(),
  durationSeconds: z.number().int().positive().optional(),
  sourceType: z.string().optional(),
  sourceId: z.string().optional(),
  position: z.number().int().min(0).optional(),
})

const createPlaylistInputSchema = z.object({
  name: z.string().min(1, 'Playlist name is required'),
  sourceType: z.string().optional().default('manual'),
  tracks: z
    .array(trackInputSchema)
    .min(1, 'At least one track is required'),
})

export const playlistRouter = createTRPCRouter({
  /**
   * Returns all playlists for the current tenant, ordered by creation date desc.
   */
  list: protectedProcedure.query(async ({ ctx }) => {
    const tenantId = ctx.session.user.tenantId
    return withTenantContext(tenantId, async (tx) => {
      return tx
        .select()
        .from(playlists)
        .orderBy(sql`${playlists.createdAt} DESC`)
    })
  }),

  /**
   * Returns a single playlist with its tracks.
   */
  getById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const tenantId = ctx.session.user.tenantId
      return withTenantContext(tenantId, async (tx) => {
        const [playlist] = await tx
          .select()
          .from(playlists)
          .where(eq(playlists.id, input.id))
          .limit(1)

        if (!playlist) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Playlist not found' })
        }

        const playlistTracks = await tx
          .select()
          .from(tracks)
          .where(eq(tracks.playlistId, input.id))
          .orderBy(tracks.position)

        return { ...playlist, tracks: playlistTracks }
      })
    }),

  /**
   * Creates a new playlist with tracks in one transaction.
   * Free tier is limited to 3 playlists; premium has no limit.
   */
  create: protectedProcedure
    .input(createPlaylistInputSchema)
    .mutation(async ({ ctx, input }) => {
      const tenantId = ctx.session.user.tenantId
      const role = ctx.session.user.role

      return withTenantContext(tenantId, async (tx) => {
        // Enforce free-tier playlist limit
        if (role === 'free') {
          const [countResult] = await tx
            .select({ count: sql<number>`count(*)::int` })
            .from(playlists)

          const currentCount = countResult?.count ?? 0
          if (currentCount >= FREE_TIER_PLAYLIST_LIMIT) {
            throw new TRPCError({
              code: 'FORBIDDEN',
              message: `Free tier is limited to ${FREE_TIER_PLAYLIST_LIMIT} playlists. Upgrade to Pro for unlimited playlists.`,
            })
          }
        }

        // Insert the playlist
        const [playlist] = await tx
          .insert(playlists)
          .values({
            tenantId,
            name: input.name,
            sourceType: input.sourceType ?? 'manual',
            trackCount: input.tracks.length,
          })
          .returning()

        if (!playlist) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to create playlist',
          })
        }

        // Insert all tracks
        const trackValues = input.tracks.map((trackInput, index) => ({
          playlistId: playlist.id,
          tenantId,
          title: trackInput.title,
          artist: trackInput.artist ?? null,
          durationSeconds: trackInput.durationSeconds ?? null,
          sourceType: trackInput.sourceType ?? 'manual',
          sourceId: trackInput.sourceId ?? null,
          position: trackInput.position ?? index,
        }))

        const insertedTracks = await tx
          .insert(tracks)
          .values(trackValues)
          .returning()

        return { ...playlist, tracks: insertedTracks }
      })
    }),

  /**
   * Updates a playlist: optionally renames it and/or replaces its track list.
   * If tracks are provided, all existing tracks are deleted and re-inserted.
   */
  update: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1, 'Playlist name is required').optional(),
        tracks: z.array(trackInputSchema).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const tenantId = ctx.session.user.tenantId

      return withTenantContext(tenantId, async (tx) => {
        // Verify playlist exists
        const [existing] = await tx
          .select()
          .from(playlists)
          .where(eq(playlists.id, input.id))
          .limit(1)

        if (!existing) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Playlist not found' })
        }

        // Build update values
        const updateValues: Partial<typeof playlists.$inferInsert> = {
          updatedAt: new Date(),
        }
        if (input.name !== undefined) {
          updateValues.name = input.name.trim()
        }
        if (input.tracks !== undefined) {
          updateValues.trackCount = input.tracks.length
        }

        const [updated] = await tx
          .update(playlists)
          .set(updateValues)
          .where(eq(playlists.id, input.id))
          .returning()

        if (!updated) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to update playlist',
          })
        }

        // Replace tracks if provided
        if (input.tracks !== undefined) {
          await tx.delete(tracks).where(eq(tracks.playlistId, input.id))

          let insertedTracks: (typeof tracks.$inferSelect)[] = []
          if (input.tracks.length > 0) {
            const trackValues = input.tracks.map((trackInput, index) => ({
              playlistId: input.id,
              tenantId,
              title: trackInput.title,
              artist: trackInput.artist ?? null,
              durationSeconds: trackInput.durationSeconds ?? null,
              sourceType: trackInput.sourceType ?? 'manual',
              sourceId: trackInput.sourceId ?? null,
              position: trackInput.position ?? index,
            }))
            insertedTracks = await tx.insert(tracks).values(trackValues).returning()
          }

          return { ...updated, tracks: insertedTracks }
        }

        return updated
      })
    }),

  /**
   * Deletes a playlist (and its tracks via cascade).
   */
  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const tenantId = ctx.session.user.tenantId

      return withTenantContext(tenantId, async (tx) => {
        const [deleted] = await tx
          .delete(playlists)
          .where(eq(playlists.id, input.id))
          .returning()

        if (!deleted) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Playlist not found' })
        }

        return { success: true, id: input.id }
      })
    }),
})
