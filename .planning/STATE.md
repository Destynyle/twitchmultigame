# State

## Current Position

Phase: Not started (defining requirements)
Plan: —
Status: Defining requirements
Last activity: 2026-03-17 — Milestone v2.0 started

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-17)

**Core value:** The streamer can run an engaging live blindtest on their Twitch stream with zero friction — chat guesses, bot reacts, overlay updates in real time.
**Current focus:** v2.0 requirements definition

## Accumulated Context

### Architecture
- Redis channels: `session:cmd:{sessionId}` (web→bot), `overlay:{tenantId}` (bot→SSE), `sessions:events` (web→bot lifecycle)
- Bot status: `bot:status:{sessionId}` JSON key (connected/reconnecting, TTL 300s)
- Token Twitch chiffré AES-256-GCM en DB
- Overlay SSE: `GET /api/overlay/[token]`, public, nodejs runtime

### DB State
- Current migration: 0011_rls_insert_policies.sql
- RLS INSERT workaround in place for Render non-superuser

### Key Files
- `apps/web/server/redis.ts` — Redis publisher/subscriber helpers
- `apps/web/server/auth.ts` — NextAuth config (Twitch OAuth)
- `apps/bot-worker/src/bot-session.ts` — BotSession (core, writes bot:status Redis)
- `apps/bot-worker/src/session-runner.ts` — listens to sessions:events
- `packages/game-engine` — game execution logic (bot-worker only)
- `packages/game-types` — shared interfaces and DTOs

### Pending from v1.0
- Epic 7.6: Weekly official playlist (not yet built)
- Epic 5: Viewer profiles (5.1–5.6) — deferred
- Epic 6: Stripe/freemium (6.1–6.5) — deferred
