# Playground — Twitch Blindtest Platform

## What This Is

A multi-tenant SaaS platform where Twitch streamers host live music blindtest sessions directly in their chat. Viewers guess song titles and artists in real-time, scores appear on an OBS overlay, and the streamer controls everything from a dashboard. Built on a Turborepo monorepo (Next.js 15, Node.js bot worker, Drizzle/PostgreSQL, Redis).

## Core Value

The streamer can run an engaging live blindtest on their Twitch stream with zero friction — chat guesses, bot reacts, overlay updates in real time.

## Current Milestone: v2.0 Funnier and Prettier Blindtest

**Goal:** Redesign the gameplay loop to be more engaging and competitive — fuzzy answer matching, streak/malus/double-shot scoring, active bot feedback, improved overlay, and live dashboard controls.

**Target features:**
- Advanced gameplay engine (fuzzy match, scoring window, streak, malus, double shot)
- Redesigned overlay (3 separate zones: iPod player, round feed, leaderboard)
- Active bot Twitch messages + chat commands (!score, !streak, !rank, !rules)
- Live dashboard editing (title/artist/featurings/malus during play)
- Score management (manual +1/-1, import/export JSON/CSV/image)

## Requirements

### Validated

<!-- Shipped in v1.0 — confirmed valuable -->

- ✓ User can log in with Twitch OAuth — Phase 1
- ✓ Platform creates a tenant account on first login — Phase 1
- ✓ User can connect/disconnect their Twitch bot — Phase 2
- ✓ User can create, view, and delete sessions — Phase 2
- ✓ User can import Spotify playlists as track lists — Phase 3
- ✓ User can view and manage tracks in a playlist — Phase 3
- ✓ Overlay displays scores and leaderboard via SSE — Phase 4
- ✓ Overlay supports 3 visual themes — Phase 4
- ✓ Admin can monitor sessions and trigger interventions — Phase 5
- ✓ Admin can quarantine and moderate users and content — Phase 5

### Active

<!-- Current v2.0 scope — building toward these -->

- [ ] User can run a session with fuzzy answer matching
- [ ] Viewer answers are scored with timing window (first finder gets max points)
- [ ] Double-shot bonus for guessing title + artist in same message
- [ ] Streak multiplier accumulates across consecutive found songs
- [ ] Streamer can configure malus trap terms per playlist
- [ ] Overlay redesigned with 3 independent zones (player, round feed, leaderboard)
- [ ] Bot sends automatic messages on key events (find, malus, streak)
- [ ] Viewers can query bot with !score, !streak, !rank, !rules
- [ ] Streamer can edit title/artist/featurings/malus live during a round
- [ ] Streamer can manually adjust viewer scores (+1/-1)
- [ ] Session scores can be exported (JSON, CSV, image) and imported

### Out of Scope

- Real-time chat DMs — not core to blindtest value
- Mobile native app — web-first
- Video posts / video overlay — out of scope v2
- OAuth login providers other than Twitch — unnecessary for target audience

## Context

- Twitch is the primary distribution channel — all gameplay is chat-driven
- Redis channels: `session:cmd:{sessionId}` (web→bot), `overlay:{tenantId}` (bot→SSE)
- Bot worker is a separate Node.js CJS process communicating via Redis pub/sub
- Existing overlay SSE at `/api/overlay/[token]` — will be extended for 3-zone support
- Game engine lives in `packages/game-engine` — core gameplay logic lives there
- Spotify import already exists — need to add title cleanup (strip remix/live/feat annotations)
- Deployment: Render (web + bot-worker), PostgreSQL with RLS, Redis

## Constraints

- **Tech stack**: Next.js 15 App Router + Node.js bot-worker — no major architecture change
- **Bot**: Twitch account owned by streamer — only chat:read + chat:edit scopes available
- **DB**: RLS enabled with Render non-superuser workaround (permissive INSERT policies)
- **Overlay**: Must remain public URL (no auth) — SSE endpoint unchanged contract

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Fuzzy matching: Sørensen-Dice bigrammes, seuil 0.8 | Tolerant of typos, common in French streams | Validated in Phase 06: tolerance tightened to 0.15 |
| Fenêtre de grattage: 3s configurable | Gives latecomers a chance, prevents winner-takes-all | Validated in Phase 06: loaded from gameConfigs.config.windowDurationMs |
| Double shot: lose ALL points if only one correct | Pure high-risk bonus, as designed | Validated in Phase 06: checkDoubleShot all-or-nothing, 8 passing tests |
| Streak breaks on wrong answer (including malus) | Punishes spam-guessing behavior | Validated in Phase 06: processStreaksAtRoundEnd + RoundStateManager |
| 3 overlay zones as separate URL paths | OBS browser source crop flexibility | — Pending |

---
*Last updated: 2026-03-18 — Phase 06 complete (game-engine-foundation)*
