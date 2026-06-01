import NextAuth from 'next-auth'
import Twitch from 'next-auth/providers/twitch'
import { eq } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import { db, withTenantContext } from '@playground/db'
import { tenants, users, oauthTokens } from '@playground/db/schema'
import { env } from '@playground/shared/env'
import { encrypt } from '@playground/shared/utils/encrypt'
import { authConfig } from './auth.config'

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  debug: true,
  secret: env.AUTH_SECRET,
  session: { strategy: 'jwt' },
  providers: [
    Twitch({
      clientId: env.TWITCH_CLIENT_ID,
      clientSecret: env.TWITCH_CLIENT_SECRET,
      authorization: {
        params: { scope: 'openid user:read:email chat:read chat:edit' },
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,

    /**
     * Runs on every sign-in attempt.
     * Provisions tenant + user on first login; upserts OAuth token.
     * Uses db directly (bypasses RLS) — provisioning is an admin operation.
     */
    async signIn({ account, profile }) {
      if (!profile?.sub || !account?.access_token) return false

      const twitchId = profile.sub
      const twitchLogin =
        (profile as { preferred_username?: string }).preferred_username ??
        twitchId
      const displayName = (profile.name as string | undefined) ?? twitchLogin

      // Check if tenant already exists (including soft-deleted)
      const existing = await db
        .select({ id: tenants.id, deletedAt: tenants.deletedAt })
        .from(tenants)
        .where(eq(tenants.twitchId, twitchId))

      let tenantId: string

      if (existing.length > 0 && existing[0]!.deletedAt !== null) {
        // AC3: Account in grace period — redirect to reactivation page.
        // Returning a URL from signIn allows sign-in AND redirects to that URL.
        return '/auth/reactivate'
      }

      if (existing.length === 0) {
        // First login — provision tenant + user
        // Use withTenantContext so app.current_tenant_id is set during INSERT,
        // satisfying the tenants_self_isolation RLS policy's WITH CHECK.
        const newTenantId = randomUUID()
        await withTenantContext(newTenantId, async (tx) => {
          await tx.insert(tenants).values({ id: newTenantId, twitchId, twitchLogin, displayName })
          await tx.insert(users).values({
            tenantId: newTenantId,
            twitchId,
            role: 'free',
            subscriptionStatus: 'free',
          })
        })
        tenantId = newTenantId
      } else {
        tenantId = existing[0]!.id
      }

      // Encrypt and upsert Twitch OAuth token
      const encryptedAccess = encrypt(account.access_token, env.TOKEN_ENCRYPTION_KEY)
      const encryptedRefresh = account.refresh_token
        ? encrypt(account.refresh_token, env.TOKEN_ENCRYPTION_KEY)
        : null
      const expiresAt = account.expires_at
        ? new Date(account.expires_at * 1000)
        : null

      await withTenantContext(tenantId, async (tx) => {
        await tx
          .insert(oauthTokens)
          .values({
            tenantId,
            provider: 'twitch',
            encryptedAccessToken: encryptedAccess,
            encryptedRefreshToken: encryptedRefresh,
            expiresAt,
          })
          .onConflictDoUpdate({
            target: [oauthTokens.tenantId, oauthTokens.provider],
            set: {
              encryptedAccessToken: encryptedAccess,
              encryptedRefreshToken: encryptedRefresh,
              expiresAt,
            },
          })
      })

      return true
    },

    /**
     * Populates JWT with tenant-specific claims on first sign-in.
     * On subsequent calls token.tenantId is already persisted in the JWT.
     */
    async jwt({ token, trigger, profile }) {
      if (trigger === 'signIn' && profile?.sub) {
        const twitchId = profile.sub
        const [tenant] = await db
          .select({ id: tenants.id })
          .from(tenants)
          .where(eq(tenants.twitchId, twitchId))

        if (tenant) {
          const [userRow] = await db
            .select({
              role: users.role,
              subscriptionStatus: users.subscriptionStatus,
            })
            .from(users)
            .where(eq(users.tenantId, tenant.id))

          const [tenantRow] = await db
            .select({ twitchLogin: tenants.twitchLogin })
            .from(tenants)
            .where(eq(tenants.id, tenant.id))

          token.tenantId = tenant.id
          token.twitchLogin = tenantRow?.twitchLogin ?? ''
          token.role = userRow?.role ?? 'free'
          token.subscriptionStatus = userRow?.subscriptionStatus ?? 'free'
        }
      }
      return token
    },

    /** Exposes JWT claims to the session object (accessible in server components). */
    async session({ session, token }) {
      // If tenantId is missing the JWT is malformed — reject the session
      if (!token.tenantId) return session
      session.user.tenantId = token.tenantId as string
      session.user.twitchLogin = token.twitchLogin as string
      session.user.role = (token.role as 'free' | 'premium' | 'admin' | 'quarantined') ?? 'free'
      session.user.subscriptionStatus =
        (token.subscriptionStatus as
          | 'free'
          | 'active'
          | 'past_due'
          | 'canceled') ?? 'free'
      return session
    },
  },
})
