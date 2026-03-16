import type { NextAuthConfig } from 'next-auth'
import { NextResponse } from 'next/server'

/**
 * Edge-compatible Auth.js v5 config.
 * MUST NOT import @playground/db or any Node.js-only modules.
 * Used by middleware.ts which runs at the edge.
 */
export const authConfig = {
  trustHost: true,
  pages: {
    signIn: '/signin',
    error: '/error',
  },
  providers: [],
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user
      const pathname = nextUrl.pathname
      const isProtected =
        pathname.startsWith('/sessions') ||
        pathname.startsWith('/playlists') ||
        pathname.startsWith('/settings') ||
        pathname.startsWith('/admin')
      const isAdminRoute = pathname.startsWith('/admin')

      if (isProtected && !isLoggedIn) {
        const signInUrl = new URL('/signin', nextUrl.origin)
        signInUrl.searchParams.set('callbackUrl', pathname)
        return NextResponse.redirect(signInUrl)
      }

      if (isAdminRoute && auth?.user?.role !== 'admin') {
        return NextResponse.redirect(new URL('/sessions', nextUrl.origin))
      }

      return true
    },
  },
} satisfies NextAuthConfig
