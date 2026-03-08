import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { eq, and, desc } from 'drizzle-orm'
import { createTRPCRouter, protectedProcedure } from '../trpc'
import { withTenantContext } from '@playground/db'
import { sessions } from '@playground/db/schema'

export const sessionRouter = createTRPCRouter({
  // List all sessions for the tenant (newest first)
  list: protectedProcedure.query(async ({ ctx }) => {
    const tenantId = ctx.session.user.tenantId
    return withTenantContext(tenantId, async (tx) => {
      return tx.select().from(sessions).orderBy(desc(sessions.createdAt))
    })
  }),

  // Get one session by id
  getById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const tenantId = ctx.session.user.tenantId
      return withTenantContext(tenantId, async (tx) => {
        const [session] = await tx.select().from(sessions).where(eq(sessions.id, input.id))
        if (!session) throw new TRPCError({ code: 'NOT_FOUND' })
        return session
      })
    }),

  // Create a new session in 'pending' state
  create: protectedProcedure
    .input(z.object({
      gameType: z.enum(['blindtest', 'quiz']),
      playlistId: z.string().uuid(),
      isTestMode: z.boolean().default(false),
    }))
    .mutation(async ({ ctx, input }) => {
      const tenantId = ctx.session.user.tenantId
      return withTenantContext(tenantId, async (tx) => {
        const [session] = await tx.insert(sessions).values({
          tenantId,
          gameType: input.gameType,
          playlistId: input.playlistId,
          status: 'pending',
          isTestMode: input.isTestMode ? 'true' : 'false',
        }).returning()
        if (!session) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' })
        return session
      })
    }),

  // Launch: pending → active
  launch: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const tenantId = ctx.session.user.tenantId
      return withTenantContext(tenantId, async (tx) => {
        const [session] = await tx.update(sessions)
          .set({ status: 'active', startedAt: new Date() })
          .where(and(eq(sessions.id, input.id), eq(sessions.status, 'pending')))
          .returning()
        if (!session) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Session cannot be launched' })
        return session
      })
    }),

  // Pause: active → paused
  pause: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const tenantId = ctx.session.user.tenantId
      return withTenantContext(tenantId, async (tx) => {
        const [session] = await tx.update(sessions)
          .set({ status: 'paused' })
          .where(and(eq(sessions.id, input.id), eq(sessions.status, 'active')))
          .returning()
        if (!session) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Session is not active' })
        return session
      })
    }),

  // Resume: paused → active
  resume: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const tenantId = ctx.session.user.tenantId
      return withTenantContext(tenantId, async (tx) => {
        const [session] = await tx.update(sessions)
          .set({ status: 'active' })
          .where(and(eq(sessions.id, input.id), eq(sessions.status, 'paused')))
          .returning()
        if (!session) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Session is not paused' })
        return session
      })
    }),

  // End: active|paused → ended
  end: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const tenantId = ctx.session.user.tenantId
      return withTenantContext(tenantId, async (tx) => {
        const [session] = await tx.update(sessions)
          .set({ status: 'ended', endedAt: new Date() })
          .where(eq(sessions.id, input.id))
          .returning()
        if (!session) throw new TRPCError({ code: 'NOT_FOUND' })
        return session
      })
    }),

  // Advance to next track
  nextTrack: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const tenantId = ctx.session.user.tenantId
      return withTenantContext(tenantId, async (tx) => {
        const [current] = await tx.select({ idx: sessions.currentTrackIndex })
          .from(sessions).where(eq(sessions.id, input.id))
        if (!current) throw new TRPCError({ code: 'NOT_FOUND' })
        const [updated] = await tx.update(sessions)
          .set({ currentTrackIndex: current.idx + 1 })
          .where(eq(sessions.id, input.id))
          .returning()
        return updated
      })
    }),
})
