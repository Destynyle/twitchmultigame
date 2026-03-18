---
phase: 06-game-engine-foundation
plan: 03
subsystem: testing
tags: [game-engine, fisher-yates, shuffle, vitest, tdd]

# Dependency graph
requires:
  - phase: 06-02
    provides: setCurrentTrack with windowDurationMs option in blindtest-plugin.ts
provides:
  - fisherYatesShuffle utility exported from packages/game-engine
  - GAME-07 unit tests (5 tests) — permutation correctness, edge cases, statistical check
  - GAME-08 passing tests (4 tests) — configurable window duration validated at plugin level
affects:
  - 06-04 (BotSession will import fisherYatesShuffle to shuffle playlist at session start)
  - apps/bot-worker (key_links: BotSession calls fisherYatesShuffle)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Fisher-Yates shuffle: Array.from + in-place swap loop, O(n) time/space"
    - "TDD: RED (import fails) → GREEN (implementation) → tests as living spec"

key-files:
  created:
    - packages/game-engine/src/shuffle.ts
  modified:
    - packages/game-engine/src/index.ts
    - packages/game-engine/src/scorer.test.ts

key-decisions:
  - "GAME-08 window duration tests implemented as real passing tests (not it.todo) because Plan 02 already shipped windowDurationMs"
  - "window=0 behavior: first finder scores (elapsed=0, 0>0 is false), any subsequent guess (elapsed>=1) gets null"

patterns-established:
  - "fisherYatesShuffle(length): number[] — pure function, no side effects, safe to call at BotSession start"

requirements-completed: [GAME-07, GAME-08]

# Metrics
duration: 3min
completed: 2026-03-18
---

# Phase 06 Plan 03: Shuffle Utility and Configurable Window Tests Summary

**Fisher-Yates shuffle function exported from game-engine (GAME-07) and 4 real passing tests for configurable window duration (GAME-08)**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-18T18:23:57Z
- **Completed:** 2026-03-18T18:26:57Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Implemented `fisherYatesShuffle(length: number): number[]` — O(n) Fisher-Yates, exported from `packages/game-engine`
- Replaced `it.todo` stubs in `scorer.test.ts` with 5 real shuffle tests covering length, permutation correctness, edge cases (0 and 1), and statistical distribution
- Added 4 passing GAME-08 tests validating that window duration is configurable (3000ms, 5000ms, 1000ms, 0ms instant-close)
- Total game-engine test suite: 53 tests passing

## Task Commits

Each task was committed atomically:

1. **Task 1: Fisher-Yates shuffle utility with tests** - `8a3345b` (feat)
2. **Task 2: Configurable window duration tests** - `261acf5` (feat)

**Plan metadata:** TBD (docs: complete plan)

_Note: Task 1 used TDD — RED (import failure) → GREEN (shuffle.ts created) in a single logical pass_

## Files Created/Modified
- `packages/game-engine/src/shuffle.ts` — Fisher-Yates shuffle: `fisherYatesShuffle(length)` returns `number[]`
- `packages/game-engine/src/index.ts` — Added `export { fisherYatesShuffle } from './shuffle'`
- `packages/game-engine/src/scorer.test.ts` — Replaced shuffle stubs with 5 real tests; added 4 GAME-08 tests

## Decisions Made
- GAME-08 implemented as real tests (not `it.todo`) because Plan 02 already shipped `windowDurationMs` in `setCurrentTrack` — the contract is already live
- `window=0` behavior validated: first finder still scores (elapsed=0, `0 > 0` is false), any subsequent viewer (elapsed >= 1ms) gets `null` — instant window close

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- `vitest` not on `$PATH` — used package-local binary at `packages/game-engine/node_modules/.bin/vitest`. Pre-existing environment issue, not caused by this plan.
- `apps/bot-worker/src/bot-session.test.ts` has 1 pre-existing failing test unrelated to this plan. Deferred to the bot-worker scope (out of Plan 03 scope).

## Next Phase Readiness
- `fisherYatesShuffle` is ready for Plan 04 (BotSession integration — import and call at session start)
- All game-engine tests green (53 passing)
- No blockers for Plan 04

## Self-Check: PASSED

All files confirmed on disk. All commits confirmed in git log.

---
*Phase: 06-game-engine-foundation*
*Completed: 2026-03-18*
