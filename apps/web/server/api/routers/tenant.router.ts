import { eq } from 'drizzle-orm'
import { db } from '@playground/db'
import { tenants } from '@playground/db/schema'
import { createTRPCRouter, protectedProcedure } from '../trpc'
import { customAlphabet } from 'nanoid'

const nanoid = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 6)

export const tenantRouter = createTRPCRouter({
  /** Returns the current authenticated user's session info. */
  getMe: protectedProcedure.query(({ ctx }) => {
    return ctx.session.user
  }),

  /**
   * Soft-deletes the authenticated tenant's account by setting `deleted_at = NOW()`.
   * The session must be explicitly destroyed client-side via signOut() after calling this.
   */
  deleteAccount: protectedProcedure.mutation(async ({ ctx }) => {
    const tenantId = ctx.session.user.tenantId
    await db
      .update(tenants)
      .set({ deletedAt: new Date() })
      .where(eq(tenants.id, tenantId))
  }),

  /**
   * Restores a soft-deleted account by clearing `deleted_at`.
   * Only callable while the user still has a valid session (within the grace period).
   */
  reactivateAccount: protectedProcedure.mutation(async ({ ctx }) => {
    const tenantId = ctx.session.user.tenantId
    await db
      .update(tenants)
      .set({ deletedAt: null })
      .where(eq(tenants.id, tenantId))
  }),

  /**
   * Returns the current tenant's overlay token, generating and persisting one
   * if it doesn't exist yet. Safe to call on every page load.
   */
  getOrCreateOverlayToken: protectedProcedure.mutation(async ({ ctx }) => {
    const tenantId = ctx.session.user.tenantId
    const [tenant] = await db
      .select({ overlayToken: tenants.overlayToken })
      .from(tenants)
      .where(eq(tenants.id, tenantId))
    if (!tenant) throw new Error('Tenant not found')

    if (tenant.overlayToken) return { token: tenant.overlayToken }

    const token = nanoid()
    await db
      .update(tenants)
      .set({ overlayToken: token })
      .where(eq(tenants.id, tenantId))
    return { token }
  }),
})
