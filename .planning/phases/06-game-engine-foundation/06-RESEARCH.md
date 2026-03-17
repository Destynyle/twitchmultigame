# Phase 6: Game Engine Foundation - Research

**Researched:** 2026-03-17
**Domain:** TypeScript game plugin, Drizzle ORM schema migration, Redis in-memory state, atomic PostgreSQL upserts
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Fuzzy matching:**
- Keep Levenshtein algorithm (already in `packages/game-engine/src/fuzzy-matcher.ts`)
- Lower tolerance from 0.30 → 0.15 (15% error ratio) — stricter matching
- Short target rule unchanged: targets < 3 chars require exact/substring match

**Point values:**
- Title — first finder: 3 pts
- Artist — first finder: 3 pts (changed from v1's 2 pts — title and artist now equal)
- In-window (title or artist): linear decay from 3 pts at t=0 to 1 pt at t=window_duration
  - Formula: `pts = 3 - 2 * (elapsed_ms / window_ms)` rounded to 1 decimal
  - Example (3s window): found at 1.5s → 2.0 pts
- After window closes: viewer is ignored silently — no scoring event emitted
- Featuring: 1 pt per featuring, instant (no timing window), each featuring guessable independently
- Double-shot (title + artist in one message, both correct): (title_pts + artist_pts) × 2
  - At t=0 (both first): (3 + 3) × 2 = 12 pts
  - At t=1.5s: (2.0 + 2.0) × 2 = 8.0 pts
  - If only one of the two is correct: 0 pts for both (high-risk, all-or-nothing)

**Streak multiplier:**
- Increment: +0.1× per consecutive round where viewer found at least one answer (title, artist, or featuring counts)
  - Streak 1 = ×1.1, Streak 2 = ×1.2, Streak 5 = ×1.5, etc.
- No cap — streak can grow indefinitely
- Applied to: title and artist points only — featuring points (1 pt fixed) are NOT multiplied
- Points stored: 1 decimal place (e.g. 2.6, not 3)
- Streak resets on any of:
  - Round missed (viewer found nothing that round)
  - Viewer absent (no message in chat that round)
  - Malus triggered (even if streak was active)
  - Double-shot failure (only one of the two correct)
  - Wrong answer submitted

**Malus trap terms:**
- Detection: fuzzy match — same Levenshtein algorithm and 0.15 tolerance as answer matching
- Penalty structure (per round, resets each new round):
  - 1st malus trigger: −1 pt
  - 2nd malus trigger: −2 pts
  - 3rd malus trigger: −3 pts
  - Nth trigger: −N pts
  - Counter resets at start of each new round
- Message contains both malus AND correct answer: malus wins — viewer receives only the penalty, correct answer is not scored
- Streak: malus breaks streak
- Configuration: malus terms stored per playlist (not per session); streamer configures them in the playlist settings

**Configurable scoring window:**
- Default: 3 seconds
- Configurable per session (GAME-08) — stored in `gameConfigs` JSONB
- Bot worker reads config at round start; window timer runs in bot worker process

**Shuffle order:**
- Fisher-Yates shuffle applied when session starts (GAME-07)
- Non-repetitive: each track plays once before any repeats
- Shuffle result stored in session state (Redis or session record) so order survives reconnects

### Claude's Discretion
- Redis game state key schema (per-round data: window open timestamp, malus counters per viewer, streak counters, featurings state) — implementation detail
- DB sync strategy (when Redis state flushes to DB, crash recovery) — implementation detail
- `gameConfigs` JSONB shape for malus terms and window duration
- Migration numbering and column types for new DB fields

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| GAME-01 | Viewer answers are scored within a 3-second window after the first correct guess (first finder gets max points, others in window get fewer) | Timing window in Redis per-round state; linear decay formula locked in CONTEXT.md |
| GAME-02 | Streak multiplier accumulates when a viewer finds at least one answer per consecutive round; breaks on miss or wrong answer (including malus) | Streak counter in Redis, flushed to new `streak` column in `session_scores` |
| GAME-03 | Streamer can configure malus trap terms per playlist; a viewer who types a trap word loses points multiplicatively on that round | `malus_terms` text array column on `playlists` table + fuzzy detection in plugin |
| GAME-04 | Viewer can submit title + artist in one message (double-shot): both correct = bonus points; only one correct = zero points for both | Extend `onChatMessage` double-match branch with new formula; needs `ScoringEvent.reason = 'double_shot'` |
| GAME-05 | Featuring guesses are scored instantly (no 3-second window) — each featuring is guessable independently | Featurings stored per track (`featurings` text array column on `tracks`); plugin tracks found featurings in `TrackState` |
| GAME-06 | Scoring state (per-round scores, streaks, active window) is preserved in memory with atomic DB writes to prevent lost increments on concurrent guesses | PostgreSQL `ON CONFLICT DO UPDATE` upsert; `NUMERIC(10,1)` score column to hold decimals |
| GAME-07 | Streamer can play the playlist in shuffle order (Fisher-Yates, non-repetitive — each track plays once before any repeats) | Shuffle order stored in Redis key per session; bot worker applies on round start |
| GAME-08 | Streamer can configure the scoring window duration per session (default 3s) | `windowDurationMs` in `gameConfigs.config` JSONB; default 3000ms |
</phase_requirements>

---

## Summary

Phase 6 is an extension of the existing `BlindtestPlugin` class and its supporting infrastructure, not a rewrite. The v1 plugin is well-structured with clean separation between the plugin (`packages/game-engine`), types (`packages/game-types`), and the bot worker's orchestration layer (`apps/bot-worker`). All new mechanics (timing window, streak, malus, double-shot, featuring, shuffle) slot into the existing class without needing to change the `GamePlugin` interface contract fundamentally.

The largest engineering risk is the **atomic DB write** requirement for concurrent guesses. The current `upsertScore` in `BotSession` is a read-then-write (SELECT then UPDATE/INSERT), which is not atomic. Replacing it with a PostgreSQL `INSERT ... ON CONFLICT DO UPDATE SET score = score + $delta` eliminates the race condition without requiring application-level locks.

A secondary concern is that `session_scores.score` is currently an `INTEGER` column. Since v2 scores include 1-decimal values (e.g. 2.6 pts for a streak-multiplied late find), this column must change to `NUMERIC(10,1)`. The migration is straightforward but all consumers (overlay SSE leaderboard, dashboard) must be aware the type changes.

**Primary recommendation:** Extend `BlindtestPlugin` in place. Add a `TrackState` v2 shape and a Redis per-round state layer in `BotSession`. Change the upsert to a single atomic SQL statement. Ship migration 0013 with the new columns.

---

## Standard Stack

### Core (already in project — no new installs needed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | ^5.7.3 | Plugin logic, interfaces | Already in workspace |
| Vitest | ^2.1.8 | Unit tests for game-engine | Already configured in `packages/game-engine` |
| Drizzle ORM | (workspace) | Schema definition + typed queries | Already used for all DB operations |
| ioredis | (workspace) | Per-round in-memory state | Already used by bot-worker |
| PostgreSQL NUMERIC | — | Decimal score storage | Native Postgres; Drizzle `numeric()` column type |

### No New Dependencies

The entire phase can be implemented with the existing workspace packages. The only new SQL construct is `INSERT ... ON CONFLICT DO UPDATE` (available in any Postgres version ≥ 9.5) and a `NUMERIC(10,1)` column type change.

---

## Architecture Patterns

### Recommended File Structure Changes

```
packages/
├── game-types/src/
│   └── plugin.interface.ts      # Extend ScoringEvent.reason union; add FeaturingEvent
└── game-engine/src/
    ├── blindtest-plugin.ts      # Main extension target — TrackState v2
    ├── fuzzy-matcher.ts         # tolerance default: 0.30 → 0.15
    ├── normalizer.ts            # No changes
    └── scorer.test.ts           # New test cases for all v2 mechanics

packages/db/src/schema/
├── playlists.ts                 # Add malus_terms text[] column to tracks table
└── sessions.ts                  # Add streak + numeric score to session_scores

packages/db/migrations/
└── 0013_v2_game_engine.sql      # New migration (current latest is 0012)

apps/bot-worker/src/
└── bot-session.ts               # Add round state manager, atomic upsert, shuffle
```

### Pattern 1: TrackState v2

The `TrackState` interface inside `blindtest-plugin.ts` must be extended to hold all per-round state. Because this is module-private, no interface in `game-types` needs changing.

```typescript
interface TrackState {
  // V1 fields
  title: string
  artist: string | null
  titleSolvedBy: string | null
  artistSolvedBy: string | null
  answeredViewers: Set<string>

  // V2 additions
  featurings: string[]                         // list of featuring artists
  foundFeaturings: Set<string>                 // which featurings already found
  windowOpenAt: number | null                  // Date.now() when first correct guess landed, null = pre-first-find
  malusCounters: Map<string, number>           // viewerUsername -> number of malus hits this round
  participatedViewers: Set<string>             // viewers who sent any message this round (for streak tracking)
}
```

**Key rule:** `windowOpenAt` is `null` until the first correct title or artist guess. It is set to `Date.now()` on that first guess. All subsequent title/artist guesses check `Date.now() - windowOpenAt` against the window duration to compute decay.

### Pattern 2: Timing Window Calculation

```typescript
// Source: CONTEXT.md locked formula
function computeDecayPoints(
  elapsed_ms: number,
  window_ms: number
): number {
  if (elapsed_ms >= window_ms) return 0  // outside window — caller should not call this
  const pts = 3 - 2 * (elapsed_ms / window_ms)
  return Math.round(pts * 10) / 10        // 1 decimal place
}
```

First finder: always 3 pts (elapsed_ms = 0 → formula gives 3.0).
Window check occurs in `BotSession` (which owns the wall clock), NOT in the plugin. The plugin receives `windowOpenAt` via `TrackState` which is set the moment the first scoring event fires.

### Pattern 3: Streak Multiplier Application

Streak is tracked **per-session, per-viewer** in Redis, not in the plugin itself. The plugin returns raw base points; `BotSession` applies the streak multiplier before writing to DB.

```typescript
// Pseudo-code in BotSession.handleChatMessage
const baseEvent = await this.plugin.onChatMessage(ctx, message)
if (!baseEvent) return

const streak = await this.getStreak(event.viewerUsername)  // from Redis
const multiplier = 1 + streak * 0.1

let finalPoints: number
if (baseEvent.reason === 'featuring') {
  finalPoints = baseEvent.points  // featurings: no multiplier
} else {
  finalPoints = Math.round(baseEvent.points * multiplier * 10) / 10
}
```

Streak is incremented at **round end** (when `next` command fires), not per-message. A flag `foundThisRound: Set<string>` in `BotSession` tracks which viewers scored on the current round.

### Pattern 4: Atomic DB Upsert

Replace the current read-then-write in `BotSession.upsertScore` with a single SQL statement to eliminate the race condition (GAME-06):

```sql
-- Source: PostgreSQL docs — INSERT ... ON CONFLICT DO UPDATE
INSERT INTO session_scores (
  id, session_id, tenant_id, viewer_username, viewer_display_name,
  game_type, score, correct_answers, streak, updated_at
)
VALUES ($1, $2, $3, $4, $5, $6, $7, 1, $8, now())
ON CONFLICT (session_id, viewer_username)
DO UPDATE SET
  score          = session_scores.score + EXCLUDED.score,
  correct_answers = session_scores.correct_answers + 1,
  streak         = EXCLUDED.streak,
  updated_at     = now();
```

This requires a **unique constraint** on `(session_id, viewer_username)` — currently missing. The migration must add this constraint. It also requires the `streak` column to exist.

**Note:** The `ON CONFLICT` target must be a unique index or constraint column set, not a primary key. Adding `UNIQUE(session_id, viewer_username)` in migration 0013 is required.

### Pattern 5: Redis Per-Round State Key Schema

```
game:round:{sessionId}          — JSON object for current round state
  {
    "windowOpenAt": 1710000000000,   // null until first find
    "windowMs": 3000,
    "malusCounters": { "viewer1": 2 },
    "foundThisRound": ["viewer1", "viewer3"],
    "featuringsFound": { "featuring1": "viewer2" }
  }

game:streak:{sessionId}:{viewerUsername}  — numeric string (streak count)

game:shuffle:{sessionId}                  — JSON array of track indices in play order
```

TTL strategy: `game:round:*` keys expire at session end (explicit DEL in `stop()`). `game:streak:*` keys expire with a 24h TTL (sessions don't typically run more than a few hours; longer sessions should re-read from DB if Redis is cold). `game:shuffle:*` deleted on session end.

### Pattern 6: Fisher-Yates Shuffle

```typescript
// Standard Fisher-Yates — deterministic given a seed, O(n)
function fisherYates(arr: number[]): number[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j]!, a[i]!]
  }
  return a
}
// Generate shuffled track indices at session start, store in Redis
```

### Anti-Patterns to Avoid

- **Don't apply streak in the plugin:** The plugin is stateless regarding session-level data. Streak is session state, managed by `BotSession` + Redis.
- **Don't use `SELECT` then `UPDATE` for score writes:** Race condition when two viewers guess within milliseconds. Use `INSERT ... ON CONFLICT DO UPDATE` exclusively.
- **Don't store `windowOpenAt` in the plugin only:** If `BotSession` crashes and restarts, the in-memory plugin state is lost. The round's `windowOpenAt` must be persisted in Redis immediately after the first correct guess.
- **Don't break existing `ScoringEvent.reason` values:** `correct_title`, `correct_artist`, `correct_answer` are consumed by overlay SSE. Add new values additively (`malus`, `featuring`, `double_shot`).
- **Don't change `ScoringEvent.points` to negative for malus:** Consider `points` as a signed delta — negative for malus. Consumers (overlay, leaderboard) must handle negative `points` in the scoring event.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Concurrent score writes | Application-level mutex or queue | PostgreSQL `ON CONFLICT DO UPDATE` | DB-level atomicity handles concurrent writes correctly; no distributed lock needed |
| Score decimal rounding | Custom float formatter | `Math.round(x * 10) / 10` + `NUMERIC(10,1)` column | JavaScript float precision + DB column precision together are sufficient |
| Shuffle persistence | Session table column | Redis key with serialized index array | Fast reads on every `next` command; no migration complexity for shuffle state |
| Streak persistence between restarts | Write-through to DB on every message | Redis as primary, DB sync on round-end | DB writes on every message would be too chatty; Redis is sufficient for intra-session |

---

## Common Pitfalls

### Pitfall 1: Double-Shot Window Timing

**What goes wrong:** Double-shot checks title AND artist independently, but `windowOpenAt` is set by whichever answer was found first (may be from a different viewer). If a viewer submits both in one message and is the first finder for both, `windowOpenAt` is null (no prior find), so elapsed = 0 → max 12 pts. If another viewer already found the title, `windowOpenAt` is non-null and the double-shot viewer scores decayed points for both.

**Why it happens:** The formula `(title_pts + artist_pts) × 2` requires computing each component's decay independently, using the same `windowOpenAt`.

**How to avoid:** Compute `title_pts` and `artist_pts` separately using current `Date.now() - windowOpenAt`, then multiply the sum by 2. If `windowOpenAt` is null (double-shot viewer IS the first finder), treat both as elapsed=0 → 3+3=6 × 2=12.

**Warning signs:** Test case: viewer1 guesses title at t=1.5s, then viewer2 submits double-shot at t=2.0s → should get (2.0_decay + 2.0_decay) × 2 = 8.0, not 12.0.

### Pitfall 2: Malus Wins Over Correct Answer

**What goes wrong:** A viewer types a message containing both a malus term AND the correct title. The plugin scores both and emits two events.

**Why it happens:** v1 plugin does one pass — matches title first, returns immediately. V2 must check malus before checking correct answers.

**How to avoid:** In `onChatMessage`, **always check malus terms first**. If any malus matches, return a malus `ScoringEvent` immediately (negative points) and do NOT proceed to answer matching. This is an explicit locked rule from CONTEXT.md: "malus wins."

**Warning signs:** Unit test: `msg('Madonna Vogue')` where 'Madonna' is a malus term and 'Vogue' is the correct title → should return malus event only.

### Pitfall 3: Streak Reset Granularity

**What goes wrong:** Streak is checked/reset per-message instead of per-round, causing incorrect resets (e.g. viewer sends a wrong guess before sending the correct one — streak would break even though they found the answer that round).

**Why it happens:** "Streak resets on wrong answer" is listed in CONTEXT.md, but the intent is round-level: if the viewer's final outcome for the round is "found at least one answer," streak should increment. A wrong guess followed by a correct guess within the same round should still count as a found round.

**Resolution based on CONTEXT.md:**
- CONTEXT.md says streak resets on "wrong answer submitted" — this means a wrong answer immediately breaks the streak for that round, regardless of whether the viewer later finds the correct answer (since the viewer can only score once per round anyway in the current model).
- Actually, re-reading: since v1 already prevents a viewer from scoring twice per round (`answeredViewers` set), the viewer who submits a wrong answer and then the correct answer: the wrong answer first → no-op (not in answeredViewers yet) → wait, wrong answers don't add to answeredViewers in v1.
- **IMPORTANT:** In v2, a "wrong answer" does NOT lock the viewer out. Only a correct answer (scoring event) locks them. So the sequence is: wrong guess (streak reset trigger?) → correct guess → scores.
- The safest interpretation aligned with CONTEXT.md intent: streak resets when the viewer ends the round with no score (missed round). Wrong answer alone — before any score — should be tracked but not immediately reset streak if the viewer can still score correctly. However CONTEXT.md explicitly says "Wrong answer submitted" resets streak.
- **Decision needed at implementation time:** Does wrong-then-correct in the same round break streak? The safest implementation: mark streak as "broken this round" on any wrong answer, regardless of subsequent correct. This matches the rule literally and is consistent with malus behavior.

**Warning signs:** Write explicit tests for: wrong-then-correct same round, correct-only round, malus-then-nothing round.

### Pitfall 4: Score Column Type Migration

**What goes wrong:** Changing `session_scores.score` from `INTEGER` to `NUMERIC(10,1)` requires an ALTER COLUMN that can fail if existing data is not compatible (it won't fail — integer → numeric is lossless), but the Drizzle schema must also be updated, and all TypeScript code that assumes `score` is a `number` (int) must handle that `NUMERIC` from Postgres returns as a `string` by default in `node-postgres`.

**Why it happens:** `pg` driver returns `NUMERIC`/`DECIMAL` columns as strings, not JavaScript numbers. This is a well-known pg-node quirk.

**How to avoid:** In Drizzle schema, use `numeric('score', { precision: 10, scale: 1 })` which returns values as strings. Cast to `parseFloat()` at the boundary where scores are used for arithmetic or SSE output. Or use `$type<number>()` modifier in Drizzle — but verify Drizzle actually does the coercion automatically (it may not).

**Warning signs:** Leaderboard SSE sends `score: "12.5"` (string) instead of `score: 12.5` (number) — overlay rendering breaks.

### Pitfall 5: Migration Number is 0013, Not 0012

**What goes wrong:** CONTEXT.md says "current migration state (0011); next migration is 0012." However, the actual migration journal shows 0012 already exists (`0012_no_force_rls.sql`). The next migration number is **0013**.

**Why it happens:** Migration 0012 was added after CONTEXT.md was written.

**How to avoid:** Always check `packages/db/migrations/meta/_journal.json` for the last entry before writing a new migration file. As of research date: last entry is `idx: 12`, tag `0012_no_force_rls`. Next must be `0013_*.sql` with `idx: 13`.

### Pitfall 6: Featurings Column Is Missing from Tracks Table

**What goes wrong:** Phase 6 introduces per-featuring scoring (GAME-05), but the `tracks` table currently has no `featurings` column. The plugin cannot score featurings without this data.

**Why it happens:** The featurings concept is new in v2. Phase 7 (Spotify Import Cleanup) adds SPOT-02 which extracts `(feat. X)` from titles, but Phase 6 needs the column to exist first so the plugin can use it.

**How to avoid:** Migration 0013 must add `featurings TEXT[]` to the `tracks` table (nullable, defaults to empty array). Phase 7 will populate it via Spotify import. For Phase 6, featurings can be empty for existing tracks — the plugin skips featuring scoring if the array is empty.

### Pitfall 7: Malus Terms Live on Playlists, Not Tracks

**What goes wrong:** Malus terms are "configured per playlist" per CONTEXT.md, meaning one array for the whole playlist, not per track. A separate `malus_terms TEXT[]` column must be added to the `playlists` table, not the `tracks` table.

**Why it happens:** Easy to confuse with featurings (which ARE per-track).

**How to avoid:** Migration 0013 adds `malus_terms TEXT[]` to `playlists` (nullable, defaults to empty array). `BotSession` loads malus terms when the session starts, reads from `sessions.playlistId → playlists.malus_terms`, and passes them to the plugin context or stores them in the round state.

---

## Code Examples

### Extending ScoringEvent (game-types/src/plugin.interface.ts)

```typescript
// Source: Existing interface + CONTEXT.md requirements
export interface ScoringEvent {
  sessionId: string
  viewerUsername: string
  viewerDisplayName: string
  points: number        // can be negative for malus
  reason:
    | 'correct_title'
    | 'correct_artist'
    | 'correct_answer'   // keep for backward compat (v1 double-shot — no longer used)
    | 'partial'          // keep for backward compat
    | 'malus'            // NEW: viewer hit a trap term
    | 'featuring'        // NEW: viewer guessed a featuring
    | 'double_shot'      // NEW: title + artist in one message, both correct
  timestamp: Date
  // V2 metadata (optional for backward compat)
  streakMultiplier?: number   // the multiplier applied to this event's base points
  elapsed_ms?: number         // time since windowOpenAt (for window events)
}
```

### Drizzle Schema Change — sessionScores

```typescript
// packages/db/src/schema/sessions.ts
import { numeric } from 'drizzle-orm/pg-core'

export const sessionScores = pgTable('session_scores', {
  // ...existing fields...
  score: numeric('score', { precision: 10, scale: 1 }).notNull().default('0'),  // changed from integer
  streak: integer('streak').notNull().default(0),  // NEW: current streak count at last update
  correctAnswers: integer('correct_answers').notNull().default(0),
  // ...
})
```

### Migration 0013 Outline

```sql
-- 0013_v2_game_engine.sql

-- 1. Add featurings to tracks
ALTER TABLE "tracks" ADD COLUMN "featurings" TEXT[] DEFAULT '{}';

-- 2. Add malus_terms to playlists
ALTER TABLE "playlists" ADD COLUMN "malus_terms" TEXT[] DEFAULT '{}';

-- 3. Change score from INTEGER to NUMERIC(10,1) — safe, no data loss
ALTER TABLE "session_scores" ALTER COLUMN "score" TYPE NUMERIC(10,1)
  USING score::NUMERIC(10,1);

-- 4. Add streak column to session_scores
ALTER TABLE "session_scores" ADD COLUMN "streak" INTEGER NOT NULL DEFAULT 0;

-- 5. Add unique constraint for ON CONFLICT upsert
ALTER TABLE "session_scores"
  ADD CONSTRAINT session_scores_session_viewer_unique
  UNIQUE (session_id, viewer_username);

-- 6. Add shuffle_order to sessions (JSON array of track indices)
ALTER TABLE "sessions" ADD COLUMN "shuffle_order" JSONB;
```

### Atomic Upsert in Drizzle

```typescript
// Source: Drizzle ORM docs — insert with onConflictDoUpdate
import { sql } from 'drizzle-orm'

await db.insert(sessionScores)
  .values({
    id: crypto.randomUUID(),
    sessionId,
    tenantId,
    viewerUsername: event.viewerUsername,
    viewerDisplayName: event.viewerDisplayName,
    gameType: 'blindtest',
    score: String(finalPoints),  // NUMERIC expects string in Drizzle
    streak: newStreakCount,
    correctAnswers: 1,
  })
  .onConflictDoUpdate({
    target: [sessionScores.sessionId, sessionScores.viewerUsername],
    set: {
      score: sql`${sessionScores.score} + ${String(finalPoints)}`,
      correctAnswers: sql`${sessionScores.correctAnswers} + 1`,
      streak: newStreakCount,
      updatedAt: new Date(),
    },
  })
```

Note: `withTenantContext` wraps this call so RLS tenant isolation applies.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Fixed 3 pts title / 2 pts artist | Equal 3 pts each, with timing decay | Phase 6 | Artist guesses now strategically equal to title; double-shot value changes |
| Viewer can only score once per track | Still true — but now the "score" can be negative (malus) | Phase 6 | `answeredViewers` set logic must be revisited for malus (malus should NOT lock the viewer from scoring correctly on that round — or should it? Malus wins per CONTEXT.md, meaning the round result IS the malus, so viewer is effectively done) |
| `score INTEGER` in DB | `score NUMERIC(10,1)` | Phase 6 | All consumers of sessionScores must handle string-or-float from Drizzle |
| No shuffle | Fisher-Yates shuffle stored in Redis/session | Phase 6 | `handleNext` in BotSession uses shuffled index, not linear `currentTrackIndex + 1` |
| Double-shot = 5 pts flat | Double-shot = (title_pts + artist_pts) × 2 | Phase 6 | Max 12 pts at t=0; at t=window/2 = 8 pts |

**Deprecated/outdated:**
- v1 test assertion `expect(event!.points).toBe(2)` for artist first-finder: v2 artist is 3 pts — test must be updated.
- v1 test assertion `expect(event!.points).toBe(5)` for double-shot: v2 max is 12 pts — test must be updated.
- `ScoringEvent.reason === 'correct_answer'`: v1 used this for double-shot; v2 uses `'double_shot'` — `'correct_answer'` retained for backward compat but new code should use `'double_shot'`.

---

## Open Questions

1. **Does a wrong-then-correct sequence in the same round break the streak?**
   - What we know: CONTEXT.md says "Wrong answer submitted" resets streak. Viewers can send multiple messages before finding the answer (v1 doesn't lock them out on wrong answers).
   - What's unclear: If a viewer sends "wrong guess" (streak resets) then "correct guess" (scores this round), does their streak stay at 0 going into next round, or does finding the answer this round repair it?
   - Recommendation: Implement as "wrong answer immediately and permanently breaks streak for the current round, even if the viewer later scores." This is the simplest and most consistent with the stated rule. Document this in test comments.

2. **Does a malus event lock the viewer from further guesses this round?**
   - What we know: CONTEXT.md says "malus wins" when a message contains both malus AND correct answer. The malus penalty fires and the correct answer is ignored.
   - What's unclear: If a viewer hits a malus trap with one message, can they guess correctly with a later message?
   - Recommendation: Yes, malus locks the viewer out for that round (add to `answeredViewers` on malus hit). This is consistent with "malus wins" and prevents a viewer from burning a malus then immediately scoring. Confirm this at implementation time.

3. **Shuffle order storage: Redis vs. sessions table column**
   - What we know: CONTEXT.md says "Shuffle result stored in session state (Redis or session record) so order survives reconnects."
   - What's unclear: Redis has TTL risk (lost on crash + expiry), but migration 0013 can add a `shuffle_order JSONB` column to `sessions` if persistence through crashes is required.
   - Recommendation: Store shuffle order in both: write to `sessions.shuffle_order` DB column (added in migration 0013) and cache in Redis key `game:shuffle:{sessionId}`. On BotSession start, load from DB if Redis key is missing.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest ^2.1.8 |
| Config file | `packages/game-engine/vitest.config.ts` |
| Quick run command | `cd packages/game-engine && npx vitest run` |
| Full suite command | `npx turbo test --filter=@playground/game-engine` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| GAME-01 | Timing window: first finder = 3 pts, in-window decay, post-window = ignored | unit | `npx vitest run packages/game-engine` | ❌ Wave 0 |
| GAME-02 | Streak increments per found round, resets on miss/malus/wrong | unit | `npx vitest run packages/game-engine` | ❌ Wave 0 |
| GAME-03 | Malus trap detection via fuzzy match, escalating penalty per round | unit | `npx vitest run packages/game-engine` | ❌ Wave 0 |
| GAME-04 | Double-shot: both correct = (pts + pts)×2; one correct = 0 for both | unit | `npx vitest run packages/game-engine` | ❌ Wave 0 |
| GAME-05 | Featuring: instant score, independent per featuring, 1 pt fixed | unit | `npx vitest run packages/game-engine` | ❌ Wave 0 |
| GAME-06 | Concurrent guesses: upsert is atomic, no lost increments | integration (manual) | Manual test with parallel messages | manual-only — requires live DB |
| GAME-07 | Fisher-Yates shuffle: each track appears once before repeat | unit | `npx vitest run packages/game-engine` | ❌ Wave 0 |
| GAME-08 | Window duration configurable from gameConfigs JSONB | unit | `npx vitest run packages/game-engine` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `cd packages/game-engine && npx vitest run`
- **Per wave merge:** `npx turbo test --filter=@playground/game-engine`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `packages/game-engine/src/scorer.test.ts` — must be updated/extended to cover all v2 mechanics (GAME-01 through GAME-05, GAME-07, GAME-08). Existing file covers v1 behavior only.
- [ ] New test sections needed in `scorer.test.ts`:
  - `describe('timing window', ...)` — GAME-01
  - `describe('streak multiplier', ...)` — GAME-02
  - `describe('malus trap terms', ...)` — GAME-03
  - `describe('double-shot', ...)` — GAME-04
  - `describe('featurings', ...)` — GAME-05
  - `describe('shuffle', ...)` — GAME-07

Note: GAME-06 (atomic writes) cannot be tested in unit tests — verified manually by inspecting the SQL generated by Drizzle's `onConflictDoUpdate` and confirming the unique constraint exists in the migration.

---

## Sources

### Primary (HIGH confidence)
- Direct codebase read: `packages/game-engine/src/blindtest-plugin.ts` — full v1 implementation
- Direct codebase read: `packages/game-engine/src/fuzzy-matcher.ts` — Levenshtein with tolerance param
- Direct codebase read: `packages/game-types/src/plugin.interface.ts` — existing interfaces
- Direct codebase read: `packages/db/src/schema/sessions.ts` — existing tables and columns
- Direct codebase read: `packages/db/src/schema/playlists.ts` — tracks table schema (no featurings)
- Direct codebase read: `packages/db/migrations/meta/_journal.json` — confirms 0012 is latest
- Direct codebase read: `apps/bot-worker/src/bot-session.ts` — full orchestration logic
- Direct codebase read: `.planning/phases/06-game-engine-foundation/06-CONTEXT.md` — locked decisions

### Secondary (MEDIUM confidence)
- PostgreSQL documentation: `INSERT ... ON CONFLICT DO UPDATE` — standard SQL, available in all supported Postgres versions
- `pg` node driver known behavior: NUMERIC/DECIMAL columns returned as strings — widely documented community knowledge

### Tertiary (LOW confidence)
- Drizzle ORM `numeric()` type behavior with `onConflictDoUpdate`: the `sql\`column + $\{value\}\`` pattern for numeric increment is a community-verified pattern; official Drizzle docs confirm `onConflictDoUpdate` API exists but exact numeric string handling should be verified at implementation time.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already in workspace, no new installs
- Architecture: HIGH — full codebase read, all integration points traced
- Pitfalls: HIGH — derived from actual code inspection (upsert race condition, type mismatch, migration number)
- Open questions: MEDIUM — two behavioral edge cases require implementation-time confirmation

**Research date:** 2026-03-17
**Valid until:** 2026-04-17 (stable TypeScript/Drizzle/Vitest stack — 30-day validity)
