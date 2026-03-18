---
phase: 06-game-engine-foundation
plan: 01
subsystem: database
tags: [drizzle, postgres, typescript, vitest, game-engine, scoring]

# Dependency graph
requires: []
provides:
  - Extended ScoringEvent interface with malus/featuring/double_shot reason types and streakMultiplier/elapsed_ms fields
  - sessionScores.score as NUMERIC(10,1), streak column, and UNIQUE(session_id, viewer_username) constraint
  - tracks.featurings TEXT[] and playlists.malus_terms TEXT[] columns
  - sessions.shuffle_order JSONB column
  - Migration 0013_v2_game_engine.sql with all 7 v2 schema alterations
  - 43 it.todo() test stubs documenting all v2 mechanics as Wave 0 RED contracts
affects:
  - 06-02-PLAN (timing window + streak implementation uses these types and DB columns)
  - 06-03-PLAN (malus/featurings/double-shot use ScoringEvent.reason union and playlist columns)
  - 06-04-PLAN (shuffle uses sessions.shuffle_order)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Drizzle numeric column: numeric('col', { precision: 10, scale: 1 }).notNull().default('0') for decimal scoring"
    - "Drizzle text array: text('col').array().default(sql`'{}'::text[]`) for TEXT[] columns"
    - "Migration breakpoints: --> statement-breakpoint between each ALTER TABLE"

key-files:
  created:
    - packages/db/migrations/0013_v2_game_engine.sql
  modified:
    - packages/game-types/src/plugin.interface.ts
    - packages/db/src/schema/sessions.ts
    - packages/db/src/schema/playlists.ts
    - packages/db/migrations/meta/_journal.json
    - packages/game-engine/src/scorer.test.ts

key-decisions:
  - "ScoringEvent.reason union extended additively — all 4 v1 values preserved for backward compatibility"
  - "Migration 0013 uses single SQL file with 7 ALTER TABLE statements and --> statement-breakpoint separators"
  - "it.todo() used for all v2 test stubs — Wave 0 RED contract that Plan 02/03/04 will fill in"

patterns-established:
  - "Wave 0 TDD pattern: write it.todo() stubs first as behavioral contracts, convert to real tests in implementing plan"
  - "Additive schema extension: new columns nullable or with defaults — no breaking changes to existing v1 rows"

requirements-completed: [GAME-01, GAME-02, GAME-03, GAME-04, GAME-05, GAME-06, GAME-07, GAME-08]

# Metrics
duration: 3min
completed: 2026-03-18
---

# Phase 6 Plan 01: v2 Contracts, DB Schema, and Test Stubs Summary

**Extended ScoringEvent with 7 reason types, migrated sessionScores to NUMERIC(10,1) + streak + unique constraint, added featurings/malus_terms/shuffle_order columns, and documented all v2 mechanics as 43 it.todo() test stubs**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-18T18:11:34Z
- **Completed:** 2026-03-18T18:14:06Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments

- All v2 type contracts established: ScoringEvent supports malus/featuring/double_shot + streakMultiplier + elapsed_ms
- Migration 0013 provides lossless upgrade path for all v2 DB columns (numeric score, streak, unique constraint, featurings, malus_terms, shuffle_order)
- 43 it.todo() stubs in scorer.test.ts document every v2 behavior for Plans 02-04 to implement

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend ScoringEvent interface and Drizzle schema for v2** - `9a3dcd6` (feat)
2. **Task 2: Write migration 0013_v2_game_engine.sql and update journal** - `197ba00` (feat)
3. **Task 3: Write failing test stubs for all v2 mechanics** - `a199a19` (test)

## Files Created/Modified

- `packages/game-types/src/plugin.interface.ts` — ScoringEvent extended with 3 new reason values and 2 optional fields
- `packages/db/src/schema/sessions.ts` — sessionScores.score changed to numeric(10,1), streak added, sessions.shuffleOrder added
- `packages/db/src/schema/playlists.ts` — tracks.featurings and playlists.malusTerms TEXT[] added
- `packages/db/migrations/0013_v2_game_engine.sql` — 7 ALTER TABLE statements for all v2 schema changes
- `packages/db/migrations/meta/_journal.json` — idx 13 entry added
- `packages/game-engine/src/scorer.test.ts` — 43 it.todo() stubs in 6 describe blocks

## Decisions Made

- Preserved all 4 existing v1 ScoringEvent reason values for backward compatibility — v1 BlindtestPlugin remains unchanged
- Used `numeric('score', { precision: 10, scale: 1 })` with string default `'0'` (Drizzle numeric requires string defaults)
- Migration uses `USING score::NUMERIC(10,1)` for lossless cast — existing integer scores become X.0
- it.todo() chosen over `it.skip()` or real failing tests — todo shows pending count without failing CI

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

Migration 0013 must be applied to the database before Phase 6 plans 02-04 can be used in production. Run:
```bash
pnpm --filter @playground/db db:migrate
```

## Next Phase Readiness

- Plan 02 (timing window + streak) can now reference `ScoringEvent.reason` types and `sessionScores.streak` column
- Plan 03 (malus + featurings + double-shot) can reference `playlists.malus_terms` and `tracks.featurings`
- Plan 04 (shuffle) can reference `sessions.shuffle_order`
- All 18 v1 tests still pass — no regressions

---
*Phase: 06-game-engine-foundation*
*Completed: 2026-03-18*
