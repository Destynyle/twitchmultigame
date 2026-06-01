# Phase 7: Spotify Import Cleanup - Context

**Gathered:** 2026-03-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Spotify track data is automatically cleaned on import — titles stripped of edition annotations, featurings extracted and stored separately. Streamers can manually correct title, artist, and featurings from the playlist UI (both from the list view and inside the playlist editor) before starting a session. Raw Spotify title is NOT stored separately; `title` column holds the cleaned value.

</domain>

<decisions>
## Implementation Decisions

### Title cleaning rules
- **D-01:** Strip all bracket styles: `( )`, `[ ]`, and trailing `- annotation` dash-suffix patterns (e.g. `- Radio Edit`, `[Remastered]`, `(Single Version)`)
- **D-02:** Annotations to strip (case-insensitive): `Radio Edit`, `Radio Version`, `Remastered`, `Remaster`, `Live`, `Live Version`, `Live at …`, `Single Version`, `Album Version`, `Original Version`, `Edit`, `Extended`, `Short Version`, and year-prefixed variants (e.g. `2023 Remaster`, `2019 Mix`)
- **D-03:** Non-English curated list to strip: `Version Radio` (FR), `Ao Vivo` (PT), `Directo` (ES), `Version Live` (FR), `En Vivo` (ES), `Versão Ao Vivo` (PT)
- **D-04:** **Keep** `(Remix)` and `(Cover)` — ambiguous track variants the streamer can correct manually before session
- **D-05:** If cleaning produces an empty string, revert to original raw title (fallback)
- **D-06:** Apply cleaning to **both title AND artist fields**

### Featurings extraction
- **D-07:** Extract featuring from title: `(feat. X)`, `(ft. X)`, `(with X)`, `(Featuring X)` — all bracket styles
- **D-08:** Extract bare featuring from artist field: `Calvin Harris feat. Rihanna` → artist = `Calvin Harris`, featurings = `['Rihanna']`
- **D-09:** Multi-featuring splitting: `(feat. X & Y)` or `(feat. X, Y)` → split into `['X', 'Y']` — each artist independently guessable
- **D-10:** Processing order: extract featurings first, then strip edition annotations from the remainder
- **D-11:** Raw Spotify title is **not** preserved in a separate column — `title` stores the cleaned value directly

### Featurings editor UI
- **D-12:** Featurings displayed as **tag chips** (pill with × to remove) below the title, always visible in the track list
- **D-13:** Add featuring: type name + Enter (or comma) in chip input field
- **D-14:** Featurings editing available for **all tracks** (Spotify and manually created)

### Track edit entry point
- **D-15:** **Dual mode:** clicking directly on title or artist field → inline edit in the row; clicking pencil icon → full edit modal with all fields (title, artist, featurings)
- **D-16:** Quick-edit from the **playlist list view** exposes all fields (title, artist, featurings) — not just inside the playlist editor
- **D-17:** **One Save button** per playlist commits all pending track edits at once
- **D-18:** After Spotify import: streamer stays on the playlist list (no auto-redirect to editor)
- **D-19:** Re-importing a Spotify playlist **always overwrites** track data — no manual-override flag

### Claude's Discretion
- Exact regex patterns for bracket detection (handle Unicode edge cases)
- Placement and styling of featurings chips in the existing `EditPlaylistForm` layout
- Whether the pencil icon appears on row hover or always visible
- Chip input library choice (if any) vs. custom implementation

</decisions>

<specifics>
## Specific Ideas

- Ambiguous annotations like `(Remix)` and `(Cover)` are intentionally kept because the streamer can always correct fields manually before launching a session — "on laisse les situations ambigues"
- Featurings are always shown (not hidden until edit) — they're part of the track identity displayed in the game

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` §SPOT-01, SPOT-02, SPOT-03 — Full requirement text for all three Phase 7 requirements

### Existing import logic
- `apps/web/src/app/(dashboard)/playlists/spotify-import-action.ts` — Current Spotify import action (lines 74–114): where cleaning must be injected before track insertion
- `apps/web/src/app/(dashboard)/playlists/actions.ts` — `createPlaylistAction` and `updatePlaylistAction`: TrackInput type needs featurings field added

### UI components to extend
- `apps/web/src/app/(dashboard)/playlists/components/EditPlaylistForm.tsx` — Track editing form (lines 141–155): needs featurings chip input added
- `apps/web/src/app/(dashboard)/playlists/components/PlaylistsClient.tsx` — Playlist list view (lines 115–168): needs quick-edit from list

### DB schema
- `packages/db/src/schema/playlists.ts` — `tracks` table: `featurings text[]` column already exists (line 62), no migration needed for featurings storage. No `rawTitle` column needed.

### Game engine (normalizer — NOT for cleaning)
- `packages/game-engine/src/normalizer.ts` — Existing normalizer strips diacritics for game matching. **Do not reuse** for title cleaning — it removes parentheses prematurely. Title cleaner is a new separate utility.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `packages/game-engine/src/normalizer.ts`: exists but unsuitable for Phase 7 cleaning (removes parens). New `title-cleaner.ts` utility needed in `packages/shared` or co-located in import action.
- `apps/web/src/app/(dashboard)/playlists/actions.ts` `TrackInput` type (lines 12–19): needs `featurings?: string[]` added

### Established Patterns
- Server actions return `{ success: true } | { error: string }` — maintain this pattern
- DB writes use `withTenantContext(tenantId, tx => ...)` — maintain for any new track upserts
- Migrations: SQL manual in `packages/db/migrations/`, journal in `meta/_journal.json`. Current state: 0011. **No new migration needed** — `featurings` column already exists.

### Integration Points
- `spotify-import-action.ts` line 76–81: track object built from Spotify API response — cleaning utility called here before push to `spotifyTracks[]`
- `EditPlaylistForm.tsx` lines 141–155: title/artist inputs — featurings chip input added here
- `PlaylistsClient.tsx` lines 115–168: playlist list — quick-edit row added here

</code_context>

<deferred>
## Deferred Ideas

- Non-English variants beyond the curated FR/ES/PT list — future phase
- Manual override flag to protect edited tracks from re-import overwriting — explicitly excluded from this phase
- Re-import flow that merges rather than overwrites — future phase
- Featurings on the overlay (progressive reveal of featuring names) — Phase 9 (OVRL)

</deferred>

---

*Phase: 07-spotify-import-cleanup*
*Context gathered: 2026-03-21*
