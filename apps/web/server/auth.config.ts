import type { NextAuthConfig } from 'next-auth'
import { NextResponse } from 'next/server'

/**
 * Edge-compatible Auth.js v5 config.
 * MUST NOT import @playground/db or any Node.js-only modules.
 * Used by middleware.ts which runs at the edge.
 */
export const authConfig = {
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },
  providers: [],
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user
      const isDashboard = nextUrl.pathname.startsWith('/dashboard')
      const isAdminRoute = nextUrl.pathname.startsWith('/dashboard/admin')

      if (isDashboard && !isLoggedIn) {
        const signInUrl = new URL('/auth/signin', nextUrl.origin)
        signInUrl.searchParams.set('callbackUrl', nextUrl.pathname)
        return NextResponse.redirect(signInUrl)
      }

      if (isAdminRoute && auth?.user?.role !== 'admin') {
        return NextResponse.redirect(new URL('/dashboard', nextUrl.origin))
      }

      return true
    },
  },
} satisfies NextAuthConfig
