import { initTRPC, TRPCError } from '@trpc/server'
import superjson from 'superjson'
import { auth } from '~/server/auth'
import { db } from '@playground/db'

/** Build tRPC context — session + db available in all procedures. */
export async function createTRPCContext() {
  const session = await auth()
  return { session, db }
}

export type TRPCContext = Awaited<ReturnType<typeof createTRPCContext>>

const t = initTRPC.context<TRPCContext>().create({
  transformer: superjson,
})

export const createTRPCRouter = t.router
export const publicProcedure = t.procedure

/**
 * Protected procedure — requires a valid session with tenantId.
 * Throws UNAUTHORIZED if the caller is not authenticated.
 */
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.session?.user?.tenantId) {
    throw new TRPCError({ code: 'UNAUTHORIZED' })
  }
  return next({
    ctx: {
      ...ctx,
      // narrowed: session is definitely non-null here
      session: ctx.session,
    },
  })
})
