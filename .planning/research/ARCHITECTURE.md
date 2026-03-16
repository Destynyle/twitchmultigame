# Architecture Research

**Domain:** Twitch Blindtest SaaS — Gameplay v2 Integration
**Researched:** 2026-03-17
**Confidence:** HIGH (based on direct codebase analysis)

---

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        apps/web (Next.js 15)                         │
│                                                                       │
│  ┌──────────────────┐  ┌──────────────────┐  ┌───────────────────┐  │
│  │  Dashboard UI    │  │  Server Actions  │  │  SSE Endpoint     │  │
│  │  SessionControl  │  │  sessions/       │  │  /api/overlay/    │  │
│  │  LiveEditPanel   │  │  scores/         │  │  [token]/route.ts │  │
│  │  ScoreExport     │  │  tracks/         │  │  (nodejs runtime) │  │
│  └────────┬─────────┘  └────────┬─────────┘  └────────┬──────────┘  │
│           │                     │                      │             │
├───────────┼─────────────────────┼──────────────────────┼─────────────┤
│           │     Redis pub/sub   │                      │             │
│  ┌────────▼─────────────────────▼──────────────┐       │             │
│  │            Redis                              │       │             │
│  │  session:cmd:{sessionId}  (web → bot)        │       │             │
│  │  sessions:events          (web → bot)        │◄──────┘             │
│  │  overlay:{tenantId}       (bot → SSE)        │                     │
│  │  bot:status:{sessionId}   (bot → admin)      │                     │
│  └───────────────────────────────────┬──────────┘                     │
└──────────────────────────────────────┼─────────────────────────────── ┘
                                       │
┌──────────────────────────────────────┼────────────────────────────────┐
│              apps/bot-worker (Node.js CJS)                            │
│                                       │                               │
│  ┌─────────────────────┐  ┌──────────▼──────────────────────────┐    │
│  │  SessionRunner      │  │  BotSession                          │    │
│  │  (sessions:events)  │  │  - handleChatMessage()               │    │
│  │                     │  │  - handleCommand()                   │    │
│  │  activeSessions Map │  │  - publishState/publishScoring       │    │
│  └─────────────────────┘  │  - upsertScore() → DB               │    │
│                            │  - getLeaderboard() ← DB           │    │
│                            └──────────────┬──────────────────────┘    │
│                                           │                           │
│  ┌──────────────────────────────┐         │                           │
│  │  BlindtestPlugin (v2 target) │◄────────┘                          │
│  │  packages/game-engine        │                                     │
│  │  - onChatMessage()           │                                     │
│  │  - scoring window (3s)       │                                     │
│  │  - streak/malus/double-shot  │                                     │
│  │  - in-memory round state     │                                     │
│  └──────────────────────────────┘                                     │
│                                                                       │
│  ┌──────────────────────────────┐                                     │
│  │  TwitchChatConnection        │                                     │
│  │  IChatConnection.sendMessage │  ← NEW: bot auto-messages           │
│  └──────────────────────────────┘                                     │
└───────────────────────────────────────────────────────────────────────┘
                    │
┌───────────────────┼───────────────────────────────────────────────────┐
│  PostgreSQL + Redis (shared infra)                                    │
│  sessions, session_scores, game_configs, tracks (existing)            │
│  + streak column in session_scores (new)                              │
└───────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities (v2 additions mapped to existing)

| Component | Responsibility | New vs Existing |
|-----------|----------------|-----------------|
| `BlindtestPlugin` | Core gameplay logic: fuzzy match, scoring window, streak/malus/double-shot | Rewrite existing |
| `BotSession` | Orchestrates session: routes commands, publishes overlay events, sends chat messages | Extend existing |
| `TwitchChatConnection` | Sends bot auto-messages via `sendMessage()` | Interface already has it; BotSession must call it |
| `SessionRunner` | Launches BotSession with correct plugin and config | Minor extension only |
| `/api/overlay/[token]/route.ts` | SSE fanout for all overlay zones | Unchanged — event typing changes only |
| `SessionControlPanel` | Streamer dashboard controls: next/pause/resume/end | Add live edit panel, manual score adjust, export |
| `game-types` | Shared interfaces/DTOs between web and bot-worker | Extend ScoringEvent, add BotCommand types |

---

## Question-by-Question Integration Analysis

### Q1: Where does game state (scores, streaks, malus) live?

**Answer: Three tiers, one responsibility each.**

**In-memory in BlindtestPlugin (bot-worker process):**
- Current round state: who found title, who found artist, scoring window timer, viewers who already answered this round
- Current streak counter per viewer (map: `viewerUsername → streakCount`)
- Malus trap terms for the current track (passed in via `setCurrentTrack`)
- The scoring window `setTimeout` handle

Rationale: Round state is ephemeral and sub-second. Any DB or Redis hop would add 5-50ms latency during the scoring window. The bot-worker is a single process managing one session per `BotSession` instance — no concurrency concern.

**In Redis (short-lived, TTL-based):**
- `bot:status:{sessionId}` — already exists, unchanged
- Do NOT add streak or score state to Redis. Redis should not be the source of truth for game state because it adds unnecessary complexity with no benefit for a single-process bot.

**In PostgreSQL (persistent, source of truth):**
- `session_scores` — cumulative score and correctAnswers per viewer per session (already exists)
- Add `streak` column (integer, nullable) to `session_scores` to record the streak at the moment of last correct answer (for leaderboard display and export)
- Add `malus_terms` column (text array or jsonb) to `tracks` table to store per-track trap terms configured by the streamer

The streak counter in-memory is the live value. The DB streak column is the "last known streak" snapshot written on each scoring event — used for display on the dashboard and export, not for real-time gameplay decisions.

**New DB migration needed:**
```sql
-- Add streak tracking to session_scores
ALTER TABLE session_scores ADD COLUMN streak integer NOT NULL DEFAULT 0;

-- Add malus_terms to tracks
ALTER TABLE tracks ADD COLUMN malus_terms text[] NOT NULL DEFAULT '{}';
```

### Q2: How should the 3-zone overlay be structured?

**Answer: New event types on the existing single SSE channel. Separate URL paths for OBS source flexibility.**

**Do NOT create separate SSE endpoints for each zone.** The overlay token identifies the tenant, not a zone. Creating three SSE connections per OBS scene (one per zone) would triple Redis subscriber connections per running session. The existing architecture — one SSE stream per overlay token, all events on `overlay:{tenantId}` — should be preserved.

**Instead: Use a `zone` field in event payloads + three URL sub-paths that all connect to the same SSE stream but render different components.**

OBS browser sources point to:
- `/overlay/[token]/player` — iPod-style player zone (track info, current status)
- `/overlay/[token]/feed` — round feed zone (last 5 found events, malus, streak popups)
- `/overlay/[token]/leaderboard` — leaderboard zone (top 10 scores)

All three sub-paths receive the same SSE stream from `/api/overlay/[token]`. Each zone client filters and renders only the events relevant to it. This is purely client-side rendering logic.

**New event types to add:**

```typescript
// Existing types stay; add these new ones:

// Emitted when a viewer finds title/artist (feeds the round feed zone)
{ type: 'find', viewerUsername, viewerDisplayName, foundTitle: boolean, foundArtist: boolean,
  points: number, streak: number, isDoubleShot: boolean, timestamp }

// Emitted when a viewer triggers a malus (feeds the round feed zone)
{ type: 'malus', viewerUsername, viewerDisplayName, points: number, term: string, timestamp }

// Emitted on next track (resets player zone, clears feed)
{ type: 'track_change', trackIndex: number, status: 'active' | 'paused',
  trackTitle: string | null, trackArtist: string | null }

// Existing 'state' event: extend to include streak fields in leaderboard entries
{ type: 'state', status, trackTitle, trackArtist,
  leaderboard: Array<{ username, displayName, score, streak, rank }> }

// Existing 'scoring' event: extend with streak/double-shot info
{ type: 'scoring', ..., streak: number, isDoubleShot: boolean, isMalus: boolean }
```

The `track_change` event replaces the implicit "state" event sent on `next` — it carries the same data but has a distinct type so the player zone can trigger its animation independently from the leaderboard refresh.

**Sub-path routing in Next.js:**
The existing `/api/overlay/[token]/route.ts` becomes the SSE handler. New pages at `/overlay/[token]/player`, `/overlay/[token]/feed`, `/overlay/[token]/leaderboard` are simple client-rendered pages that each open an EventSource to `/api/overlay/[token]` and subscribe to relevant events. These pages are public (no auth) like the current overlay.

### Q3: How should bot auto-messages and commands be implemented in bot-session.ts?

**Answer: Two distinct mechanisms, both wired in BotSession.**

**Auto-messages (bot reacts to game events):**

`IChatConnection.sendMessage()` already exists and is implemented in `TwitchChatConnection`. The current `BotSession` never calls it — it only receives messages. The change is: after processing a scoring event, `BotSession` calls `this.connection.sendMessage(twitchLogin, message)`.

The message text is generated by a new `BotMessageFormatter` class (in `packages/game-engine` or `bot-worker/src/`) that takes a scoring event and returns a localised string. Keep this separate from `BlindtestPlugin` — the plugin handles game logic, the formatter handles presentation.

Trigger points in `BotSession.handleChatMessage()`:
1. After a `find` event: announce who found what + points + streak if > 1
2. After a `malus` event: announce who hit a trap + penalty
3. After `handleNext()`: reveal the answer (title + artist) to chat
4. After `handleEnd()`: announce final top-3

**Chat commands (!score, !streak, !rank, !rules):**

In `handleChatMessage()`, before passing the message to `plugin.onChatMessage()`, check if the text starts with `!`. If so, route to a new `handleChatCommand()` method that:
1. Parses the command prefix
2. Queries the in-memory state (streak) or DB (score, rank)
3. Calls `this.connection.sendMessage()` with the response

Commands respond with a single chat message. They do not emit overlay events. Command handling is fast (in-memory streak lookup, single DB query for rank).

```
handleChatMessage():
  if text.startsWith('!') → handleChatCommand(username, displayName, text)
  else → plugin.onChatMessage() → upsertScore() → publishOverlay() → sendBotMessage()
```

This ordering ensures commands don't trigger scoring and don't interfere with the scoring window.

**twitchLogin availability in BotSession:** It's passed in `BotSessionParams` but currently only stored locally in `startSession()`. It needs to be stored as `this.twitchLogin` (add to class fields) so `sendMessage(this.twitchLogin, ...)` can be called from any method.

### Q4: How does live dashboard editing propagate to the running game?

**Answer: New command action types on the existing `session:cmd:{sessionId}` Redis channel.**

The existing command flow is:
```
Dashboard → Server Action → Redis PUBLISH session:cmd:{sessionId} → BotSession.handleCommand()
```

This same flow handles live edits with no architectural change — just new action types:

```typescript
// New command actions to add to handleCommand() switch:
case 'edit_track':
  // payload: { title, artist, featurings, malusTerms }
  // Updates in-memory plugin state immediately (no DB write needed for live round)
  // Bot publishes track_change event to overlay so OBS zones update
  // Optionally writes to DB if streamer wants changes to persist

case 'adjust_score':
  // payload: { viewerUsername, delta } where delta is +1 or -1
  // Writes directly to session_scores in DB (upsert pattern)
  // Re-fetches leaderboard and publishes state event

case 'set_malus_terms':
  // payload: { terms: string[] }
  // Updates plugin's current track malus terms in memory
  // No overlay event needed unless streamer wants to display them
```

**For live track editing**, the plugin needs a new method alongside `setCurrentTrack`:
```typescript
updateCurrentTrack(patch: { title?: string; artist?: string; malusTerms?: string[] }): void
```

This updates the in-memory `trackState` without resetting the `answeredViewers` set or the scoring window — the round continues, just with corrected metadata.

**For score adjustments from the dashboard**, the server action writes to DB directly (bypasses bot-worker). The bot-worker does not need to be involved since score adjustments are explicit human actions, not game events. After writing, the web server publishes a `state` event on `overlay:{tenantId}` directly (using `getRedisPublisher()`) so the overlay leaderboard updates immediately without waiting for the next natural state update from the bot.

This means the web server can publish to `overlay:{tenantId}` — it already has access to `getRedisPublisher()`. This is a valid pattern for low-frequency dashboard events.

### Q5: Where should score export/import logic live?

**Answer: Server actions in apps/web. Pure data transformation, no bot-worker involvement.**

Export and import are streamer-facing, not gameplay-facing. They operate on `session_scores` after the fact, which is a DB concern owned by the web layer.

**Export:**
- `exportSessionScoresAction(sessionId, format: 'json' | 'csv')` — server action
- Queries `session_scores` for the session (tenant-scoped via `withTenantContext`)
- Transforms to requested format in-memory
- Returns the data as a base64 string or directly streams via a Route Handler
- Image export (scoreboard screenshot) is client-side only: use `html2canvas` or `dom-to-image` on a pre-rendered score table component. No server involvement.

**Import:**
- `importSessionScoresAction(sessionId, scores: ScoreRow[])` — server action
- Validates the import payload (schema check)
- Upserts into `session_scores` (same upsert pattern as bot-worker)
- Publishes a `state` event to `overlay:{tenantId}` so the overlay reflects imported scores

Both actions live in `apps/web/server/actions/sessions/scores.ts` (new file). They follow existing conventions: `'use server'`, return `{ success: true } | { error: string }`, tenant-scoped DB queries.

**No import/export logic in bot-worker.** The bot-worker writes scores during live gameplay; the web layer owns score management before and after sessions.

---

## Recommended Project Structure (v2 additions only)

```
packages/game-engine/src/
├── blindtest-plugin.ts       # REWRITE: add streak/malus/window/double-shot
├── blindtest-plugin-v2.ts    # (optional staging file, then rename)
├── bot-message-formatter.ts  # NEW: generate chat message strings for events
├── fuzzy-matcher.ts          # UNCHANGED
├── normalizer.ts             # UNCHANGED
├── quiz-plugin.ts            # UNCHANGED
└── index.ts                  # Export new formatter

packages/game-types/src/
├── plugin.interface.ts       # EXTEND: ScoringEvent + new event types
├── overlay-events.ts         # NEW: typed overlay event payloads
├── bot-commands.ts           # NEW: chat command types
└── index.ts                  # Re-export all

apps/bot-worker/src/
├── bot-session.ts            # EXTEND: sendMessage calls, command routing, twitchLogin field
├── session-runner.ts         # MINOR: pass config to BotSession
└── connections/
    ├── IChatConnection.ts    # UNCHANGED
    └── TwitchChatConnection.ts  # UNCHANGED

apps/web/server/actions/
├── sessions/
│   ├── scores.ts             # NEW: exportScores, importScores, adjustScore
│   └── tracks.ts             # NEW: liveEditTrack (publishes edit_track command)
└── admin/
    └── (existing files)

apps/web/src/app/
├── (dashboard)/sessions/components/
│   ├── SessionControlPanel.tsx   # EXTEND: live edit panel, score adjust UI
│   ├── ScoreExportPanel.tsx      # NEW: export/import UI
│   └── LiveEditTrackForm.tsx     # NEW: title/artist/malus inline editor
├── overlay/[token]/
│   ├── page.tsx              # KEEP or redirect to /player
│   ├── player/page.tsx       # NEW: iPod zone client page
│   ├── feed/page.tsx         # NEW: round feed zone client page
│   └── leaderboard/page.tsx  # NEW: leaderboard zone client page
└── api/overlay/[token]/
    └── route.ts              # UNCHANGED (event types added in game-types)
```

---

## Architectural Patterns

### Pattern 1: In-Process Game State with DB Flush

**What:** Keep all sub-second game state (scoring window, current answerers, streaks) in-memory inside `BlindtestPlugin`. Write to DB only on resolved scoring events (a viewer earned points).

**When to use:** Any state that changes faster than 100ms or that would require a DB transaction per chat message. Twitch chats can burst to 50+ messages/second.

**Trade-offs:**
- Pro: Zero latency on scoring decisions
- Pro: No Redis/DB race conditions during the 3-second scoring window
- Con: State lost if bot-worker crashes mid-round (acceptable: round restarts on reconnect)

**Example:**
```typescript
// In BlindtestPlugin — scoring window is pure in-memory
private windowTimer: ReturnType<typeof setTimeout> | null = null

startScoringWindow(durationMs: number, onClose: () => void): void {
  if (this.windowTimer) clearTimeout(this.windowTimer)
  this.windowTimer = setTimeout(() => {
    this.windowTimer = null
    onClose()
  }, durationMs)
}
```

### Pattern 2: Single Redis Channel, Multiple Event Types

**What:** All bot→overlay communication goes through one `overlay:{tenantId}` Redis channel. Event type discrimination (`type` field) drives which zone renders what.

**When to use:** Multiple consumers (OBS zones) reading the same event stream from a single producer (BotSession). Avoids fan-out complexity.

**Trade-offs:**
- Pro: One subscriber connection per overlay SSE client
- Pro: Overlay zones can be added without changing the bot-worker
- Con: Each zone client receives all events and discards irrelevant ones (negligible overhead)

### Pattern 3: Command Channel for Live Dashboard Editing

**What:** Dashboard edits (track title/malus correction, score adjustment) are sent as command messages on `session:cmd:{sessionId}` — the same channel used for next/pause/resume/end.

**When to use:** Any dashboard action that needs to mutate running bot state without restarting the session.

**Trade-offs:**
- Pro: Reuses existing authenticated command flow (web→bot)
- Pro: BotSession remains the single authority on in-memory plugin state
- Con: Score adjustments that bypass the bot (web→DB direct) require web to also publish overlay update

### Pattern 4: Bot Auto-Messages as Side Effects

**What:** After resolving a scoring event, BotSession calls `connection.sendMessage()` as a fire-and-forget side effect. The scoring event is processed and persisted first; the chat message is best-effort.

**When to use:** All bot Twitch messages. Never block scoring on message delivery.

**Trade-offs:**
- Pro: A Twitch API rate limit or transient error doesn't break scoring
- Pro: Clean separation between game logic (plugin) and presentation (formatter)
- Con: Rare edge case where score is recorded but bot message fails — acceptable for this use case

---

## Data Flow

### Scoring Window Flow (new in v2)

```
Viewer sends chat message
    ↓
BotSession.handleChatMessage()
    ↓
Check for '!' prefix → handleChatCommand() [if command]
    ↓
plugin.onChatMessage() [returns ScoringEvent | MalusEvent | null]
    ↓
if ScoringEvent:
  upsertScore() → DB (session_scores)
  getLeaderboard() ← DB
  publishScoringEvent() → Redis overlay:{tenantId}  [find/malus event type]
  publishState() → Redis overlay:{tenantId}          [state event with leaderboard]
  sendBotMessage() → TwitchChatConnection.sendMessage()
    ↓
SSE clients receive events, zones render independently
```

### Live Dashboard Edit Flow (new in v2)

```
Streamer edits track title in LiveEditTrackForm
    ↓
Server Action: liveEditTrackAction(sessionId, patch)
    ↓
Redis PUBLISH session:cmd:{sessionId}
  { action: 'edit_track', title, artist, malusTerms }
    ↓
BotSession.handleCommand() → handleEditTrack()
  plugin.updateCurrentTrack(patch)
  publishTrackChange() → Redis overlay:{tenantId}
    ↓
Overlay player zone receives track_change event, updates display
```

### Score Adjust Flow (new in v2)

```
Streamer clicks +1 / -1 on viewer in dashboard
    ↓
Server Action: adjustScoreAction(sessionId, viewerUsername, delta)
    ↓
withTenantContext: UPDATE session_scores SET score = score + delta
getLeaderboard() ← DB
getRedisPublisher().publish(overlay:{tenantId}, state event)
    ↓
Overlay leaderboard zone re-renders
```

---

## Integration Points

### New vs Modified Components

| Component | Status | What Changes |
|-----------|--------|--------------|
| `BlindtestPlugin` | Rewrite | Add scoring window, streak tracking, malus detection, double-shot logic |
| `ScoringEvent` (game-types) | Extend | Add `streak`, `isDoubleShot`, `isMalus`, `malusTermm` fields |
| `BotSession` | Extend | Add `twitchLogin` field, sendMessage calls, new command cases, `handleChatCommand()` |
| `bot-message-formatter.ts` | New | Generates Twitch chat message strings from scoring events |
| `overlay-events.ts` (game-types) | New | Typed discriminated union for all overlay event payloads |
| `session_scores` (DB) | Migration | Add `streak` column |
| `tracks` (DB) | Migration | Add `malus_terms` column |
| `sessionControlPanel.tsx` | Extend | Add live edit form, manual score adjust, export panel |
| `/overlay/[token]/player` | New | iPod zone page (client-side, public) |
| `/overlay/[token]/feed` | New | Round feed zone page (client-side, public) |
| `/overlay/[token]/leaderboard` | New | Leaderboard zone page (client-side, public) |
| `/api/overlay/[token]/route.ts` | Unchanged | Contract unchanged; new event types are additive |
| `scores.ts` (server actions) | New | `exportScores`, `importScores`, `adjustScore` |
| `tracks.ts` (server actions) | New | `liveEditTrack` |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| web → bot-worker (commands) | Redis `session:cmd:{sessionId}` | Existing; add edit_track, adjust_score actions |
| bot-worker → overlay SSE | Redis `overlay:{tenantId}` | Existing; add find, malus, track_change event types |
| web → overlay SSE (score adjust) | Redis `overlay:{tenantId}` via `getRedisPublisher()` | New: web publishes state event directly after manual score change |
| game-engine → bot-worker | Direct import (CJS package) | `packages/game-engine` must NOT be imported by apps/web (existing rule) |
| game-types → web + bot-worker | Import (shared types) | `packages/game-types` is safe to import from web for overlay event typing |

---

## Build Order (Phase Dependencies)

The natural dependency graph for v2 features:

1. **DB migrations first** — `streak` column on `session_scores`, `malus_terms` on `tracks`. Every phase that writes scores or reads malus depends on this.

2. **game-types extension** — Extend `ScoringEvent`, add `overlay-events.ts` discriminated union. Both bot-worker and web pages import these; must be done before either is changed.

3. **BlindtestPlugin rewrite** — Scoring window, streak tracking, malus detection, double-shot. Isolated in `packages/game-engine`, testable in unit tests without any web/bot plumbing. Delivers the core gameplay contract.

4. **BotSession extensions** — Wire new plugin behavior into the session (new command handlers, `sendBotMessage()`, `handleChatCommand()`). Depends on BlindtestPlugin rewrite and IChatConnection.sendMessage (already available).

5. **Overlay zone pages + event rendering** — Three new client pages consuming the existing SSE stream. Depends on game-types overlay event types. Can be built in parallel with BotSession once game-types are stable.

6. **Live dashboard editing** — `liveEditTrackAction` server action + `LiveEditTrackForm` component + `edit_track` command handling in BotSession. Depends on BotSession extensions.

7. **Score management** — Manual +/-1 adjust, export/import. Depends only on DB schema (streak column) and existing session_scores table. Can be built in parallel with overlay zones.

---

## Anti-Patterns

### Anti-Pattern 1: Storing Scoring Window State in Redis

**What people do:** Use Redis hashes to store "who has answered this round" so multiple processes could theoretically share the state.

**Why it's wrong:** The bot-worker is a single process. There is one `BotSession` and one `BlindtestPlugin` per session. Adding Redis round-trips to every chat message during a 3-second scoring window adds 5-20ms per message and creates unnecessary infrastructure coupling. The whole point of the plugin pattern is that game state is encapsulated in-process.

**Do this instead:** In-memory `Set<string>` and `Map<string, number>` inside `BlindtestPlugin`. Write only the durable output (final score delta) to DB after the event is resolved.

### Anti-Pattern 2: Separate SSE Endpoints per Overlay Zone

**What people do:** Create `/api/overlay/[token]/player`, `/api/overlay/[token]/feed`, `/api/overlay/[token]/leaderboard` as separate SSE route handlers, each with their own Redis subscriber.

**Why it's wrong:** Each SSE connection opens a dedicated Redis subscriber. With three OBS browser sources per overlay, a streamer with 1 active session would generate 3 Redis subscriber connections just for the overlay, instead of 1 (or 0 if they use a single composite overlay). Redis has connection limits; this triples the overlay connection cost unnecessarily.

**Do this instead:** Single SSE endpoint, event-type filtering in the client. OBS browser sources for each zone all point to the same `/api/overlay/[token]` and each page renders only its relevant events.

### Anti-Pattern 3: Publishing Overlay Events from Server Actions

**What people do:** After every score upsert from a server action (manual adjust), re-fetch the full state and publish it from the server action's Redis client.

**Why it's wrong (partially):** Publishing a single `state` event from the web server after a manual score adjust is actually correct and necessary (see Pattern 3 above). What is wrong is publishing game-event overlays (find/malus animations) from the web layer — those must come from the bot-worker which has the authoritative in-memory game state (streak count, window status, etc.).

**Do this instead:** Game events (find, malus, streak, double-shot) are always published by BotSession. Dashboard-initiated changes (score adjust, live edit) publish their own narrow event type (state or track_change). The two flows never overlap.

### Anti-Pattern 4: Blocking Scoring on Bot Message Delivery

**What people do:** `await this.connection.sendMessage(...)` before resolving the scoring event, so a Twitch API hiccup delays the leaderboard update.

**Why it's wrong:** tmi.js's `say()` can throw or delay if rate-limited. Scoring and overlay updates are user-visible and latency-sensitive. Chat messages are secondary feedback.

**Do this instead:** Persist score and publish overlay event first, then fire-and-forget the chat message:
```typescript
await this.upsertScore(scoringEvent)
await this.publishScoringEvent(scoringEvent)
void this.connection.sendMessage(this.twitchLogin, message)  // fire and forget
```

---

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 1-50 concurrent sessions | Current architecture is fine. Single bot-worker process handles all sessions. |
| 50-200 concurrent sessions | Bot-worker memory grows linearly (one BotSession + plugin per session). Monitor Node.js heap. No architectural change needed. |
| 200+ concurrent sessions | Split bot-worker into multiple processes via session partitioning (assign sessions to workers by hash). Requires SessionRunner to know its partition. Not needed for current scale. |

**First bottleneck:** Bot-worker memory at high session count (each BlindtestPlugin holds viewer streak maps that grow with active chat size). Mitigation: TTL-based cleanup of viewers who haven't chatted in N minutes.

**Second bottleneck:** Redis overlay channel if many overlay SSE clients reconnect simultaneously. Mitigation: SSE reconnection exponential backoff (already standard in browser EventSource).

---

## Sources

- Direct codebase analysis: `apps/bot-worker/src/bot-session.ts`, `session-runner.ts`, `connections/TwitchChatConnection.ts`
- Direct codebase analysis: `packages/game-engine/src/blindtest-plugin.ts`, `fuzzy-matcher.ts`, `normalizer.ts`
- Direct codebase analysis: `packages/game-types/src/plugin.interface.ts`
- Direct codebase analysis: `apps/web/src/app/api/overlay/[token]/route.ts`
- Direct codebase analysis: `packages/db/src/schema/sessions.ts`, `playlists.ts`
- Direct codebase analysis: `apps/web/server/redis.ts`, `apps/web/src/app/(dashboard)/sessions/components/SessionControlPanel.tsx`
- Project spec: `.planning/PROJECT.md` (v2 feature requirements)

---
*Architecture research for: Twitch Blindtest SaaS — Gameplay v2 Integration*
*Researched: 2026-03-17*
