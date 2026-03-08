import NextAuth from 'next-auth'
import { authConfig } from '~/server/auth.config'

/**
 * Uses the edge-compatible auth config (no DB imports).
 * The `authorized` callback in authConfig handles dashboard protection.
 * Unauthenticated requests to /dashboard/* are redirected to /signin.
 */
const { auth } = NextAuth(authConfig)

export default auth

export const config = {
  // Run middleware on all paths except Next.js internals and static assets
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
