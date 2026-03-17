# Phase 6: Game Engine Foundation - Context

**Gathered:** 2026-03-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver the complete v2 gameplay engine in `packages/game-engine` and `packages/game-types`, with the DB schema changes and atomic writes it requires. Covers: timing window, streak multiplier, malus trap terms, double-shot rework, featuring guesses, shuffle order, and configurable window duration. All downstream phases (bot, overlay, dashboard) depend on this phase.

</domain>

<decisions>
## Implementation Decisions

### Fuzzy matching (existing code change)
- Keep Levenshtein algorithm (already in `packages/game-engine/src/fuzzy-matcher.ts`)
- **Lower tolerance from 0.30 → 0.15** (15% error ratio) — stricter matching
- Short target rule unchanged: targets < 3 chars require exact/substring match

### Point values
- **Title — first finder:** 3 pts
- **Artist — first finder:** 3 pts (changed from v1's 2 pts — title and artist now equal)
- **In-window (title or artist):** linear decay from 3 pts at t=0 to 1 pt at t=window_duration
  - Formula: `pts = 3 - 2 * (elapsed_ms / window_ms)` rounded to 1 decimal
  - Example (3s window): found at 1.5s → 2.0 pts
- **After window closes:** viewer is ignored silently — no scoring event emitted
- **Featuring:** 1 pt per featuring, instant (no timing window), each featuring guessable independently
- **Double-shot (title + artist in one message, both correct):** (title_pts + artist_pts) × 2
  - At t=0 (both first): (3 + 3) × 2 = 12 pts
  - At t=1.5s: (2.0 + 2.0) × 2 = 8.0 pts
  - If only one of the two is correct: 0 pts for both (high-risk, all-or-nothing)

### Streak multiplier
- **Increment:** +0.1× per consecutive round where viewer found at least one answer (title, artist, or featuring counts)
  - Streak 1 = ×1.1, Streak 2 = ×1.2, Streak 5 = ×1.5, etc.
- **No cap** — streak can grow indefinitely
- **Applied to:** title and artist points only — featuring points (1 pt fixed) are NOT multiplied
- **Points stored:** 1 decimal place (e.g. 2.6, not 3)
- **Streak resets on any of:**
  - Round missed (viewer found nothing that round)
  - Viewer absent (no message in chat that round)
  - Malus triggered (even if streak was active)
  - Double-shot failure (only one of the two correct)
  - Wrong answer submitted

### Malus trap terms
- **Detection:** fuzzy match — same Levenshtein algorithm and 0.15 tolerance as answer matching
- **Penalty structure (per round, resets each new round):**
  - 1st malus trigger: −1 pt
  - 2nd malus trigger: −2 pts
  - 3rd malus trigger: −3 pts
  - Nth trigger: −N pts
  - Counter resets at start of each new round
- **Message contains both malus AND correct answer:** malus wins — viewer receives only the penalty, correct answer is not scored
- **Streak:** malus breaks streak (already in PROJECT.md)
- **Configuration:** malus terms stored per playlist (not per session); streamer configures them in the playlist settings

### Configurable scoring window
- Default: 3 seconds
- Configurable per session (GAME-08) — stored in `gameConfigs` JSONB
- Bot worker reads config at round start; window timer runs in bot worker process

### Shuffle order
- Fisher-Yates shuffle applied when session starts (GAME-07)
- Non-repetitive: each track plays once before any repeats
- Shuffle result stored in session state (Redis or session record) so order survives reconnects

### Claude's Discretion
- Redis game state key schema (per-round data: window open timestamp, malus counters per viewer, streak counters, featurings state) — implementation detail
- DB sync strategy (when Redis state flushes to DB, crash recovery) — implementation detail
- `gameConfigs` JSONB shape for malus terms and window duration
- Migration numbering and column types for new DB fields

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Game engine
- `packages/game-engine/src/blindtest-plugin.ts` — Existing v1 plugin to extend (not replace)
- `packages/game-engine/src/fuzzy-matcher.ts` — Levenshtein implementation; change tolerance 0.30 → 0.15
- `packages/game-types/src/plugin.interface.ts` — `GamePlugin`, `ScoringEvent`, `ChatMessage` interfaces; will need new reason types

### DB schema
- `packages/db/src/schema/sessions.ts` — `sessionScores`, `gameConfigs`, `sessions` tables; new columns needed for streak, decimals, featurings
- `packages/db/migrations/` — Current migration state (0011); next migration is 0012

### Requirements (all Phase 6)
- `.planning/REQUIREMENTS.md` — GAME-01 through GAME-08 (full acceptance criteria)
- `.planning/ROADMAP.md` — Phase 6 success criteria

### Project decisions
- `.planning/PROJECT.md` — Key Decisions table (fuzzy threshold, double-shot design, streak break rules)
- `.planning/STATE.md` — Architecture notes (Redis channels, RLS pattern for migrations)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `BlindtestPlugin` class: structure is good, needs extension not rewrite — add fields to `TrackState`, new methods
- `fuzzyMatch(input, target, tolerance)`: tolerance param already exists — just change default from 0.30 to 0.15
- `normalize()`: no changes needed
- `gameConfigs` table: JSONB `config` field already exists — use for malus terms + window duration per session
- `sessionScores` table: exists but needs new columns (`streak`, score as numeric/decimal)

### Established Patterns
- `ScoringEvent` interface: extend `reason` union type with `'malus' | 'featuring' | 'double_shot'`
- `TrackState` interface (internal to plugin): add `windowOpenAt`, `malusCounters: Map<viewerUsername, number>`, `featurings: string[]`, `foundFeaturings: Set<string>`
- DB migrations: SQL manual files in `packages/db/migrations/`, journal in `meta/_journal.json` — follow 0011 permissive INSERT policy pattern for any new tables with RLS
- RLS pattern: all new tables must use `pgPolicy` with permissive INSERT (Render non-superuser workaround)

### Integration Points
- Bot worker (`apps/bot-worker/src/bot-session.ts`) calls plugin methods — `ScoringEvent` shape changes must be backward-compatible or bot-session updated in same phase
- `session_scores` DB table is read by overlay SSE and dashboard — score type change (integer → numeric) must be reflected in all consumers
- `gameConfigs` is read at session start to get malus terms + window duration

</code_context>

<specifics>
## Specific Ideas

- Malus is intentionally escalating (-1, -2, -3...) to punish viewers who keep repeating the mistake after being warned by the bot — "they're not following the rules"
- Artist and title now have equal value (both 3 pts) — changes the strategic balance vs v1
- No cap on streak was a deliberate choice — reward the best players without artificial ceiling
- Double-shot is max-risk, max-reward: (pts + pts) × 2 but 0 if only one correct

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 06-game-engine-foundation*
*Context gathered: 2026-03-17*
