import { createTRPCRouter } from './trpc'
import { tenantRouter } from './routers/tenant.router'
import { playlistRouter } from './routers/playlist.router'
import { sessionRouter } from './routers/session.router'

export const appRouter = createTRPCRouter({
  tenant: tenantRouter,
  playlist: playlistRouter,
  session: sessionRouter,
})

export type AppRouter = typeof appRouter
