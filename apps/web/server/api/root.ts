import { createTRPCRouter } from './trpc'
import { tenantRouter } from './routers/tenant.router'
import { playlistRouter } from './routers/playlist.router'

export const appRouter = createTRPCRouter({
  tenant: tenantRouter,
  playlist: playlistRouter,
})

export type AppRouter = typeof appRouter
