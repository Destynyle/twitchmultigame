import { describe, it, expect } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'

describe('dependency presence', () => {
  it('next-auth is listed as dependency', async () => {
    const pkg = (await import('../package.json')) as {
      dependencies: Record<string, string>
    }
    expect(pkg.dependencies['next-auth']).toBeDefined()
  })

  it('@trpc/server is listed as dependency', async () => {
    const pkg = (await import('../package.json')) as {
      dependencies: Record<string, string>
    }
    expect(pkg.dependencies['@trpc/server']).toBeDefined()
  })

  it('@playground/db is listed as dependency', async () => {
    const pkg = (await import('../package.json')) as {
      dependencies: Record<string, string>
    }
    expect(pkg.dependencies['@playground/db']).toBeDefined()
  })
})

describe('auth.config exports', () => {
  it('authConfig has pages, providers, callbacks', async () => {
    const { authConfig } = await import('../server/auth.config')
    expect(authConfig.pages?.signIn).toBe('/auth/signin')
    expect(authConfig.pages?.error).toBe('/auth/error')
    expect(authConfig.providers).toBeDefined()
    expect(typeof authConfig.callbacks?.authorized).toBe('function')
  })
})

describe('tRPC skeleton — static source validation', () => {
  // These modules import next-auth which requires the Next.js runtime.
  // We validate structure via source inspection instead.
  const trpcSrc = path.resolve(__dirname, '../server/api/trpc.ts')
  const rootSrc = path.resolve(__dirname, '../server/api/root.ts')
  const tenantSrc = path.resolve(__dirname, '../server/api/routers/tenant.router.ts')

  it('trpc.ts exports createTRPCRouter, publicProcedure, protectedProcedure', () => {
    const content = fs.readFileSync(trpcSrc, 'utf-8')
    expect(content).toContain('export const createTRPCRouter')
    expect(content).toContain('export const publicProcedure')
    expect(content).toContain('export const protectedProcedure')
  })

  it('root.ts exports appRouter', () => {
    const content = fs.readFileSync(rootSrc, 'utf-8')
    expect(content).toContain('export const appRouter')
    expect(content).toContain('export type AppRouter')
  })

  it('tenant.router.ts has getMe procedure', () => {
    const content = fs.readFileSync(tenantSrc, 'utf-8')
    expect(content).toContain('getMe')
    expect(content).toContain('protectedProcedure')
  })
})

describe('middleware — static source validation', () => {
  const mwSrc = path.resolve(__dirname, './middleware.ts')

  it('middleware.ts exports a config with a matcher', () => {
    const content = fs.readFileSync(mwSrc, 'utf-8')
    expect(content).toContain('export const config')
    expect(content).toContain('matcher')
  })
})

describe('Story 1.4 — Account Deletion with Grace Period', () => {
  it('tenant.router.ts has deleteAccount and reactivateAccount procedures', () => {
    const src = path.resolve(
      __dirname,
      '../server/api/routers/tenant.router.ts'
    )
    const content = fs.readFileSync(src, 'utf-8')
    expect(content).toContain('deleteAccount')
    expect(content).toContain('reactivateAccount')
    expect(content).toContain('protectedProcedure')
  })

  it('deleteAccountAction is a server action', () => {
    const src = path.resolve(
      __dirname,
      './app/(dashboard)/settings/actions.ts'
    )
    const content = fs.readFileSync(src, 'utf-8')
    expect(content).toContain("'use server'")
    expect(content).toContain('deleteAccountAction')
    expect(content).toContain('deletedAt')
    expect(content).toContain('signOut')
  })

  it('reactivateAccountAction is a server action', () => {
    const src = path.resolve(
      __dirname,
      './app/(auth)/reactivate/actions.ts'
    )
    const content = fs.readFileSync(src, 'utf-8')
    expect(content).toContain("'use server'")
    expect(content).toContain('reactivateAccountAction')
    expect(content).toContain('deletedAt: null')
  })

  it('auth.ts handles soft-deleted tenant redirect (AC3)', () => {
    const src = path.resolve(__dirname, '../server/auth.ts')
    const content = fs.readFileSync(src, 'utf-8')
    expect(content).toContain('/auth/reactivate')
    expect(content).toContain('deletedAt')
  })

  it('cron route exists and checks authorization', () => {
    const src = path.resolve(
      __dirname,
      './app/api/v1/cron/process-deletions/route.ts'
    )
    const content = fs.readFileSync(src, 'utf-8')
    expect(content).toContain('CRON_SECRET')
    expect(content).toContain('Unauthorized')
    expect(content).toContain('THIRTY_DAYS_MS')
    expect(content).toContain('export async function POST')
  })

  it('DeleteAccountForm requires DELETE confirmation', () => {
    const src = path.resolve(
      __dirname,
      './app/(dashboard)/settings/components/DeleteAccountForm.tsx'
    )
    const content = fs.readFileSync(src, 'utf-8')
    expect(content).toContain("'use client'")
    expect(content).toContain("'DELETE'")
    expect(content).toContain('deleteAccountAction')
  })
})

describe('Story 2.4 — Playlist & Track Schema + Manual Playlist Creation', () => {
  it('playlists schema file exports playlists and tracks tables', () => {
    const src = path.resolve(
      __dirname,
      '../../../packages/db/src/schema/playlists.ts'
    )
    const content = fs.readFileSync(src, 'utf-8')
    expect(content).toContain('export const playlists')
    expect(content).toContain('export const tracks')
  })

  it('playlists table has required columns', () => {
    const src = path.resolve(
      __dirname,
      '../../../packages/db/src/schema/playlists.ts'
    )
    const content = fs.readFileSync(src, 'utf-8')
    expect(content).toContain("'tenant_id'")
    expect(content).toContain("'name'")
    expect(content).toContain("'track_count'")
    expect(content).toContain("'source_type'")
  })

  it('tracks table has required columns including title', () => {
    const src = path.resolve(
      __dirname,
      '../../../packages/db/src/schema/playlists.ts'
    )
    const content = fs.readFileSync(src, 'utf-8')
    expect(content).toContain("'playlist_id'")
    expect(content).toContain("'title'")
    expect(content).toContain("'artist'")
    expect(content).toContain("'position'")
  })

  it('playlists and tracks have RLS policies', () => {
    const src = path.resolve(
      __dirname,
      '../../../packages/db/src/schema/playlists.ts'
    )
    const content = fs.readFileSync(src, 'utf-8')
    expect(content).toContain('playlists_tenant_isolation')
    expect(content).toContain('tracks_tenant_isolation')
    expect(content).toContain("current_setting('app.current_tenant_id', true)::uuid")
  })

  it('schema index.ts exports playlists schema', () => {
    const src = path.resolve(
      __dirname,
      '../../../packages/db/src/schema/index.ts'
    )
    const content = fs.readFileSync(src, 'utf-8')
    expect(content).toContain("from './playlists'")
  })

  it('playlist.router.ts has list, create, delete procedures', () => {
    const src = path.resolve(
      __dirname,
      '../server/api/routers/playlist.router.ts'
    )
    const content = fs.readFileSync(src, 'utf-8')
    expect(content).toContain('list:')
    expect(content).toContain('create:')
    expect(content).toContain('delete:')
    expect(content).toContain('protectedProcedure')
  })

  it('playlist.router.ts enforces free tier limit of 3 playlists', () => {
    const src = path.resolve(
      __dirname,
      '../server/api/routers/playlist.router.ts'
    )
    const content = fs.readFileSync(src, 'utf-8')
    expect(content).toContain('FREE_TIER_PLAYLIST_LIMIT')
    expect(content).toContain("role === 'free'")
    expect(content).toContain('FORBIDDEN')
  })

  it('playlist.router.ts validates track title is required', () => {
    const src = path.resolve(
      __dirname,
      '../server/api/routers/playlist.router.ts'
    )
    const content = fs.readFileSync(src, 'utf-8')
    expect(content).toContain('Track title is required')
  })

  it('root.ts registers playlistRouter', () => {
    const src = path.resolve(__dirname, '../server/api/root.ts')
    const content = fs.readFileSync(src, 'utf-8')
    expect(content).toContain('playlistRouter')
    expect(content).toContain('playlist:')
  })

  it('playlists actions.ts is a server action with createPlaylistAction', () => {
    const src = path.resolve(
      __dirname,
      './app/(dashboard)/playlists/actions.ts'
    )
    const content = fs.readFileSync(src, 'utf-8')
    expect(content).toContain("'use server'")
    expect(content).toContain('createPlaylistAction')
    expect(content).toContain('FREE_TIER_PLAYLIST_LIMIT')
  })

  it('createPlaylistAction validates track title', () => {
    const src = path.resolve(
      __dirname,
      './app/(dashboard)/playlists/actions.ts'
    )
    const content = fs.readFileSync(src, 'utf-8')
    expect(content).toContain('Track title is required')
    expect(content).toContain('At least one track is required')
  })

  it('NewPlaylistForm.tsx is a client component with track management', () => {
    const src = path.resolve(
      __dirname,
      './app/(dashboard)/playlists/components/NewPlaylistForm.tsx'
    )
    const content = fs.readFileSync(src, 'utf-8')
    expect(content).toContain("'use client'")
    expect(content).toContain('createPlaylistAction')
    expect(content).toContain('upgradeRequired')
    expect(content).toContain('addTrack')
    expect(content).toContain('removeTrack')
  })

  it('playlists page.tsx is a server component that fetches playlists', () => {
    const src = path.resolve(
      __dirname,
      './app/(dashboard)/playlists/page.tsx'
    )
    const content = fs.readFileSync(src, 'utf-8')
    expect(content).toContain('withTenantContext')
    expect(content).toContain('playlists')
    // Must NOT be a client component
    expect(content).not.toContain("'use client'")
  })

  it('migration SQL contains CREATE TABLE for playlists and tracks', () => {
    const migrationsDir = path.resolve(
      __dirname,
      '../../../packages/db/migrations'
    )
    const sqlFiles = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql'))
    const combinedSql = sqlFiles
      .map((f) => fs.readFileSync(path.join(migrationsDir, f), 'utf-8'))
      .join('\n')

    expect(combinedSql).toContain('CREATE TABLE "playlists"')
    expect(combinedSql).toContain('CREATE TABLE "tracks"')
    expect(combinedSql).toContain('"track_count"')
    expect(combinedSql).toContain('"playlist_id"')
  })

  it('migration SQL enables and forces RLS on playlists and tracks', () => {
    const migrationsDir = path.resolve(
      __dirname,
      '../../../packages/db/migrations'
    )
    const sqlFiles = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql'))
    const combinedSql = sqlFiles
      .map((f) => fs.readFileSync(path.join(migrationsDir, f), 'utf-8'))
      .join('\n')

    expect(combinedSql).toContain('ALTER TABLE "playlists" ENABLE ROW LEVEL SECURITY')
    expect(combinedSql).toContain('ALTER TABLE "tracks" ENABLE ROW LEVEL SECURITY')
    expect(combinedSql).toContain('ALTER TABLE "playlists" FORCE ROW LEVEL SECURITY')
    expect(combinedSql).toContain('ALTER TABLE "tracks" FORCE ROW LEVEL SECURITY')
  })
})
