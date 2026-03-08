# Story 2.6 — Playlist Management: Edit, Rename, Delete & Export

**Status:** done

## Summary

Implemented full playlist lifecycle management including edit (add/remove/reorder tracks), inline rename, delete with confirmation, and JSON export via Route Handler.

## Acceptance Criteria Fulfilled

1. **Edit tracks** — `EditPlaylistForm.tsx` is pre-populated with existing name and tracks; supports add, remove, and up/down reorder; submits via `updatePlaylistAction`.
2. **Rename** — Inline rename on each playlist card calls `updatePlaylistAction` with just the new name; `router.refresh()` reflects change immediately.
3. **Delete with confirmation** — Delete button sets `deletingId`; a confirmation panel appears on the card; `confirmDelete` calls `deletePlaylistAction` which hard-deletes the playlist (cascade deletes tracks).
4. **Export as JSON** — Export button triggers a browser download via `GET /api/playlists/[id]/export`; response includes playlist metadata and full track list (title, artist, durationSeconds, sourceType, sourceId, position).
5. **Export is sync / fast** — The route handler fetches and returns JSON in a single request with no streaming.

## Files Created / Modified

### Modified
- `apps/web/server/api/routers/playlist.router.ts` — Added `update` procedure (optional rename + full track replacement via delete+re-insert)
- `apps/web/src/app/(dashboard)/playlists/actions.ts` — Added `deletePlaylistAction`, `updatePlaylistAction`; extended `TrackInput` type with optional fields
- `apps/web/src/app/(dashboard)/playlists/components/PlaylistsClient.tsx` — Added Edit, Rename, Export, Delete buttons with inline rename form, edit panel, delete confirmation
- `apps/web/src/smoke.test.ts` — Appended Story 2.6 test suite (14 tests, no existing tests modified)

### Created
- `apps/web/src/app/api/playlists/[id]/export/route.ts` — GET route handler; auth-gated, tenant-scoped, returns JSON with `Content-Disposition: attachment`
- `apps/web/src/app/(dashboard)/playlists/components/EditPlaylistForm.tsx` — Client component; pre-populated form with track add/remove/reorder and `updatePlaylistAction` submission

## Key Patterns Used

- `withTenantContext` for all tenant-scoped DB queries (router + actions + export route)
- `auth()` check with `redirect('/auth/signin')` in all server-side entry points
- `revalidatePath('/playlists')` after mutations to keep server component data fresh
- `router.refresh()` on the client after successful mutations
- Track replacement: `DELETE WHERE playlistId = id` then bulk `INSERT` — avoids partial-update complexity
