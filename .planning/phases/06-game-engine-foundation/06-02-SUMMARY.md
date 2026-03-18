---
phase: 06-game-engine-foundation
plan: 02
subsystem: game-engine
tags: [typescript, vitest, tdd, blindtest, scoring, game-engine]

# Dependency graph
requires:
  - 06-01 (ScoringEvent.reason union, plugin.interface.ts types, it.todo() stubs)
provides:
  - BlindtestPlugin v2 with timing window, malus trap, double-shot v2, featuring scoring
  - fuzzyMatch with 0.15 default tolerance (stricter than 0.30 v1)
  - getWindowOpenAt() for external BotSession access
  - 46 passing tests covering all four GAME-01/03/04/05 mechanics
affects:
  - 06-03-PLAN (streak multiplier uses BlindtestPlugin v2 onChatMessage return values)
  - 06-04-PLAN (shuffle uses separate plugin, no dependency on BlindtestPlugin)
  - apps/bot-worker (BotSession will call BlindtestPlugin v2 API)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "TDD RED-GREEN-REFACTOR: 25 failing tests → all pass → extract private helper methods"
    - "Decay formula: pts = 3 - 2*(elapsed_ms/windowDurationMs), Math.round(x*10)/10 for 1 decimal"
    - "Double-shot all-or-nothing: both targets required, return ScoringEvent{points:0,reason:'double_shot'} on partial"
    - "Malus priority: checkMalus before fuzzyMatch title/artist — malus wins even if message also matches correct answer"
    - "Featuring independence: foundFeaturings Set separate from answeredViewers — viewers can score both"

key-files:
  created: []
  modified:
    - packages/game-engine/src/blindtest-plugin.ts
    - packages/game-engine/src/fuzzy-matcher.ts
    - packages/game-engine/src/scorer.test.ts

key-decisions:
  - "fuzzyMatch default tolerance changed to 0.15 — stricter per GAME-03 malus detection requirement"
  - "computeDecayPoints returns { pts, elapsed_ms } object — cleaner than separate return values"
  - "Double-shot window: both title AND artist share the same windowOpenAt — same timing window"
  - "Failed double-shot (partial match) adds viewer to answeredViewers — no retry allowed per spec"
  - "Viewer after-window gets null not 0 pts — silently ignored, does not consume their guess attempt"

requirements-completed: [GAME-01, GAME-03, GAME-04, GAME-05]

# Metrics
duration: 5min
completed: 2026-03-18
---

# Phase 6 Plan 02: BlindtestPlugin v2 Scoring Mechanics Summary

**BlindtestPlugin v2 with timing window decay (GAME-01), malus trap terms (GAME-03), double-shot all-or-nothing (GAME-04), and independent featuring scoring (GAME-05) — all 46 tests passing via TDD RED-GREEN-REFACTOR**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-18T18:16:31Z
- **Completed:** 2026-03-18T18:21:31Z
- **Tasks:** 3 (RED, GREEN, REFACTOR)
- **Files modified:** 3

## Accomplishments

- Converted 25 `it.todo()` stubs to real failing tests (RED), then made all pass (GREEN), then refactored (REFACTOR)
- Timing window: first finder = 3pts, decay formula `pts = 3 - 2*(elapsed/window)` rounded to 1dp, null after window
- Malus: escalating -1/-2/-3 per viewer per round, fuzzy detection at 0.15 tolerance, malus wins over correct answer
- Double-shot: both title+artist required or 0pts (all-or-nothing), reason='double_shot', first at t=0 gives 12pts
- Featurings: 1pt each, independent Set tracking, viewers can score featurings AND still guess title/artist
- fuzzyMatch default tolerance changed from 0.30 to 0.15 as specified

## Task Commits

Each step committed atomically:

1. **RED: Add failing v2 tests** — `5cb0a35` (test)
2. **GREEN: Implement BlindtestPlugin v2** — `ef2cfc6` (feat)
3. **REFACTOR: Extract helper methods** — `e41f6dc` (refactor)

## Files Created/Modified

- `packages/game-engine/src/blindtest-plugin.ts` — Rewritten to v2.0.0 with TrackOptions, timing window, malus, double-shot, featurings
- `packages/game-engine/src/fuzzy-matcher.ts` — Default tolerance changed from 0.30 to 0.15
- `packages/game-engine/src/scorer.test.ts` — 46 passing tests (25 converted from todo, existing v1 tests updated)

## Decisions Made

- Changed fuzzyMatch default to 0.15 — the plan required this for malus detection; 0.30 was the v1 value
- `computeDecayPoints` returns `{ pts, elapsed_ms }` struct — cleaner API than two separate variables
- Double-shot title+artist share same `windowOpenAt` timestamp — simpler implementation, same decay for both
- Post-window guess returns `null` without adding to `answeredViewers` — viewer's guess is not consumed by a missed window
- Failed double-shot (one of two correct) does add to `answeredViewers` — per spec: "viewer wasted their guess"

## Deviations from Plan

None - plan executed exactly as written. TDD RED-GREEN-REFACTOR followed in order.

## Test Coverage Summary

| Describe block | Tests |
|---|---|
| normalize | 3 |
| fuzzyMatch | 6 (incl. 0.15 tolerance test) |
| BlindtestPlugin (title-only) | 6 |
| timing window GAME-01 | 7 |
| malus GAME-03 | 7 |
| double-shot GAME-04 | 8 |
| featurings GAME-05 | 7 |
| shuffle GAME-07 | 3 (todo, Plan 04) |

## Self-Check: PASSED

- `packages/game-engine/src/blindtest-plugin.ts` — FOUND, version = '2.0.0'
- `packages/game-engine/src/fuzzy-matcher.ts` — FOUND, tolerance = 0.15
- `packages/game-engine/src/scorer.test.ts` — FOUND, 46 passing tests
- `.planning/phases/06-game-engine-foundation/06-02-SUMMARY.md` — FOUND
- Commits: `5cb0a35` (RED), `ef2cfc6` (GREEN), `e41f6dc` (REFACTOR) — all FOUND
