# Roadmap: Playground — Static Twitch Blindtest

## Architecture Pivot (2026-06-14)

v2 pivots from a multi-tenant SaaS backend to a **zero-backend static client app**.
Rationale: the only thing forcing OAuth + server was the bot *speaking* in chat. Dropping
the talking bot (replaced by rich overlay animations) collapses the whole backend. Anonymous
Twitch IRC (`justinfan`) reads chat token-free in the browser; scoring is deterministic and
runs client-side; the pure `packages/game-engine` (zero Redis/DB coupling) is lifted as-is.

**Result:** a static web app any streamer opens, types their channel name, loads a playlist,
and plays — no signup, no token, no deploy infra. Usable by everyone.

## Milestones

- ✅ **v1.0 Foundation** — Phases 1-5, SaaS backend (shipped 2026-03, **superseded by pivot**)
- 🚧 **v2.0 Static Blindtest** — Phases 1-9 (greenfield static rewrite, in progress)
- 📋 **v3.0 Battle Mode** — TBD (after v2)

## What carries over

- `packages/game-engine` (fuzzy-matcher, normalizer, scorer, shuffle, plugins) — **reused as-is**, zero backend coupling
- `packages/game-types` — reused
- v2 gameplay design (window scoring, streak, malus, double-shot) — already built & tested in old Phase 06
- Feature *content* of old phases 7/9/10/11/12 (Spotify cleanup, live controls, overlay zones, export, guide) — re-homed client-side

## What dies in the pivot

- OAuth Twitch + AES token encryption
- PostgreSQL + RLS + multi-tenant
- Redis pub/sub + SSE
- `apps/bot-worker` (separate Node process)
- Old Phase 8 (bot auto-messages + chat commands) — **replaced by overlay animations**; the talking bot is gone, `!score`/`!rank` unneeded because the leaderboard is always on screen

## Tech decisions (locked 2026-06-14)

| Decision | Choice |
|----------|--------|
| Frontend | Vite + React SPA (static export) |
| OBS ↔ control sync | `BroadcastChannel` (same-PC tabs, zero server) |
| Music source | YouTube IFrame + Spotify embed (multi-source) |
| Config/scores storage | 100% client (localStorage + JSON import/export) |
| Old backend code | Repart clean — keep `game-engine`/`game-types`, drop the rest |

---

## v2.0 Static Blindtest — Phase Details

### Phase 1: Scaffold + Engine Lift
**Goal**: A Vite + React SPA builds and runs, with the reused game-engine importable and the old SaaS backend removed from the active build.
**Depends on**: none (greenfield)
**Requirements**: CORE-01, CORE-02
**Success Criteria**:
  1. `npm run dev` serves a Vite SPA that renders a placeholder app shell.
  2. `packages/game-engine` scoring functions import and run inside the SPA (a smoke call returns a score).
  3. The old `apps/web` backend routes, `apps/bot-worker`, `packages/db` are no longer part of the build graph.
**Plans**: TBD

### Phase 2: Anonymous Twitch Chat Reader
**Goal**: The app connects to Twitch chat read-only with no token and emits a clean stream of parsed messages.
**Depends on**: Phase 1
**Requirements**: CHAT-01, CHAT-02, CHAT-03
**Success Criteria**:
  1. Entering a channel name connects via anonymous `justinfan` over WSS with no credentials.
  2. Each chat message surfaces as `{ user, message, timestamp }` to the app.
  3. A dropped socket auto-reconnects without user action and resumes message flow.
**Plans**: TBD

### Phase 3: Playlists & Config (Client-Side)
**Goal**: A streamer builds and edits a playlist of tracks — title, artist, featurings, malus terms, and a music source binding — stored entirely client-side and shareable as a file.
**Depends on**: Phase 1
**Requirements**: CFG-01, CFG-02, CFG-03, CFG-04
**Success Criteria**:
  1. Streamer can create a track with title, artist, featurings, malus terms, and a YouTube or Spotify source.
  2. Playlists persist in localStorage across reloads.
  3. Streamer can export a playlist to a JSON file and re-import it on another machine.
  4. Pasting a YouTube/Spotify URL auto-extracts available metadata (title/artist) into the form.
**Plans**: TBD

### Phase 4: Music Player Abstraction
**Goal**: A unified player drives playback for both YouTube and Spotify sources with consistent play/pause/seek controls per round.
**Depends on**: Phase 3
**Requirements**: PLAY-01, PLAY-02, PLAY-03
**Success Criteria**:
  1. A YouTube-sourced track plays in-app via the IFrame API with programmatic play/pause/seek.
  2. A Spotify-sourced track plays via embed (within embed limits) through the same player interface.
  3. The game loop can start playback at round start and stop it at reveal regardless of source.
**Plans**: TBD

### Phase 5: Game Loop (In-Memory State)
**Goal**: Chat messages flow through the engine into an in-memory round state machine producing live scores, streaks, malus, and double-shot — replacing the old Redis RoundStateManager.
**Depends on**: Phase 2, Phase 4
**Requirements**: LOOP-01, LOOP-02, LOOP-03, LOOP-04, LOOP-05
**Success Criteria**:
  1. Starting a round opens a guessing window; chat guesses are matched by the engine and scored.
  2. First finder gets max points; finders within the window get proportionally fewer (window scoring works client-side).
  3. Streak multiplier accumulates across found rounds and resets on miss/malus, per viewer, held in memory.
  4. A malus trap term deducts points and a double-shot (title+artist) is all-or-nothing — both fully wired.
  5. Reveal locks the round and advances to the next track; round state survives a control-tab reload (rehydrate from localStorage).
**Plans**: TBD

### Phase 6: Control Panel
**Goal**: The operator drives the entire game from one panel — start/reveal/next, live metadata edits, manual score adjustments, and a between-rounds mini podium.
**Depends on**: Phase 5
**Requirements**: CTRL-01, CTRL-02, CTRL-03, CTRL-04
**Success Criteria**:
  1. Operator can start a round, reveal answers, and advance to the next track from the panel.
  2. Operator can edit the current track's title/artist/featurings/malus; edits apply at the next round boundary.
  3. Operator can +1/-1 any viewer's score and the change is reflected immediately.
  4. Between rounds the panel shows a mini podium of the top 3 by points earned that round.
**Plans**: TBD

### Phase 7: Overlay + BroadcastChannel Sync
**Goal**: A separate overlay view (OBS browser source) mirrors live game state via BroadcastChannel and renders blurred cover, leaderboard, and an animated feed of finds/malus/streak — the visual replacement for the talking bot.
**Depends on**: Phase 6
**Requirements**: OVR-01, OVR-02, OVR-03, OVR-04
**Success Criteria**:
  1. The overlay opens as its own URL/tab and receives state from the control panel via BroadcastChannel with no server.
  2. The cover art is blurred until the track is found, then sharpens.
  3. A live feed animates events — "+X user found", "−X user malus", streak milestones — as pops.
  4. The leaderboard updates in real time as scores change.
**Plans**: TBD

### Phase 8: Score Export
**Goal**: The streamer exports final session results in multiple formats, all generated client-side.
**Depends on**: Phase 6
**Requirements**: EXP-01, EXP-02, EXP-03
**Success Criteria**:
  1. Streamer can download session scores as JSON (names, points, final streak).
  2. Streamer can download a CSV that opens correctly in Excel/Sheets.
  3. Streamer can export a PNG of the final podium (top 3 with names + scores).
**Plans**: TBD

### Phase 9: In-App Streamer Guide
**Goal**: An in-app guide page lets a new streamer go from zero to live without external docs.
**Depends on**: Phase 7, Phase 6, Phase 8
**Requirements**: GUIDE-01, GUIDE-02, GUIDE-03
**Success Criteria**:
  1. A new streamer can follow the setup steps — enter channel, build playlist, add overlay to OBS, go live.
  2. The guide explains points/streak/malus/double-shot in plain language.
  3. The guide shows how to add the overlay URL as an OBS browser source.
**Plans**: TBD

---

## v3.0 Battle Mode (After v2)

Music tournament bracket — community submits songs, head-to-head chat voting, tug-of-war
overlay. Now inherits the static/zero-backend foundation. Phases TBD after v2.

## Progress

| Phase | Milestone | Status |
|-------|-----------|--------|
| 1. Scaffold + Engine Lift | v2.0 | ✅ Built (build+types green) |
| 2. Anonymous Chat Reader | v2.0 | ✅ Built — ⚠️ needs live browser test |
| 3. Playlists & Config | v2.0 | ✅ Built |
| 4. Music Player | v2.0 | ✅ Built |
| 5. Game Loop | v2.0 | ✅ Built (in-memory, streak reimplemented) |
| 6. Control Panel | v2.0 | ✅ Built |
| 7. Overlay + Sync | v2.0 | ✅ Built |
| 8. Score Export | v2.0 | ✅ Built (JSON/CSV/PNG) |
| 9. Streamer Guide | v2.0 | ✅ Built (/guide) |

All 9 phases built as a vertical slice in `apps/app` on branch `feat/static-rewrite` (2026-06-14).
Old SaaS back (apps/web, bot-worker, packages/db, shared) + deploy config removed.
**Outstanding:** live end-to-end browser test, streak formula tuning, commit.

*Roadmap rewritten 2026-06-14 — static-app pivot. Old SaaS v2 phases 6-12 superseded.*
