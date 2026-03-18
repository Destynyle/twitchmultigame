---
phase: 06-game-engine-foundation
verified: 2026-03-18T19:35:00Z
status: passed
score: 15/15 must-haves verified
re_verification: false
human_verification:
  - test: "Run a live game session to validate streak multiplier accumulation across rounds"
    expected: "Viewer scores increase by 10% per consecutive round of scoring; multiplier resets on miss or malus"
    why_human: "Streak logic spans multiple Redis reads across handleNext() calls — not unit-testable without a running session"
  - test: "Apply migration 0013 to staging database and verify no data loss"
    expected: "Existing session_scores rows have score cast to NUMERIC(10,1) with '.0' suffix; new streak/unique constraint active"
    why_human: "Migration has not been applied to any environment yet — USING clause behavior on live data requires manual check"
---

# Phase 6: Game Engine Foundation Verification Report

**Phase Goal:** Build the v2 game engine foundation — plugin interface contracts, DB schema migration, scoring mechanics (timing window, malus, double-shot, featurings, streak), shuffle utility, and BotSession integration.
**Verified:** 2026-03-18T19:35:00Z
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | ScoringEvent.reason union includes malus, featuring, and double_shot | VERIFIED | `plugin.interface.ts` line 20: full 7-value union confirmed |
| 2 | sessionScores.score column is NUMERIC(10,1) not INTEGER | VERIFIED | `sessions.ts` line 41: `numeric('score', { precision: 10, scale: 1 })` |
| 3 | sessionScores table has a UNIQUE constraint on (session_id, viewer_username) | VERIFIED (SQL only) | Migration 0013 line 22: `ADD CONSTRAINT session_scores_session_viewer_unique UNIQUE (session_id, viewer_username)` |
| 4 | tracks table has a featurings TEXT[] column | VERIFIED | `playlists.ts` line 62: `featurings: text('featurings').array()` |
| 5 | playlists table has a malus_terms TEXT[] column | VERIFIED | `playlists.ts` line 28: `malusTerms: text('malus_terms').array()` |
| 6 | sessions table has a shuffle_order JSONB column | VERIFIED | `sessions.ts` line 20: `shuffleOrder: jsonb('shuffle_order')` |
| 7 | First finder of title or artist gets 3 pts; in-window viewers get linearly decayed points | VERIFIED | `blindtest-plugin.ts` computeDecayPoints(): `3 - 2*(elapsed/window)` rounded to 1dp; 8 passing tests in timing window describe block |
| 8 | A viewer typing a malus trap term loses escalating points and correct answer is ignored | VERIFIED | checkMalus() called first in onChatMessage(); 7 passing malus tests confirm -1/-2/-3 escalation |
| 9 | Double-shot scores (title_pts + artist_pts) x 2; one correct = 0 for both | VERIFIED | checkDoubleShot(): partial match returns `{points:0,reason:'double_shot'}`; 8 passing tests |
| 10 | Each featuring is guessable independently for 1 pt, no timing window | VERIFIED | checkFeaturing() uses separate foundFeaturings Set; 7 passing featuring tests |
| 11 | Fisher-Yates shuffle produces a permutation where every track index appears exactly once | VERIFIED | `shuffle.ts`: standard F-Y implementation; 5 passing shuffle tests confirm correctness |
| 12 | Streak multiplier is computed in BotSession, not in the plugin | VERIFIED | `bot-session.ts` line 256: `multiplier = 1 + streak * 0.1` in handleChatMessage() |
| 13 | Score upsert uses INSERT ON CONFLICT DO UPDATE (atomic, no read-then-write) | VERIFIED | `bot-session.ts` line 434: `.onConflictDoUpdate({...})` replaces old SELECT-then-UPDATE |
| 14 | BotSession loads shuffle order at session start and uses it for track indexing | VERIFIED | `bot-session.ts` lines 121-133: DB-first recovery → Redis → generate new; fisherYatesShuffle(trackList.length) |
| 15 | Window duration is read from gameConfigs and passed to the plugin | VERIFIED | `bot-session.ts` lines 106-110: configRow.config.windowDurationMs with 3000ms default; passed in setCurrentTrack options |

**Score:** 15/15 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/game-types/src/plugin.interface.ts` | Extended ScoringEvent with v2 reason types and optional metadata | VERIFIED | Contains `'malus' \| 'featuring' \| 'double_shot'`, `streakMultiplier?`, `elapsed_ms?` |
| `packages/db/migrations/0013_v2_game_engine.sql` | Migration adding featurings, malus_terms, streak, numeric score, unique constraint, shuffle_order | VERIFIED | 7 ALTER TABLE statements, contains NUMERIC(10,1) cast |
| `packages/game-engine/src/scorer.test.ts` | Tests for all v2 mechanics | VERIFIED | 55 tests passing (53 real + 2 smoke); no it.todo() entries remain in main mechanics |
| `packages/game-engine/src/blindtest-plugin.ts` | V2 BlindtestPlugin with timing window, malus, double-shot, featurings | VERIFIED | version='2.0.0', contains windowOpenAt tracking |
| `packages/game-engine/src/fuzzy-matcher.ts` | Fuzzy matcher with 0.15 default tolerance | VERIFIED | `tolerance = 0.15` on line 36 |
| `packages/game-engine/src/shuffle.ts` | Fisher-Yates shuffle function | VERIFIED | Exports `fisherYatesShuffle`, correct F-Y algorithm |
| `packages/game-engine/src/index.ts` | Barrel export includes fisherYatesShuffle | VERIFIED | Line 7: `export { fisherYatesShuffle } from './shuffle'` |
| `apps/bot-worker/src/round-state.ts` | Redis round state manager | VERIFIED | RoundStateManager class with all required methods; game:round:, game:streak:, game:shuffle: key patterns |
| `apps/bot-worker/src/bot-session.ts` | V2 BotSession with streak multiplier, atomic upsert, shuffle, configurable window | VERIFIED | All four v2 concerns wired |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `packages/db/src/schema/sessions.ts` | `0013_v2_game_engine.sql` | Drizzle schema matches migration SQL | VERIFIED | numeric score, streak, shuffleOrder all present in both |
| `packages/game-types/src/plugin.interface.ts` | `packages/game-engine/src/scorer.test.ts` | Tests import ScoringEvent with new reason types | VERIFIED | Tests assert `reason === 'malus'`, `'double_shot'`, `'featuring'` |
| `packages/game-engine/src/blindtest-plugin.ts` | `packages/game-types/src/plugin.interface.ts` | ScoringEvent with new reason types | VERIFIED | Returns events with reason='malus'/'double_shot'/'featuring' |
| `packages/game-engine/src/blindtest-plugin.ts` | `packages/game-engine/src/fuzzy-matcher.ts` | fuzzyMatch calls with 0.15 tolerance for malus detection | VERIFIED | checkMalus() passes tolerance=0.15 explicitly (line 55) |
| `apps/bot-worker/src/bot-session.ts` | `packages/db/src/schema/sessions.ts` | Atomic upsert using onConflictDoUpdate | VERIFIED | onConflictDoUpdate targets [sessionScores.sessionId, sessionScores.viewerUsername] |
| `apps/bot-worker/src/bot-session.ts` | `packages/game-engine/src/shuffle.ts` | fisherYatesShuffle imported for session start | VERIFIED | Import line 9; called at line 126 with trackList.length |
| `apps/bot-worker/src/round-state.ts` | Redis | game:round:{sessionId} key for per-round state | VERIFIED | roundKey() returns `game:round:${this.sessionId}` |
| `apps/bot-worker/src/bot-session.ts` | `apps/bot-worker/src/round-state.ts` | RoundStateManager imported and instantiated | VERIFIED | Import line 8; instantiated at line 103 |

---

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|-------------|---------------|-------------|--------|----------|
| GAME-01 | 06-01, 06-02 | 3-second timing window; first finder max points | SATISFIED | computeDecayPoints() + 7 timing window tests passing |
| GAME-02 | 06-01, 06-04 | Streak multiplier; breaks on miss or malus | SATISFIED | `1 + streak * 0.1` in handleChatMessage; processStreaksAtRoundEnd() at round end |
| GAME-03 | 06-01, 06-02 | Malus trap terms per playlist; viewer loses points | SATISFIED | checkMalus() first in priority; 7 passing malus tests |
| GAME-04 | 06-01, 06-02 | Double-shot: both correct = bonus; one correct = 0 pts | SATISFIED | checkDoubleShot() all-or-nothing logic; 8 passing tests |
| GAME-05 | 06-01, 06-02 | Featuring guesses scored instantly, independently | SATISFIED | checkFeaturing() with separate foundFeaturings Set; 7 passing tests |
| GAME-06 | 06-01, 06-04 | Atomic DB writes for scoring state | SATISFIED | INSERT ON CONFLICT DO UPDATE in upsertScore; unique constraint in migration 0013 |
| GAME-07 | 06-01, 06-03, 06-04 | Fisher-Yates shuffle, non-repetitive playlist | SATISFIED | fisherYatesShuffle() in shuffle.ts; used in BotSession start and handleNext() |
| GAME-08 | 06-01, 06-03, 06-04 | Configurable scoring window duration per session | SATISFIED | windowDurationMs loaded from gameConfigs; 4 real passing GAME-08 tests |

All 8 GAME requirements satisfied. No orphaned requirements detected.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `apps/bot-worker/src/index.ts` | 13 | `TS6133: 'req' declared but never read` | Info | Pre-existing issue, not introduced by Phase 6; does not affect BotSession functionality |
| `packages/db/src/schema/sessions.ts` | — | UNIQUE constraint present in migration SQL but not declared in Drizzle schema definition | Warning | Schema drift: `onConflictDoUpdate` works at runtime (DB enforces constraint), but Drizzle tooling (drizzle-kit push/generate) won't know about this constraint. Does not block current functionality. |
| `packages/game-engine/src/blindtest-plugin.ts` | 106 | Default `windowDurationMs = 5000` in setCurrentTrack (not 3000ms) | Info | Plan specifies 3000ms as BotSession default; plugin default doesn't matter since BotSession always passes explicit value. Tests use explicit values. No functional issue. |

No blocker anti-patterns found.

---

### Human Verification Required

#### 1. Live Streak Accumulation Test

**Test:** Run a game session with 2+ viewers. Have viewer1 score on 3 consecutive rounds, then miss round 4. Check their score multiplier in round 5.
**Expected:** Viewer1's scoring events in rounds 1-3 show multiplier 1.0, 1.1, 1.2 respectively. After missing round 4, multiplier resets to 1.0 in round 5.
**Why human:** Streak state persists across handleNext() calls and Redis reads — this multi-round flow cannot be verified through static analysis or unit tests.

#### 2. Migration 0013 Application to Database

**Test:** Run `pnpm --filter @playground/db db:migrate` against a database containing existing session_scores rows.
**Expected:** All existing rows have score cast losslessly to NUMERIC(10,1). New streak and unique columns exist. shuffle_order column on sessions table is JSONB and nullable.
**Why human:** The USING clause `score::NUMERIC(10,1)` behavior on live integer data must be confirmed empirically. Migration has not been applied to any environment yet.

---

### Schema Drift Note

The UNIQUE constraint `session_scores_session_viewer_unique (session_id, viewer_username)` is defined in `packages/db/migrations/0013_v2_game_engine.sql` but is not declared in the Drizzle schema (`packages/db/src/schema/sessions.ts`). This means:

- The constraint **exists in the database** after migration is applied (correct behavior)
- The `onConflictDoUpdate` in bot-session.ts works correctly at runtime (Drizzle passes raw SQL targeting those columns)
- However, `drizzle-kit generate` would not be aware of this constraint for future migrations

This is a warning, not a blocker. The Phase 6 goal is achieved. A future migration that adds or modifies this constraint may need to handle this drift.

---

## Gaps Summary

No gaps. All 15 observable truths verified. All 8 GAME requirements satisfied. All 9 required artifacts exist and are substantive and wired. 55 tests pass. TypeScript compiles cleanly in all packages (one pre-existing TS6133 warning in bot-worker/src/index.ts, unrelated to Phase 6 work).

The phase goal — building the v2 game engine foundation including plugin interface contracts, DB schema migration, scoring mechanics, shuffle utility, and BotSession integration — is fully achieved.

---

_Verified: 2026-03-18T19:35:00Z_
_Verifier: Claude (gsd-verifier)_
