# Playground — Static Twitch Blindtest

## What This Is

A **zero-backend static web app** for running live music blindtests on Twitch. A streamer opens
the app, types their channel name, loads a playlist, and plays. The app reads chat anonymously
(no token), scores guesses client-side, and drives an OBS overlay — no signup, no server, no
deploy infra. Built as a Vite + React SPA reusing the pure `packages/game-engine` scoring logic.

## Core Value

A streamer runs an engaging, competitive live blindtest with zero friction and zero setup cost —
chat guesses, the screen reacts with animations, the leaderboard updates in real time — and
anyone can use it without credentials.

## The Pivot (2026-06-14)

Originally a multi-tenant SaaS (Next.js + Postgres/RLS + Redis + separate bot-worker, OAuth
tokens). The only thing forcing all that backend was the bot *speaking* in chat (`chat:edit`
needs OAuth). Dropping the talking bot — replaced by rich overlay animations — collapses the
entire backend:

- Anonymous Twitch IRC (`justinfan`) reads chat token-free in the browser.
- Scoring is deterministic → runs client-side via the reused game-engine.
- OBS ↔ control sync via `BroadcastChannel` (same-PC tabs) → no Redis/SSE.
- Config + scores live in localStorage + JSON files → no database.

`!score`/`!rank` chat commands become unnecessary because the leaderboard is always on screen.

## Current Milestone: v2.0 Static Blindtest

**Goal:** Rebuild the blindtest as a static client app — anonymous chat reading, client-side
scoring, multi-source music player, control panel, animated overlay, and score export — usable
by anyone with no account or token.

**Target features:**
- Anonymous Twitch chat reader (no token)
- Client-side game loop (window scoring, streak, malus, double-shot) reusing game-engine
- Playlists & config 100% client (localStorage + JSON import/export)
- Multi-source music player (YouTube IFrame + Spotify embed)
- Control panel (start/reveal/next, live edits, +/- score, mini podium)
- Animated overlay (blurred cover, leaderboard, finds/malus/streak feed) synced via BroadcastChannel
- Score export (JSON/CSV/PNG podium)
- In-app streamer guide

## Requirements

### Validated (gameplay built in old Phase 06, reused)

- ✓ Fuzzy answer matching (Sørensen-Dice, malus tolerance 0.15)
- ✓ Window scoring (first finder max, proportional decay)
- ✓ Double-shot all-or-nothing
- ✓ Streak multiplier (breaks on miss/malus)
- ✓ Malus trap terms per playlist

### Active (v2.0 static scope)

- [ ] App reads Twitch chat anonymously with no token
- [ ] Game loop runs fully client-side (in-memory round state)
- [ ] Playlists created/edited/persisted client-side + JSON import/export
- [ ] Music plays from YouTube and Spotify through one player interface
- [ ] Operator drives rounds from a control panel (live edits, manual score)
- [ ] Overlay mirrors state via BroadcastChannel with animated feed
- [ ] Scores export to JSON/CSV/PNG
- [ ] In-app guide covers setup, rules, OBS overlay

### Out of Scope

- Any server-side backend (database, auth, bot process) — the whole point of the pivot
- Bot speaking in chat — replaced by overlay animations
- Multi-tenant accounts / login — anyone uses it directly
- Mobile native app — web-first
- Spotify full-track playback requiring premium auth — stays within embed limits

## Context

- Twitch chat is read anonymously via `wss://irc-ws.chat.twitch.tv` with a `justinfan` login
- `packages/game-engine` (fuzzy-matcher, normalizer, scorer, shuffle, plugins) is pure — verified zero Redis/DB imports — and is lifted into the SPA as-is
- `packages/game-types` reused
- OBS browser source + control panel run on the streamer's same machine → BroadcastChannel suffices for sync
- YouTube IFrame API is the unconstrained music path; Spotify embed is supported within its 30s/limit constraints
- Old `apps/web` backend, `apps/bot-worker`, `packages/db` are dropped from the active build

## Constraints

- **Tech stack**: Vite + React SPA, static export — no backend
- **Sync**: BroadcastChannel — control + overlay must be same browser/machine
- **Music**: Spotify limited to embed; YouTube full playback via IFrame API
- **Storage**: client-only (localStorage + file import/export) — no persistence server

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Drop the talking bot | It was the sole driver of OAuth + backend | Pivot to zero-backend static app |
| Vite + React SPA | Lightest for pure client, trivial static deploy | Locked 2026-06-14 |
| BroadcastChannel for OBS↔control | Same-PC tabs, zero server | Locked 2026-06-14 |
| YouTube + Spotify multi-source | YT unconstrained, Spotify familiar metadata | Locked 2026-06-14 |
| 100% client config/scores | No DB needed for side-project scope | Locked 2026-06-14 |
| Keep game-engine, drop rest | Scoring is pure & tested; backend is dead weight | Locked 2026-06-14 |

---
*Last updated: 2026-06-14 — static-app pivot. Supersedes the SaaS architecture.*
