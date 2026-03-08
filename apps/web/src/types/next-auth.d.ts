import 'next-auth'
import 'next-auth/jwt'

declare module 'next-auth' {
  interface Session {
    user: {
      tenantId: string
      twitchLogin: string
      role: 'free' | 'premium' | 'admin' | 'quarantined'
      subscriptionStatus: 'free' | 'active' | 'past_due' | 'canceled'
    } & DefaultSession['user']
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    tenantId?: string
    twitchLogin?: string
    role?: string
    subscriptionStatus?: string
  }
}
