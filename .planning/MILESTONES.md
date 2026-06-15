# Milestones

## v1.0 — Foundation (Shipped)

**Goal:** Core multi-tenant Twitch blindtest platform — auth, session management, Spotify playlists, overlay SSE, and admin moderation.

**Phases:**
1. Phase 1: Twitch OAuth + tenant creation (auth, user accounts)
2. Phase 2: Session management (create, manage, delete sessions)
3. Phase 3: Spotify integration (playlist import, track management)
4. Phase 4: Overlay SSE (scores, leaderboard, themes, CTA animations)
5. Phase 5: Admin & moderation (roles, audit log, monitoring, interventions, quarantine, content reports)

**Shipped features:**
- ✓ Twitch OAuth login + tenant account creation
- ✓ Bot worker connection (tmi.js, session lifecycle via Redis)
- ✓ Session CRUD + bot status monitoring
- ✓ Spotify OAuth + playlist import + track listing
- ✓ Overlay SSE endpoint + 3 visual themes
- ✓ Leaderboard + score display on overlay
- ✓ CTA (call-to-action) overlay component
- ✓ Admin role + audit log (insert-only)
- ✓ Remote session interventions (pause/stop/skip from admin)
- ✓ User quarantine system
- ✓ Content reports + moderation queue

**Last phase:** Phase 5
**Ended:** 2026-03

**Note:** Superseded by the 2026-06-14 static-app pivot. The SaaS backend (auth, DB/RLS,
Redis, bot-worker) is dropped. Only `packages/game-engine` + `packages/game-types` carry
forward.

---

## v2.0 — Static Blindtest (In Progress)

**Goal:** Rebuild the blindtest as a zero-backend static client app — anonymous chat reading,
client-side scoring, multi-source music player, control panel, animated overlay, score export.
Usable by anyone with no account or token.

**Pivot rationale:** The talking bot was the only thing forcing OAuth + a backend. Dropping it
(replaced by overlay animations) collapses the server, database, and Redis entirely. Anonymous
Twitch IRC reads chat in-browser; the pure game-engine scores client-side.

**Locked decisions (2026-06-14):**
- Vite + React SPA (static)
- BroadcastChannel for OBS ↔ control sync (no server)
- YouTube IFrame + Spotify embed (multi-source music)
- 100% client config/scores (localStorage + JSON import/export)
- Keep `game-engine`/`game-types`; drop `apps/web` backend, `apps/bot-worker`, `packages/db`

**Phases:**
1. Scaffold + Engine Lift
2. Anonymous Twitch Chat Reader
3. Playlists & Config (client-side)
4. Music Player Abstraction
5. Game Loop (in-memory state)
6. Control Panel
7. Overlay + BroadcastChannel Sync
8. Score Export
9. In-App Streamer Guide

**Carried over (already built):** v2 gameplay engine (window scoring, streak, malus, double-shot)
from old Phase 06 — reused as-is.

**Started:** 2026-06-14

---
*Milestones log initialized: 2026-03-17 — v2 pivoted to static app 2026-06-14*
