# Story 2.4: Playlist & Track Schema + Manual Playlist Creation

**Status:** done
**Implemented:** 2026-03-08

## Summary

Playlists and tracks tables with tenant RLS isolation, tRPC CRUD router, server action for creation with free-tier enforcement, and a full UI with NewPlaylistForm client component and PlaylistsClient server component.

## Acceptance Criteria

- [x] `playlists` and `tracks` tables with `tenant_id` and RLS policies (AC1)
- [x] Authenticated streamer can create a playlist with name + tracks (title + artist required) (AC2)
- [x] Free tier (role='free') max 3 playlists; upgrade prompt shown on 4th attempt (AC3)
- [x] Pro tier (role='premium') no limit (AC4)
- [x] Track without title returns validation error, not saved (AC5)

## Files Created / Modified

### packages/db

- **Created:** `packages/db/src/schema/playlists.ts` — `playlists` and `tracks` tables with RLS policies, indexes, and inferred TypeScript types
- **Modified:** `packages/db/src/schema/index.ts` — added `export * from './playlists'`
- **Created:** `packages/db/migrations/0005_unknown_ken_ellis.sql` — migration creating both tables with ENABLE/FORCE RLS, FK constraints, indexes, policies, and updated_at triggers

### apps/web — server

- **Created:** `apps/web/server/api/routers/playlist.router.ts` — tRPC router with `list`, `getById`, `create`, `delete` procedures; `create` enforces free-tier limit with `FORBIDDEN` error and validates all track titles
- **Modified:** `apps/web/server/api/root.ts` — registered `playlistRouter` under `playlist` key

### apps/web — client/UI

- **Created:** `apps/web/src/app/(dashboard)/playlists/actions.ts` — `'use server'` action `createPlaylistAction` with free-tier enforcement and track title validation
- **Created:** `apps/web/src/app/(dashboard)/playlists/components/NewPlaylistForm.tsx` — client form with dynamic track add/remove, upgrade prompt on FORBIDDEN error
- **Created:** `apps/web/src/app/(dashboard)/playlists/components/PlaylistsClient.tsx` — client component wrapping form toggle and playlist card grid
- **Modified:** `apps/web/src/app/(dashboard)/playlists/page.tsx` — full server component fetching playlists via `withTenantContext`

### tests

- **Modified:** `apps/web/src/smoke.test.ts` — added 14 new static-inspection tests for Story 2.4

## Key Decisions

- Used `text` columns for `source_type` (not a pgEnum) to keep the schema flexible for future import sources without requiring new migrations.
- Free-tier limit is enforced both in the tRPC router (`FORBIDDEN` TRPCError) and in the server action (returns `{ upgradeRequired: true }` for UI prompt).
- `tracks` table carries its own `tenant_id` FK in addition to `playlist_id` to allow direct RLS policy on it, avoiding policy bypasses via join.
- Tracks cascade-delete when their parent playlist is deleted (`ON DELETE cascade`).
