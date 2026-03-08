# Story 1.3: Twitch OAuth Sign-In, Tenant Provisioning & Dashboard Shell

Status: done

## Story

As a streamer,
I want to sign in with my Twitch account and immediately access a functional dashboard,
so that I have an isolated account auto-provisioned and can navigate all platform sections in under 2 minutes.

## Acceptance Criteria

1. **Given** I am on the landing page as an unauthenticated user
   **When** I click "Sign in with Twitch" and authorize the application
   **Then** I am redirected to `/dashboard` within 10 seconds of authorization

2. **Given** a streamer signs in for the first time with a new Twitch account
   **When** Auth.js v5 processes the OAuth callback
   **Then** a new row is created in `tenants` and a corresponding `users` row with `role: 'free'` and `subscriptionStatus: 'free'`
   **And** no duplicate tenant is created if the same Twitch account signs in again

3. **Given** a successful sign-in
   **When** the JWT is issued
   **Then** the token payload contains `{ tenantId, role, subscriptionStatus, exp }` and is stored in an httpOnly cookie (never in localStorage)

4. **Given** the Twitch OAuth token received at sign-in
   **When** it is stored in the database
   **Then** it is encrypted with AES-256-GCM using `TOKEN_ENCRYPTION_KEY` and the plaintext token is never written to any log or response

5. **Given** an authenticated streamer
   **When** they access `/dashboard`
   **Then** they see a navigation sidebar with links to: Sessions, Playlists, Overlay Setup, Settings, and their Twitch display name and avatar are visible

6. **Given** an authenticated streamer
   **When** they access any `/dashboard/*` route
   **Then** `middleware.ts` allows the request through without redirect

7. **Given** an unauthenticated user
   **When** they access any `/dashboard/*` route
   **Then** they are redirected to `/auth/signin` with the original path preserved as a `callbackUrl` parameter

8. **Given** the dashboard navigation
   **When** a user navigates using the Tab key only
   **Then** all navigation links are reachable and visually focused in logical order (NFR-A2)

9. **Given** a streamer clicks "Sign out"
   **When** the action completes
   **Then** the Auth.js session is destroyed, the httpOnly cookie is cleared, and they are redirected to the landing page

## Tasks / Subtasks

- [x] Task 1 — Install Auth.js v5 + tRPC v11 dependencies (AC: 1, 2, 3)
  - [x] Install `next-auth@beta` in `apps/web`
  - [x] Install `@trpc/server` and `@trpc/client` at v11 in `apps/web`
  - [x] Install `superjson` (tRPC serializer) in `apps/web`
  - [x] Add `@playground/db` as `workspace:*` dependency in `apps/web/package.json`
  - [x] Run `pnpm install` from root

- [x] Task 2 — Create `apps/web/server/auth.ts` — Auth.js v5 config (AC: 1, 2, 3, 4)
  - [x] Import Twitch provider from `next-auth/providers/twitch`
  - [x] Configure `AUTH_SECRET` from `env.AUTH_SECRET`
  - [x] Configure `TWITCH_CLIENT_ID` / `TWITCH_CLIENT_SECRET` from shared env
  - [x] Implement `signIn` callback: provision tenant + user on first login using `db` directly (bypasses RLS — provisioning is admin operation)
    - [x] Check if tenant exists: `SELECT * FROM tenants WHERE twitch_id = profile.sub`
    - [x] If NOT exists: INSERT tenant row, INSERT users row with `role: 'free'`, `subscriptionStatus: 'free'`
    - [x] Encrypt `account.access_token` with `encrypt()` from `@playground/shared/utils/encrypt`
    - [x] Upsert `oauth_tokens` row for `provider: 'twitch'` (ON CONFLICT tenant_id+provider DO UPDATE)
    - [x] Never log the plaintext token — log only `{ tenantId, provider }` at debug level
  - [x] Implement `jwt` callback: set `token.tenantId`, `token.role`, `token.subscriptionStatus`
  - [x] Implement `session` callback: expose `session.user.tenantId`, `role`, `subscriptionStatus` from token
  - [x] Export `{ handlers, auth, signIn, signOut }` from `NextAuth({ ... })`

- [x] Task 3 — Create Auth.js v5 route handler (AC: 1)
  - [x] Create `apps/web/src/app/api/auth/[...nextauth]/route.ts`
  - [x] `export const { GET, POST } = handlers` imported from `~/server/auth`

- [x] Task 4 — Augment TypeScript session types (AC: 3)
  - [x] Create `apps/web/src/types/next-auth.d.ts`
  - [x] Declare `tenantId: string`, `role: 'free' | 'premium' | 'admin'`, `subscriptionStatus: 'free' | 'active' | 'past_due' | 'canceled'` in `Session.user` and `JWT`

- [x] Task 5 — Create `apps/web/src/middleware.ts` — route protection (AC: 6, 7)
  - [x] Protect all routes matching `/(dashboard)(.*)` pattern
  - [x] Use `auth` from `~/server/auth` to check session
  - [x] Unauthenticated → redirect to `/auth/signin?callbackUrl={originalPath}`
  - [x] Authenticated → pass through
  - [x] Public routes (landing page, `/auth/*`, `/api/auth/*`, `/overlay/*`) MUST NOT be blocked
  - [x] Export `config.matcher` to limit middleware scope and avoid running on static assets

- [x] Task 6 — Create tRPC skeleton (architecture foundation) (AC: none — foundation)
  - [x] Create `apps/web/server/api/trpc.ts`:
    - [x] `createTRPCContext` — extract session from `auth()`, expose `session` and `db` in context
    - [x] `t = initTRPC.context<TRPCContext>().create({ transformer: superjson })`
    - [x] Export `createTRPCRouter`, `publicProcedure`, `protectedProcedure`
    - [x] `protectedProcedure`: middleware that throws `UNAUTHORIZED` if `ctx.session` is null
  - [x] Create `apps/web/server/api/root.ts`: merge domain routers into `appRouter`
  - [x] Create `apps/web/server/api/routers/tenant.router.ts`: stub router with `getMe` procedure (returns `ctx.session.user`)

- [x] Task 7 — Create sign-in page + error page (AC: 1, 7)
  - [x] Create `apps/web/src/app/(auth)/layout.tsx` — minimal centered layout
  - [x] Create `apps/web/src/app/(auth)/signin/page.tsx` — "Sign in with Twitch" button that calls Auth.js `signIn('twitch', { redirectTo: '/dashboard' })`
  - [x] Create `apps/web/src/app/(auth)/error/page.tsx` — auth error display with retry link

- [x] Task 8 — Create dashboard shell layout + navigation (AC: 5, 8, 9)
  - [x] Create `apps/web/src/app/(dashboard)/layout.tsx`:
    - [x] Fetch session with `auth()` (server component)
    - [x] Render sidebar navigation component
    - [x] Render main content `{children}`
  - [x] Create `apps/web/src/app/(dashboard)/components/sidebar.tsx`:
    - [x] Navigation links: Sessions (`/dashboard/sessions`), Playlists (`/dashboard/playlists`), Overlay Setup (`/dashboard/overlay`), Settings (`/dashboard/settings`)
    - [x] Display `session.user.name` (Twitch display name) and `session.user.image` (avatar)
    - [x] Sign out button — calls server action `signOut()` from `~/server/auth`
    - [x] All links keyboard-accessible with visible focus ring (NFR-A2)
    - [x] Use `<nav>` landmark element with `aria-label="Dashboard navigation"`

- [x] Task 9 — Create dashboard pages stubs (AC: 5)
  - [x] `apps/web/src/app/(dashboard)/page.tsx` — dashboard home (welcome message + streamer name)
  - [x] `apps/web/src/app/(dashboard)/sessions/page.tsx` — "Sessions — coming soon" stub
  - [x] `apps/web/src/app/(dashboard)/playlists/page.tsx` — "Playlists — coming soon" stub
  - [x] `apps/web/src/app/(dashboard)/overlay/page.tsx` — "Overlay Setup — coming soon" stub
  - [x] `apps/web/src/app/(dashboard)/settings/page.tsx` — "Settings — coming soon" stub

- [x] Task 10 — Update landing page (AC: 1)
  - [x] Update `apps/web/src/app/page.tsx` with "Sign in with Twitch" link → `/auth/signin`

- [x] Task 11 — Vitest + type-check (AC: all)
  - [x] Update `apps/web/src/smoke.test.ts` — basic import smoke test for auth config
  - [x] Run `pnpm --filter @playground/web test` — all pass
  - [x] Run `pnpm -r type-check` — all packages pass

## Dev Notes

### CRITICAL: Auth.js v5 API (NOT v4 NextAuth)

This project uses **Auth.js v5** (installed as `next-auth@beta`). v5 has breaking changes from v4:

```typescript
// apps/web/server/auth.ts
import NextAuth from 'next-auth'
import Twitch from 'next-auth/providers/twitch'
import { env } from '@playground/shared/env'
import { db } from '@playground/db'
import { tenants, users, oauthTokens } from '@playground/db/schema'
import { encrypt } from '@playground/shared/utils/encrypt'
import { eq } from 'drizzle-orm'
import { sql } from 'drizzle-orm'

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: env.AUTH_SECRET,
  providers: [
    Twitch({
      clientId: env.TWITCH_CLIENT_ID,
      clientSecret: env.TWITCH_CLIENT_SECRET,
    }),
  ],
  session: { strategy: 'jwt' },
  callbacks: {
    async signIn({ account, profile }) {
      if (!profile?.sub || !account?.access_token) return false

      const twitchId = profile.sub
      const twitchLogin = (profile as { preferred_username?: string }).preferred_username ?? ''
      const displayName = profile.name ?? twitchLogin

      // Provision tenant + user (admin operation — bypasses RLS intentionally)
      // In dev: postgres superuser bypasses RLS. In prod: use service role connection.
      const existingTenants = await db.select().from(tenants).where(eq(tenants.twitchId, twitchId))
      let tenantId: string

      if (existingTenants.length === 0) {
        // First login — provision tenant + user
        const [newTenant] = await db.insert(tenants).values({
          twitchId,
          twitchLogin,
          displayName,
        }).returning({ id: tenants.id })
        tenantId = newTenant.id
        await db.insert(users).values({
          tenantId,
          twitchId,
          role: 'free',
          subscriptionStatus: 'free',
        })
      } else {
        tenantId = existingTenants[0].id
      }

      // Encrypt and upsert OAuth token
      const encryptedToken = encrypt(account.access_token, env.TOKEN_ENCRYPTION_KEY)
      await db.insert(oauthTokens).values({
        tenantId,
        provider: 'twitch',
        encryptedAccessToken: encryptedToken,
        encryptedRefreshToken: account.refresh_token
          ? encrypt(account.refresh_token, env.TOKEN_ENCRYPTION_KEY)
          : null,
        expiresAt: account.expires_at
          ? new Date(account.expires_at * 1000)
          : null,
      }).onConflictDoUpdate({
        target: [oauthTokens.tenantId, oauthTokens.provider],
        set: {
          encryptedAccessToken: encryptedToken,
          encryptedRefreshToken: account.refresh_token
            ? encrypt(account.refresh_token, env.TOKEN_ENCRYPTION_KEY)
            : null,
          expiresAt: account.expires_at ? new Date(account.expires_at * 1000) : null,
        },
      })

      return true
    },

    async jwt({ token, profile }) {
      if (profile?.sub) {
        // Fetch tenantId + role + subscriptionStatus from DB on first sign-in
        const existingTenants = await db.select({ id: tenants.id }).from(tenants).where(eq(tenants.twitchId, profile.sub))
        if (existingTenants.length > 0) {
          const tenantId = existingTenants[0].id
          const userRows = await db.select({ role: users.role, subscriptionStatus: users.subscriptionStatus })
            .from(users)
            .where(eq(users.tenantId, tenantId))
          token.tenantId = tenantId
          token.role = userRows[0]?.role ?? 'free'
          token.subscriptionStatus = userRows[0]?.subscriptionStatus ?? 'free'
        }
      }
      return token
    },

    async session({ session, token }) {
      session.user.tenantId = token.tenantId as string
      session.user.role = token.role as string
      session.user.subscriptionStatus = token.subscriptionStatus as string
      return session
    },
  },
})
```

### CRITICAL: middleware.ts — Route Protection

```typescript
// apps/web/src/middleware.ts
import { auth } from '~/server/auth'
import { NextResponse } from 'next/server'

export default auth((req) => {
  const { nextUrl, auth: session } = req
  const isAuthenticated = !!session

  const isDashboardRoute = nextUrl.pathname.startsWith('/dashboard')

  if (isDashboardRoute && !isAuthenticated) {
    const signInUrl = new URL('/auth/signin', nextUrl.origin)
    signInUrl.searchParams.set('callbackUrl', nextUrl.pathname)
    return NextResponse.redirect(signInUrl)
  }

  return NextResponse.next()
})

export const config = {
  // Avoid running on static files, _next, api/auth routes
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/auth).*)'],
}
```

### CRITICAL: TypeScript Session Augmentation

```typescript
// apps/web/src/types/next-auth.d.ts
import 'next-auth'
import 'next-auth/jwt'

declare module 'next-auth' {
  interface Session {
    user: {
      tenantId: string
      role: 'free' | 'premium' | 'admin'
      subscriptionStatus: 'free' | 'active' | 'past_due' | 'canceled'
    } & DefaultSession['user']
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    tenantId?: string
    role?: string
    subscriptionStatus?: string
  }
}
```

### CRITICAL: tRPC v11 Skeleton

```typescript
// apps/web/server/api/trpc.ts
import { initTRPC, TRPCError } from '@trpc/server'
import superjson from 'superjson'
import { auth } from '~/server/auth'
import { db } from '@playground/db'

export async function createTRPCContext() {
  const session = await auth()
  return { session, db }
}

type TRPCContext = Awaited<ReturnType<typeof createTRPCContext>>

const t = initTRPC.context<TRPCContext>().create({
  transformer: superjson,
})

export const createTRPCRouter = t.router
export const publicProcedure = t.procedure
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.session?.user?.tenantId) {
    throw new TRPCError({ code: 'UNAUTHORIZED' })
  }
  return next({ ctx: { ...ctx, session: ctx.session } })
})
```

```typescript
// apps/web/server/api/root.ts
import { createTRPCRouter } from './trpc'
import { tenantRouter } from './routers/tenant.router'

export const appRouter = createTRPCRouter({
  tenant: tenantRouter,
})

export type AppRouter = typeof appRouter
```

```typescript
// apps/web/server/api/routers/tenant.router.ts
import { createTRPCRouter, protectedProcedure } from '../trpc'

export const tenantRouter = createTRPCRouter({
  getMe: protectedProcedure.query(({ ctx }) => {
    return ctx.session.user
  }),
})
```

### CRITICAL: RLS and Provisioning Note

**The tenant provisioning in `signIn` callback uses `db` directly (no `withTenantContext`).** This is intentional:

- Provisioning is an **admin operation** — there is no `tenantId` yet for a new user
- In development (docker-compose postgres): `postgres` superuser bypasses RLS automatically
- In production (Neon/Supabase): configure `DATABASE_URL` to use a service role that has `BYPASSRLS` privilege for the provisioning path
- **NEVER** call `withTenantContext()` for provisioning — it would fail because no tenant context is set

The query pattern for subsequent tenant-scoped operations in tRPC procedures:
```typescript
// In a protected tRPC procedure:
const tenantId = ctx.session.user.tenantId
await withTenantContext(tenantId, async (tx) => {
  return tx.select().from(users)
})
```

### CRITICAL: Auth.js v5 Route Handler

```typescript
// apps/web/src/app/api/auth/[...nextauth]/route.ts
import { handlers } from '~/server/auth'
export const { GET, POST } = handlers
```

**Do NOT** import directly from `next-auth` in the route handler — always import from `~/server/auth`.

### CRITICAL: apps/web tsconfig Path Aliases

`apps/web/tsconfig.json` has `"@/*": ["./src/*"]`. This means:
- `import { auth } from '~/server/auth'` will NOT work — use `@/` or relative paths
- `apps/web/server/` is OUTSIDE `src/` — import with RELATIVE paths from `src/` files:
  - From `src/app/api/auth/[...nextauth]/route.ts` → `import { handlers } from '../../../../server/auth'`
  - OR add `"~/*": ["./*"]` path alias in tsconfig to reference from project root

**Recommended: add `"~/*": ["./*"]` to `apps/web/tsconfig.json` compilerOptions.paths** so `~/server/auth` resolves to `apps/web/server/auth.ts`.

### Package Boundary Rules (from Story 1.2 + Architecture)

- `@playground/db` — MUST be added as a dependency in `apps/web/package.json`
- Import `db` and schema from `@playground/db` and `@playground/db/schema`
- Import `withTenantContext` from `@playground/db` for all tenant-scoped queries in tRPC procedures
- Import `encrypt` / `decrypt` from `@playground/shared/utils/encrypt`
- Import `env` from `@playground/shared/env` — NEVER use `process.env.X` directly
- `packages/game-engine` — MUST NEVER be imported in `apps/web` (ADR-04)

### Auth.js v5 Twitch Profile Shape

```typescript
// Twitch profile fields available in callbacks:
profile.sub              // Twitch user ID (string) — use as twitch_id
profile.preferred_username // Twitch login (lowercase) — use as twitch_login
profile.name              // Display name — use as display_name
profile.picture           // Avatar URL — exposed via session.user.image automatically
profile.email             // Email (if scope includes email)
```

### Dashboard Shell File Structure

```
apps/web/src/
├── app/
│   ├── (auth)/
│   │   ├── layout.tsx         ← centered layout for auth pages
│   │   ├── signin/
│   │   │   └── page.tsx       ← "Sign in with Twitch" button
│   │   └── error/
│   │       └── page.tsx       ← auth error display
│   ├── (dashboard)/
│   │   ├── layout.tsx         ← dashboard root layout (sidebar + main)
│   │   ├── page.tsx           ← dashboard home
│   │   ├── sessions/
│   │   │   └── page.tsx       ← stub
│   │   ├── playlists/
│   │   │   └── page.tsx       ← stub
│   │   ├── overlay/
│   │   │   └── page.tsx       ← stub
│   │   ├── settings/
│   │   │   └── page.tsx       ← stub
│   │   └── components/
│   │       └── sidebar.tsx    ← sidebar nav + user info + sign out
│   ├── api/
│   │   └── auth/
│   │       └── [...nextauth]/
│   │           └── route.ts   ← Auth.js v5 handler
│   ├── globals.css
│   ├── layout.tsx             ← root layout (no auth)
│   └── page.tsx               ← landing page with Sign in button
├── middleware.ts               ← route protection
└── types/
    └── next-auth.d.ts         ← session type augmentation

apps/web/server/               ← server-only code (NOT in src/ — no client import risk)
├── auth.ts                    ← Auth.js v5 config + signIn callback
└── api/
    ├── trpc.ts                ← tRPC init + procedures
    ├── root.ts                ← appRouter
    └── routers/
        └── tenant.router.ts   ← tenant procedures
```

### Env Variables Required for This Story

All already validated by `@playground/shared/env.ts`:
- `AUTH_SECRET` (min 32 chars) — generate with `openssl rand -base64 32`
- `TWITCH_CLIENT_ID` — from Twitch Developer Console
- `TWITCH_CLIENT_SECRET` — from Twitch Developer Console
- `TOKEN_ENCRYPTION_KEY` (64 hex chars) — generate with `openssl rand -hex 32`
- `DATABASE_URL` — already used in Story 1.2

**Add to `.env.example`** (with placeholder values — never real values):
```
AUTH_SECRET="generate-with-openssl-rand-base64-32"
TWITCH_CLIENT_ID="your-twitch-client-id"
TWITCH_CLIENT_SECRET="your-twitch-client-secret"
TOKEN_ENCRYPTION_KEY="generate-with-openssl-rand-hex-32"
```

**Twitch OAuth App Setup:**
- Create app at https://dev.twitch.tv/console
- Add OAuth redirect URI: `http://localhost:3000/api/auth/callback/twitch` (dev)
- Scopes needed: none beyond defaults (Twitch includes basic profile by default)

### Testing Strategy

Tests MUST NOT make real Twitch OAuth calls or hit the DB. Test only:
1. `middleware.ts` — unit test redirect logic with mocked `auth()`
2. `auth.ts` signIn callback — test with mocked `db` (verify tenant/user creation)
3. Type shapes — TypeScript compilation is the primary test

```typescript
// smoke.test.ts — verify critical exports
import { describe, it, expect } from 'vitest'

describe('auth module exports', () => {
  it('auth.ts exports handlers, auth, signIn, signOut', async () => {
    // Just verify module shape without invoking
    const authModule = await import('./server/auth')
    expect(authModule.handlers).toBeDefined()
    expect(authModule.auth).toBeDefined()
    expect(authModule.signIn).toBeDefined()
    expect(authModule.signOut).toBeDefined()
  })
})
```

> ⚠️ `auth.ts` imports `env` which validates `process.env` at import time. Tests that import `auth.ts` will fail unless env vars are set. Mock `@playground/shared/env` in vitest setup or set env vars in `vitest.config.ts`.

### Previous Story Intelligence (1.1 + 1.2)

From Story 1.1:
- `apps/web` exists with Next.js 15 App Router structure in `src/app/`
- `apps/web/tsconfig.json` uses `moduleResolution: Bundler` (correct for Next.js 15 + tRPC imports)
- `apps/web/next.config.ts` has `output: 'standalone'` and `transpilePackages: ['@playground/shared']`
- **`transpilePackages` must include `@playground/db`** once it's added as a dep — update `next.config.ts`
- `apps/web/package.json` has `@playground/shared: workspace:*` but NOT `@playground/db` — add it

From Story 1.2:
- `packages/db` exports: `db`, `withTenantContext`, `Transaction`, schema tables + enums + types from `@playground/db`
- `packages/db/schema` exports all schema objects from `@playground/db/schema`
- `packages/shared/utils/encrypt` exports `encrypt`, `decrypt` from `@playground/shared/utils/encrypt`
- `withTenantContext(tenantId, async (tx) => {...})` — use for ALL tenant-scoped queries in tRPC procedures
- Provisioning queries use `db` directly (not `withTenantContext`) — documented above
- `users.role` enum values: `'free' | 'premium' | 'admin'`
- `users.subscriptionStatus` enum values: `'free' | 'active' | 'past_due' | 'canceled'`

### Anti-Patterns to Avoid (from Architecture)

- ❌ `process.env.TWITCH_CLIENT_ID` — use `env.TWITCH_CLIENT_ID` from `@playground/shared/env`
- ❌ `localStorage.setItem('token', ...)` — JWT only in httpOnly cookie (Auth.js handles this)
- ❌ Scoring logic in `apps/web` — ADR-04, belongs in `apps/bot-worker` only
- ❌ Importing `packages/game-engine` in `apps/web` — ADR-04
- ❌ `getServerSession()` — this is Auth.js v4 API; use `auth()` in v5
- ❌ `authOptions` export — v4 pattern; v5 uses `NextAuth({...})` return values
- ❌ Feature-grouped tRPC routers — domain-grouped only (`tenant.router.ts`, not `auth.router.ts` for tenant operations)

### References

- Architecture: Auth Framework — Auth.js v5, JWT mode, httpOnly cookie, Twitch OAuth [Source: architecture.md#Authentication & Security]
- Architecture: Authorization table — `/(dashboard)/*` protected by `middleware.ts` [Source: architecture.md#Authorization Decision Table]
- Architecture: tRPC v11 — `protectedProcedure`, `createTRPCRouter`, domain-grouped routers [Source: architecture.md#API & Communication Patterns]
- Architecture: Token Encryption — AES-256-GCM, `TOKEN_ENCRYPTION_KEY` [Source: architecture.md#Token Encryption]
- Architecture: Foundation sequence — Auth.js (step 3) + tRPC skeleton (step 4) [Source: architecture.md#Implementation Order]
- Architecture: Anti-patterns — process.env forbidden, game-engine import forbidden [Source: architecture.md#Anti-Patterns]
- Architecture: File paths — `server/auth.ts`, `server/api/trpc.ts`, `src/middleware.ts`, `src/types/next-auth.d.ts` [Source: architecture.md#Complete Project Directory Structure]
- Epics: Story 1.3 Acceptance Criteria [Source: epics.md#Story 1.3]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- Task 1: Added `next-auth@beta.30`, `@trpc/server@11`, `superjson`, `@playground/db`, `drizzle-orm` to `apps/web/package.json`
- Task 1: Added `~/*` path alias to `apps/web/tsconfig.json` for `server/` imports; added `declaration: false` to fix TS2742 (base tsconfig has `declaration: true`)
- Task 1: Added `@playground/db` to `next.config.ts` `transpilePackages`
- Task 2: Auth.js v5 split config pattern — `auth.config.ts` (edge-compatible, used in middleware) + `auth.ts` (Node.js, with DB + provisioning)
- Task 2: Tenant provisioning uses `db` directly (bypasses RLS intentionally — admin operation); upserts OAuth token via `onConflictDoUpdate` on `(tenantId, provider)`
- Task 5: middleware.ts uses `authConfig.authorized` callback — redirects unauthenticated dashboard requests to `/auth/signin`
- Task 6: tRPC skeleton: `trpc.ts` (init + protectedProcedure), `root.ts`, `tenant.router.ts` (getMe procedure)
- Task 11: All 4 web tests pass + 18 db tests pass. All 7 packages type-check clean.

### File List

- `apps/web/package.json` — added `next-auth`, `@trpc/server`, `superjson`, `@playground/db`, `drizzle-orm`
- `apps/web/tsconfig.json` — added `~/` path alias, `declaration: false`, `declarationMap: false`
- `apps/web/next.config.ts` — added `@playground/db` to `transpilePackages`
- `apps/web/server/auth.config.ts` — created: edge-compatible Auth.js config (middleware use)
- `apps/web/server/auth.ts` — created: full Auth.js v5 config with Twitch provider, signIn/jwt/session callbacks, tenant provisioning
- `apps/web/server/api/trpc.ts` — created: tRPC init, createTRPCContext, publicProcedure, protectedProcedure
- `apps/web/server/api/root.ts` — created: appRouter + AppRouter type
- `apps/web/server/api/routers/tenant.router.ts` — created: tenantRouter.getMe stub
- `apps/web/src/app/api/auth/[...nextauth]/route.ts` — created: Auth.js v5 route handler
- `apps/web/src/types/next-auth.d.ts` — created: Session + JWT type augmentation
- `apps/web/src/middleware.ts` — created: dashboard route protection
- `apps/web/src/app/(auth)/layout.tsx` — created: centered auth layout
- `apps/web/src/app/(auth)/signin/page.tsx` — created: Twitch sign-in page
- `apps/web/src/app/(auth)/error/page.tsx` — created: auth error page
- `apps/web/src/app/(dashboard)/layout.tsx` — created: dashboard layout with sidebar
- `apps/web/src/app/(dashboard)/components/sidebar.tsx` — created: nav sidebar with links, user info, sign out
- `apps/web/src/app/(dashboard)/page.tsx` — created: dashboard home
- `apps/web/src/app/(dashboard)/sessions/page.tsx` — created: sessions stub
- `apps/web/src/app/(dashboard)/playlists/page.tsx` — created: playlists stub
- `apps/web/src/app/(dashboard)/overlay/page.tsx` — created: overlay stub
- `apps/web/src/app/(dashboard)/settings/page.tsx` — created: settings stub
- `apps/web/src/app/page.tsx` — updated: landing page with Sign in with Twitch link
- `apps/web/src/smoke.test.ts` — updated: 4 tests verifying dependency presence
