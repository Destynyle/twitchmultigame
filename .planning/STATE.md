---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: Static Blindtest
status: in_progress
stopped_at: vertical slice built on branch feat/static-rewrite — needs live browser test (2026-06-14)
last_updated: "2026-06-14T00:00:00.000Z"
progress:
  total_phases: 9
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-06-14 — static-app pivot)

**Core value:** A streamer opens a static web app, types their channel name, loads a playlist,
and runs an engaging live blindtest on Twitch — zero signup, zero token, zero backend.
**Current focus:** Phase 01 — Scaffold + Engine Lift (Vite SPA, reuse game-engine)

## Current Position

Branch: `feat/static-rewrite` (NOT committed yet — user hasn't asked)
Built a working vertical slice covering most of phases 1-8 in `apps/app` (Vite+React SPA):

- **Ph1 Scaffold** ✅ — `apps/app` Vite+React+Tailwind v4, imports game-engine/game-types (build + type-check green)
- **Ph2 Chat reader** ✅ — `src/lib/twitch-chat.ts` anonymous justinfan WSS + reconnect (needs live browser test)
- **Ph3 Playlists** ✅ — `src/pages/Setup.tsx` + `storage.ts` + `sources.ts` (URL parse + oEmbed meta), localStorage + JSON import/export
- **Ph4 Player** ✅ — `src/components/Player.tsx` YouTube IFrame API + Spotify embed
- **Ph5 Game loop** ✅ — `src/game/controller.ts` wraps BlindtestPlugin + in-memory streak/scores/feed (replaces Redis RoundStateManager)
- **Ph6 Control panel** ✅ — `src/pages/Control.tsx` start/reveal/next, +/- score, mini podium
- **Ph7 Overlay+sync** ✅ — `src/pages/Overlay.tsx` + `src/lib/sync.ts` BroadcastChannel, blurred cover, leaderboard, feed
- **Ph8 Export** ✅ — JSON+CSV+PNG podium (`src/lib/export.ts`)
- **Ph9 Guide** ✅ — `src/pages/Guide.tsx` at /guide (setup steps, scoring rules, OBS instructions)

**Cleanup done:** old `apps/web`, `apps/bot-worker`, `packages/db`, `packages/shared` removed +
deploy config (render.yaml, railway.json, docker-compose.yml, .dockerignore) + root db scripts/turbo tasks.
Workspace now = `apps/app` + `packages/{game-engine,game-types,eslint-config}`.

Run: `pnpm dev` (root) → http://localhost:5173. Routes /, /control, /overlay, /guide. Build+types green.

## Connections (added 2026-06-14) — client-side OAuth, still zero-backend

OAuth ≠ backend: public-client flows run in-browser with no secret.
- **Spotify import** — Authorization Code + PKCE (`src/lib/spotify.ts`). Connect → list `/me/playlists`
  → import tracks (title/artist/featurings) into a Playlist. Dev mode = whitelist ≤25 (streamers only).
- **Twitch login** — implicit grant (`src/lib/twitch-auth.ts`, Twitch has no PKCE). Auto-fills channel.
  Convenience only; chat read still anonymous. Does NOT restore the talking bot.
- Client IDs pasted in Setup → ConnectionsPanel (localStorage), or `VITE_SPOTIFY_CLIENT_ID`/`VITE_TWITCH_CLIENT_ID`.
- Callback routes `/auth/spotify`, `/auth/twitch`.
- ⚠️ Spotify dev: open app on **http://127.0.0.1:<port>** (not localhost) so the PKCE verifier stays
  same-origin and Spotify accepts the redirect.
- User must register both apps (Spotify dashboard + dev.twitch.tv) with the redirect URIs shown in Setup → Réglages.

## Verified working (2026-06-16)

- OAuth Spotify (PKCE) + Twitch (implicit) connect end-to-end on **https://127.0.0.1:5173**.
- Dev origin resolved: Spotify blocks hostname `localhost` → must use `https://127.0.0.1`; redirect URIs https + exact-match.

## NEXT (not done)

1. **Full gameplay live test** — confirm justinfan chat → scoring/streak/overlay end-to-end on a live channel
   (OAuth + UI confirmed; the chat-to-score path still wants a real live-channel run).
2. **Streak formula** — `STREAK_STEP=0.2` in controller.ts is a guess — tune with user.
3. **Commit** — branch feat/static-rewrite still not committed (big uncommitted slice + old-back deletion).

## Pivot Summary (2026-06-14)

v2 pivoted from multi-tenant SaaS backend → zero-backend static client app. The talking bot
(only thing forcing OAuth + server) is dropped, replaced by overlay animations. See ROADMAP.md.

**Locked decisions:**
- Frontend: Vite + React SPA (static)
- Sync OBS ↔ control: BroadcastChannel (no server)
- Music: YouTube IFrame + Spotify embed (multi-source)
- Config/scores: 100% client (localStorage + JSON import/export)
- Old code: keep `packages/game-engine` + `packages/game-types`, drop `apps/web` backend, `apps/bot-worker`, `packages/db`

**Verified reusable:** `packages/game-engine` has zero Redis/DB imports — pure scoring, lifts as-is.

## Accumulated Context

### Gameplay (already built, reusable)

- Fuzzy matching: Sørensen-Dice bigrams, malus tolerance 0.15, exact substring for targets ≤5 chars
- Window scoring: first finder max, proportional decay within windowDurationMs
- Double-shot: all-or-nothing (0 pts if only one of title/artist correct)
- Streak: breaks on wrong answer including malus; multiplier on positive points only
- These ship in `packages/game-engine` — Phase 5 wires them into in-memory round state (replaces Redis RoundStateManager)

### Pending Todos

None.

### Blockers/Concerns

- [Phase 4] Spotify embed = 30s preview unless premium SDK+auth — YouTube is the unconstrained path; Spotify support stays within embed limits
- [Phase 7] BroadcastChannel requires control + overlay on the same machine/browser (streamer's PC running OBS) — acceptable for target use

## Session Continuity

Last session: 2026-06-14 — roadmap rewritten for static pivot
Stopped at: planning complete, ready to plan Phase 01
Resume file: None
