---
phase: 06-game-engine-foundation
plan: "04"
subsystem: bot-worker
tags: [game-engine, redis, streak, atomic-upsert, shuffle, bot-session]
dependency_graph:
  requires: ["06-01", "06-02", "06-03"]
  provides: ["v2-bot-session-integration"]
  affects: ["apps/bot-worker"]
tech_stack:
  added: []
  patterns:
    - "INSERT ... ON CONFLICT DO UPDATE (atomic upsert, no read-then-write race)"
    - "Fisher-Yates shuffle order persisted in DB + Redis for crash recovery"
    - "Streak multiplier: 1 + streak * 0.1, applied to title/artist/double_shot only"
    - "Redis per-round state for windowOpenAt, foundThisRound, malusCounters"
key_files:
  created:
    - apps/bot-worker/src/round-state.ts
  modified:
    - apps/bot-worker/src/bot-session.ts
decisions:
  - "RoundStateManager constructor accepts the publisher Redis instance (not a new connection) to avoid extra connections"
  - "featurings field typed as string[] | null from Drizzle — cast with 'as' assertion in trackList assignment"
  - "Streak multiplier applied only to positive points and not to featuring/malus events, consistent with CONTEXT.md spec"
  - "Shuffle order: DB-first recovery strategy (crash-safe), then Redis, then generate new"
metrics:
  duration: "3min"
  completed_date: "2026-03-18"
  tasks_completed: 2
  files_changed: 2
---

# Phase 06 Plan 04: BotSession v2 Integration Summary

V2 game engine wired into BotSession: streak multiplier (1 + streak * 0.1), atomic DB upsert (INSERT ON CONFLICT DO UPDATE), Fisher-Yates shuffle order persisted in DB + Redis, configurable window duration from gameConfigs, and full per-round Redis state management via RoundStateManager.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Create Redis round state manager | f7651aa | apps/bot-worker/src/round-state.ts |
| 2 | Rewrite BotSession for v2 — streak, atomic upsert, shuffle, configurable window | e3f7e95 | apps/bot-worker/src/bot-session.ts |

## What Was Built

### RoundStateManager (`apps/bot-worker/src/round-state.ts`)

New class managing all Redis-backed per-round state for v2 game mechanics:

- **Key schema:**
  - `game:round:{sessionId}` — JSON RoundState object (windowOpenAt, windowMs, malusCounters, foundThisRound, featuringsFound)
  - `game:streak:{sessionId}:{viewer}` — numeric string with 24h TTL (sessions never run that long)
  - `game:shuffle:{sessionId}` — JSON array for shuffle order persistence across crashes

- **Methods:** initRound, getRoundState, updateRoundState, getStreak, setStreak, resetStreak, processStreaksAtRoundEnd, setShuffleOrder, getShuffleOrder, cleanup

### BotSession v2 (`apps/bot-worker/src/bot-session.ts`)

Complete v2 integration while preserving all existing functionality (chat, overlay pub/sub, bot status monitoring):

1. **Streak multiplier:** Applied in `handleChatMessage` before upsert. Formula: `1 + streak * 0.1`. Only applied to `correct_title`, `correct_artist`, `correct_answer`, `partial`, `double_shot` with positive points. Featuring and malus events are exempt.

2. **Atomic upsert:** `upsertScore` replaced with `INSERT ... ON CONFLICT DO UPDATE` targeting the `(sessionId, viewerUsername)` unique constraint (from migration 0013). Eliminates the read-then-write race condition.

3. **Shuffle order:** Generated with `fisherYatesShuffle(trackList.length)` at session start if not already stored. Persisted to both DB (`sessions.shuffleOrder`) and Redis for crash recovery. DB takes priority on load.

4. **Window duration:** Loaded from `gameConfigs.config.windowDurationMs` at session start. Defaults to 3000ms if not configured. Passed to `plugin.setCurrentTrack()` on every track change.

5. **Round lifecycle:** `handleNext()` calls `processStreaksAtRoundEnd()` before advancing, then reinitializes round state with `initRound()`. Resets `allParticipantsThisRound` set.

6. **Leaderboard:** `getLeaderboard()` now uses `parseFloat(s.score)` to handle the NUMERIC string returned by Drizzle ORM.

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as written.

**Note:** One pre-existing TypeScript error remains in `apps/bot-worker/src/index.ts` (line 13: unused `req` variable, `TS6133`). This was present before this plan and is out of scope per deviation rules. It is tracked as a pre-existing issue.

## Verification Results

```
TypeScript: 1 error remaining (pre-existing in index.ts, not related to this plan)
bot-session.ts: 0 errors

Static checks:
- onConflictDoUpdate: 1 occurrence (upsertScore)
- fisherYatesShuffle: 2 occurrences (import + call)
- RoundStateManager: 4 occurrences (import + field + instantiation + usage)
- streak multiplier formula (1 + streak * 0.1): 1 occurrence
- parseFloat(s.score): 1 occurrence (getLeaderboard)
- roundState.cleanup(): 1 occurrence (stop method)
```

## Self-Check: PASSED

Files exist:
- FOUND: apps/bot-worker/src/round-state.ts
- FOUND: apps/bot-worker/src/bot-session.ts

Commits exist:
- f7651aa — feat(06-04): create RoundStateManager
- e3f7e95 — feat(06-04): wire v2 game engine into BotSession
