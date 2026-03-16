# Pitfalls Research

**Domain:** Real-time Twitch chat game platform — adding advanced gameplay to existing multi-tenant system
**Researched:** 2026-03-17
**Confidence:** HIGH (based on direct codebase inspection + verified external sources)

---

## Critical Pitfalls

### Pitfall 1: Fuzzy Matcher False Positives on Short Track Titles

**What goes wrong:**
The Levenshtein-based `fuzzyMatch` function uses a 30% tolerance ratio against `Math.max(input.length, target.length)`. For short target strings (3–6 characters), the allowed edit distance is 1–2 characters, which is generous enough to accept completely unrelated words. For example, with a target of "SZA" (3 chars), any 4-character word has a Levenshtein distance of 1 from it — distance/max = 1/4 = 25%, which passes. Common chat filler ("lol", "gg", "oui", "non") will trigger false matches on short artist names. The `< 3` exact-match guard covers 1–2 char targets but not 3–5 char ones.

**Why it happens:**
The ratio normalizes against the longer of the two strings. When the input is long (e.g., a sentence) and the target is short, any substring inclusion already handles that case. But when both are short, the absolute tolerance (1–2 edits) dominates and the algorithm becomes effectively exact-match with one permitted typo — which is fine — but it also collapses when the target itself is short and the input is a common short word that accidentally falls within that distance.

**How to avoid:**
Add a minimum absolute edit distance threshold: if `normTarget.length <= 5`, require exact substring match only (no Levenshtein fallback). Keep the existing Levenshtein path only for targets with 6+ normalized characters. Additionally, for the malus system, require exact substring match always (malus trap words are streamer-defined and should never fuzzy-trigger).

**Warning signs:**
- Viewers getting points in chat right after the round starts without typing the actual title/artist.
- High false-positive rate during testing with French one-word artist names (e.g., "Aya", "Vald", "SCH", "PNL").
- The scoring event reason is `correct_artist` but the matched text bears no resemblance to the artist name.

**Phase to address:** Phase 1 — Game Engine (fuzzy matcher must be validated against a corpus of short French artist names before any scoring logic is built on top of it).

---

### Pitfall 2: In-Memory TrackState Race Condition on `next` Command

**What goes wrong:**
`BlindtestPlugin` keeps `trackState` in memory in the bot-worker process. The `handleNext()` method in `BotSession` calls `setCurrentTrack()` synchronously after an async DB query, but between the DB query completing and `setCurrentTrack()` being called, incoming chat messages can still be evaluated against the previous track state. With the new scoring window (3s configurable "scratch window"), if two `next` commands arrive close together (user double-clicking), the plugin state may desync from the DB state: the plugin is evaluating messages for track N while the DB has already advanced to track N+1.

**Why it happens:**
`handleCommand()` dispatches `handleNext()` via `void this.handleCommand(message)` — fire-and-forget on the subscriber event loop. If two `next` commands arrive within milliseconds (possible if both a Redis command and a UI action fire), two concurrent `handleNext()` calls can interleave: first call fetches DB row, second call fetches same row, both increment by 1 from the same base, resulting in `currentTrackIndex` being incremented only once instead of twice.

**How to avoid:**
Serialize command processing: process one command at a time using a per-session async queue (e.g., a promise chain or a simple `busy` flag that queues pending commands). In `handleNext()`, use a DB-level atomic increment (`UPDATE sessions SET current_track_index = current_track_index + 1 WHERE id = $id RETURNING *`) rather than read-then-write. This removes the TOCTOU window.

**Warning signs:**
- Overlay skips a track silently (index jumps by 2).
- Bot announces "track revealed" but overlay still shows the previous track.
- Viewers score points on the wrong track after a fast "next" sequence.

**Phase to address:** Phase 1 — Game Engine / Session Commands (atomic DB increment must be in place before the scoring window feature is built, as the window introduces more timing sensitivity).

---

### Pitfall 3: Scoring Window State Stored Only In-Memory

**What goes wrong:**
The planned 3-second scoring window (where multiple viewers can score before the answer is "locked") requires tracking: which viewers have already scored, the exact timestamp when the first finder triggered the window, and whether the window is still open. This state currently lives in `trackState` inside `BlindtestPlugin` in the bot-worker process. If the bot-worker restarts mid-round (crash, deploy, Render restart), all in-memory state is lost. On reconnect, the scoring window is gone, `answeredViewers` is empty, and the first viewer to guess again will re-score — potentially double-scoring the same track.

**Why it happens:**
The current v1 design is stateless-enough (each track either scored or not, only first finder matters) that a restart only causes a minor glitch. With a scoring window, the state becomes temporally critical: the window open/close time, the list of who scored during the window, and the streak/malus counts per viewer are all volatile if held only in memory.

**How to avoid:**
Persist the scoring window state to Redis (not the DB) using a short-TTL key per session: `game:state:{sessionId}` as a hash containing `windowOpenAt`, `trackId`, and `answeredViewers` as a Redis Set. On bot startup, restore this state if the key exists. Use Redis TTL matching the scoring window duration so the key auto-expires when the window closes. Streak counters (per viewer) should be stored in Redis as `streak:{sessionId}:{username}` with session-scoped cleanup on `end`.

**Warning signs:**
- After a bot-worker restart, the first viewer to answer a currently-running round scores again when they already scored.
- Streak multipliers reset to 0 unexpectedly mid-session.
- Admin monitoring shows bot status going `reconnecting` → `connected` but no score anomaly detection exists.

**Phase to address:** Phase 1 — Game Engine (design the state model to use Redis from the start; retrofitting later requires touching scoring logic, bot-session, and Redis key design simultaneously).

---

### Pitfall 4: Twitch Chat Rate Limit Ban on Auto-Messages

**What goes wrong:**
The bot uses the streamer's own Twitch OAuth token with `chat:read + chat:edit` scopes. As a non-moderator, non-verified bot account, Twitch enforces a hard limit of **20 messages per 30 seconds** on that account in any channel. The planned auto-messages (find confirmation, malus announcement, streak milestone, !score response, !streak response, !rank response, !rules response) can easily exceed this in an active stream. During a peak moment (song revealed, 10+ viewers simultaneously query !score), the bot could send 20+ messages within 30 seconds and get silenced for **30 minutes** (or 1 hour in some Twitch enforcement variants), with no error surfaced to the streamer.

**Why it happens:**
tmi.js does not auto-throttle outgoing messages. It sends each `client.say()` call immediately. If the game engine emits a scoring event per correct answer and 15 viewers find the song within 3 seconds, the bot attempts to send 15+ congratulation messages in rapid succession.

**How to avoid:**
Implement a per-session message queue with a rate limiter: max 15 messages per 30 seconds (with safety margin below the 20-message limit). Use a token-bucket algorithm. For responses to chat commands (`!score`, etc.), implement a per-user cooldown (minimum 10 seconds between !score responses for the same user). Prioritize messages: scoring confirmations > streak milestones > command responses. Drop lower-priority messages if the bucket is close to full rather than queuing them indefinitely. Document in the streamer UI that the bot must be made a moderator in their channel to bypass the 20/30s limit.

**Warning signs:**
- Bot goes silent mid-session without the streamer disconnecting.
- `bot:status` key still shows `connected` (tmi.js TCP connection is alive) but chat messages stop appearing.
- tmi.js does not emit an error event on rate limit violation — messages are silently dropped by Twitch.

**Phase to address:** Phase 2 — Bot Auto-Messages (must implement rate limiter before enabling auto-messages; testing with 5+ simulated concurrent finders is mandatory).

---

### Pitfall 5: SSE Overlay Event Type Mismatch Breaking Existing OBS Sources

**What goes wrong:**
The existing overlay SSE sends three event types: `connected`, `state`, and `scoring`. OBS browser sources cache and reload independently — a streamer's OBS may be running the v1 overlay JavaScript while the bot-worker is sending v2 event payloads (e.g., a `round_feed` event type with a new payload shape, or a `state` event with added fields). If the overlay JS tries to destructure `event.leaderboard` but the new payload sends `event.zones.leaderboard`, the overlay silently breaks — no error shown in OBS, the overlay just freezes or shows stale data.

**Why it happens:**
The current `publishState()` method sends raw JSON directly. There is no versioning field in the payload. The overlay frontend code parses the JSON assuming a fixed shape. Adding new event types is safe (unknown types are ignored), but changing the shape of existing types (`state`, `scoring`) without a version field is a breaking change that cannot be safely rolled out.

**How to avoid:**
Add a `version` field to every payload from day one of v2: `{ version: 2, type: "state", ... }`. The overlay JS checks `event.version` and handles both v1 (no version field = v1) and v2 shapes. For the 3-zone redesign, add new event types (`zone_player`, `zone_feed`, `zone_leaderboard`) rather than replacing the existing `state` event — OBS sources subscribed to the old single-overlay URL continue working. Provide the 3-zone overlay as separate URL paths (`/api/overlay/[token]/player`, `/api/overlay/[token]/feed`, `/api/overlay/[token]/leaderboard`) rather than one combined endpoint, allowing OBS sources to be pointed at individual zones without changing the existing contract.

**Warning signs:**
- During development, testing the new overlay in a browser works fine, but the streamer's existing OBS layout breaks after deployment.
- The overlay JS throws `Cannot read property of undefined` in the OBS browser source console (not visible to the streamer).
- Streamers report "overlay froze" after an update they didn't initiate.

**Phase to address:** Phase 3 — Overlay Redesign (versioning strategy must be decided before any payload changes are made to `publishState()` or `publishScoringEvent()`).

---

### Pitfall 6: Live Track Editing While Scoring Window Is Open

**What goes wrong:**
The streamer edits the title/artist/malus of the current track live during a round (the planned "live dashboard editing" feature). The edit is persisted to the DB and a command is sent via `session:cmd:{sessionId}`. Meanwhile, the bot is mid-way through evaluating incoming chat messages against the old title. The edit arrives asynchronously while 3 viewers' messages are being processed concurrently: 2 viewers matched the old title and got points; 1 viewer's match is still in-flight when the edit arrives; after the edit, no one can match the old title anymore. This is an inconsistent state: some viewers were rewarded for a title that "never existed" from the streamer's perspective.

**Why it happens:**
The bot-worker's `handleChatMessage()` reads `this.currentTrackTitle` from memory at the time the message is processed. The Redis command for a live edit would call a new `update_track` command handler which calls `setCurrentTrack()` synchronously. But JavaScript's event loop means ongoing async operations (the in-flight `onChatMessage` call) see the old values while new messages see the new values.

**How to avoid:**
Apply track edits only at round boundaries (between rounds, not mid-round). In the dashboard, show a warning when attempting a live edit during an active round: "Edit will take effect at the next track." If mid-round editing is required, implement an `edit_lock` that freezes the scoring window for the current track, applies the edit atomically, and broadcasts a `track_edited` SSE event. The overlay should show the updated metadata immediately, but scoring continues against the new title only from the next full chat message cycle.

**Warning signs:**
- A viewer reports they got points but the answer displayed on the overlay is different from what they typed.
- The `reason` field in ScoringEvent says `correct_title` but the overlay is showing a different title.
- During testing, rapid edits + chat message floods produce inconsistent leaderboard entries.

**Phase to address:** Phase 4 — Live Dashboard Editing (document the "edit at round boundary" decision in the phase spec; do not implement mid-round editing in v2.0 unless the locking mechanism is explicitly scoped).

---

### Pitfall 7: upsertScore Race Condition on Concurrent Chat Messages

**What goes wrong:**
`BotSession.upsertScore()` does a read-then-write pattern in the DB: SELECT the existing score row, then UPDATE or INSERT. Under the current single-stream architecture (one `onMessage` handler per session), this is not a problem. With the new scoring window allowing multiple finders per track, multiple scoring events will be emitted in rapid succession for the same session (5–10 events within 3 seconds). Each `upsertScore()` call reads the existing row, gets the same score value (because the previous update hasn't committed yet), and writes `existing.score + event.points` — overwriting concurrent updates.

**Why it happens:**
JavaScript's async/await in Node.js is single-threaded but the DB operations are I/O bound and interleave. If 3 scoring events for different viewers arrive simultaneously, all 3 concurrent `upsertScore()` calls can read the same "no existing row" state and each try to INSERT, causing a unique constraint violation on the second and third inserts. Or if a row exists, all 3 reads return score=10 and all 3 writes set score=11/12/13 instead of score=13.

**How to avoid:**
Replace the read-then-write with an atomic DB upsert using `INSERT ... ON CONFLICT DO UPDATE SET score = score + excluded.score`. In Drizzle ORM with PostgreSQL this is `db.insert(sessionScores).values(...).onConflictDoUpdate({ target: [sessionScores.sessionId, sessionScores.viewerUsername], set: { score: sql`${sessionScores.score} + excluded.score` } })`. This makes the increment atomic at the DB level. Also add a unique index on `(session_id, viewer_username)` if not already present.

**Warning signs:**
- Unique constraint violation errors in bot-worker logs during peak scoring moments.
- Final leaderboard scores are lower than expected (lost increments due to overwrite).
- Viewers report their score "reset" after a burst of correct answers.

**Phase to address:** Phase 1 — Game Engine / Scoring (fix the upsert before implementing the scoring window; the bug exists in v1 but is rarely triggered because only 1 finder per track was possible).

---

### Pitfall 8: Double-Shot Penalty Implementation Edge Case

**What goes wrong:**
The planned double-shot mechanic awards bonus points when a viewer guesses title + artist in the same message, but penalizes by taking ALL points if only one is correct. The current `BlindtestPlugin` already awards 5 points for a double match. The v2 mechanic adds: if a viewer sends a message matching title+artist but only one is actually correct (e.g., title matched but artist failed the new stricter threshold), they lose all accumulated points for the session. This is the most punishing mechanic in the game. The edge case: the double-shot penalty fires even if the viewer got 0 points previously (they lose 0 points — fine), but also fires if they typed a very long sentence that happened to fuzzy-match the artist name as a substring but not intentionally (they suffer a penalty for a false positive generated by the system).

**Why it happens:**
The fuzzy matcher's substring inclusion check (`normInput.includes(normTarget)`) is broad. A viewer typing "je pense que c'est bohemian rhapsody de queen là vraiment" matches both title and artist via substring — correctly. But a viewer typing "c'est pas ça lol jean" on a track by an artist named "Jean" matches via substring too. If they were attempting a double-shot but the title doesn't match, they get the malus for attempting and failing a double-shot they never intended.

**How to avoid:**
The double-shot penalty should only apply when the viewer's message structure is clearly attempting both: either require the message to be short enough (< 60 normalized chars) to be an intentional guess, or require the viewer to use a delimiter (`!guess title | artist`). Alternatively, remove the "lose all points" penalty from the double-shot mechanic entirely and instead just award 0 bonus points on a failed double-shot. The PROJECT.md notes this is a design decision ("Pure high-risk bonus, as designed") — validate with the streamer before coding the penalty path.

**Warning signs:**
- Viewers complain their score went negative or to zero without knowing why.
- During testing with verbose chat messages, double-shot penalties fire unexpectedly.
- The bot announces a double-shot penalty but the viewer never intended to guess both.

**Phase to address:** Phase 1 — Game Engine (the double-shot penalty path must be explicitly tested with edge-case inputs before the scoring window is added on top).

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Keep TrackState fully in-memory | Simpler code, faster reads | Scoring state lost on bot restart; invalid scores after deploy | Never for sessions > 15 minutes |
| Use `client.say()` without rate limiter | Easy to implement | Bot silenced for 30+ minutes in active streams | Never in production |
| Modify `state` SSE payload shape without versioning | Faster iteration | Breaks running OBS overlays silently | Never after v1 is live |
| Read-then-write upsertScore pattern | Readable code | Lost increments under concurrent scoring events | Only if single-finder-per-track is guaranteed |
| Apply live track edits immediately mid-round | Feels responsive | Race with in-flight scoring; inconsistent awarded points | Never; defer to round boundary |
| Export format without schema version field | Simple JSON | Import breaks silently when fields are added/renamed | Only for MVP throwaway exports |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Twitch IRC via tmi.js | Assuming `client.say()` failure will throw or emit an error when rate-limited | Twitch silently drops the message; implement explicit token-bucket counter client-side |
| Twitch IRC via tmi.js | Using the streamer's own account token without making the bot a mod in their channel | The 20/30s limit is 5x stricter than for moderators; require streamers to add bot as mod |
| Redis pub/sub overlay channel | Publishing large payloads per scoring event in active sessions (100 viewers × N events/second) | Keep scoring event payloads minimal; send full leaderboard only on `state` events, not per-score |
| Redis pub/sub + SSE | Assuming SSE client receives every message if it briefly disconnects | Pub/sub is fire-and-forget; SSE client misses messages during disconnect; send a `state` snapshot on reconnect |
| PostgreSQL RLS + Drizzle | `onConflictDoUpdate` with raw SQL expressions requires the Render non-superuser INSERT policy to already cover the `SET` target columns | Verify RLS policies cover all columns touched by the atomic upsert before writing the migration |
| Sørensen-Dice vs Levenshtein | PROJECT.md calls for Dice bigrammes (threshold 0.8) but current code uses Levenshtein (tolerance 0.30) | Align implementation with the documented decision; mixing the two in different code paths causes inconsistent scoring perceptions |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| DB leaderboard query on every chat message | DB load spikes during active rounds; leaderboard query adds 20–50ms to every scoring event | Cache leaderboard in Redis (ZSET sorted set); update on score change; read from Redis for overlay | At 50+ concurrent active sessions on Render free/starter tier |
| One Redis subscriber per SSE connection | Redis connection count grows linearly with connected overlay clients; Render Redis limits connections | Multiplex: one subscriber per tenant (or per server instance), fan-out to SSE controllers in-process | At 10+ concurrent overlay viewers per tenant, or 20+ tenants |
| Levenshtein on every chat message | CPU-bound O(n×m) per message; no throttle; active chat = 100+ messages/minute | Short-circuit: exact match first, then normalize and check substring, only then run Levenshtein | At 500+ messages/minute (mid-size streamer during reveal) |
| getLeaderboard() fetches all scores ordered by score | Full table scan on `session_scores` per scoring event | Add index on `(session_id, score DESC)`; or keep top-10 in Redis ZSET | At 500+ viewers per session |
| SSE stream holds open a Redis subscriber even when OBS browser source is reloading | Redis connections accumulate from zombie streams; cleanup only happens on stream `cancel` | The `cancel` cleanup exists — verify it fires reliably; add a max stream lifetime (e.g., 4 hours) with forced reconnect | At 50+ overlay clients with frequent OBS reloads |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Accepting `update_track` commands from `session:cmd:{sessionId}` without verifying the command came from the session owner | A tenant who knows another session's ID can modify that session's track in the bot | The web layer already validates ownership before publishing to Redis; do not add direct Redis write endpoints for tenant UI |
| Malus trap terms stored without sanitization | A streamer can define a malus term that is a regex-style string and exploit the normalizer behavior | Treat malus terms as plain strings only; the normalizer strips special chars — verify it does before fuzzy/substring matching |
| Score export includes `tenantId` and `sessionId` in the exported file | If a streamer shares an export publicly, internal IDs are exposed | Omit internal IDs from exports; include only viewer-facing data (username, displayName, score, correctAnswers) |
| Bot OAuth token refresh not handled | Token expires mid-session; bot silently stops responding to Twitch | Implement token refresh on 401 from tmi.js connection error; the existing `onReconnect` path should attempt a fresh token fetch |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Bot announces every correct answer in chat | During a popular track, the bot sends 10–20 messages in seconds, flooding the chat and frustrating viewers | Only announce first finder; optionally announce streak milestones; silence bot for repeat finders beyond position 3 |
| Streamer's live edit applies to the track display before the round ends | Viewers who already answered the old title/artist feel cheated; viewers mid-typing see the title change | Lock display until next track; show edit as "pending" in dashboard |
| !score command shows score with no context | Viewer knows their score but not their rank or how far behind they are | !score response: "{displayName}: {score} pts (#{rank} — {gap} pts behind #{rank-1})" |
| Malus fires on partial text that contains the trap word | Viewer typing a long sentence to discuss the song gets malus'd for accidentally including the banned word | Malus should require the trap word to be a standalone token (surrounded by spaces or punctuation), not a substring of another word |
| Score export as image has no consistent visual identity | Each export looks different between sessions; doesn't reinforce the platform brand | Template the image export; include session date, streamer name, top N annotation |

---

## "Looks Done But Isn't" Checklist

- [ ] **Fuzzy matching:** Threshold tested against a corpus of short French artist names (3–6 chars) — verify false positive rate < 1% on common French chat words.
- [ ] **Scoring window:** Window start timestamp is persisted to Redis — verify it survives a bot restart mid-round.
- [ ] **Streak counter:** Streak resets on malus AND on wrong answer — verify both paths explicitly in tests.
- [ ] **Bot auto-messages:** Rate limiter is active and tested with 25 rapid scoring events in 30 seconds — verify bot is not silenced.
- [ ] **Double-shot:** Penalty path tested with verbose unintentional messages — verify false-positive penalty rate.
- [ ] **SSE overlay:** `version` field present on all new payload types — verify old overlay JS ignores unknown `version` values gracefully.
- [ ] **upsertScore:** Atomic upsert tested with 10 concurrent DB calls for the same `(sessionId, viewerUsername)` — verify no lost increments.
- [ ] **Live edit:** Dashboard warns when attempting edit during an active round — verify edit is deferred, not applied immediately.
- [ ] **Score export:** Exported JSON includes a `schemaVersion` field — verify import rejects files with unsupported schema version rather than silently misreading them.
- [ ] **Bot rate limit:** tmi.js token bucket is counting sent messages and dropping non-critical messages before hitting 20/30s — verify with a test hook.

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| False positive fuzzy matches on short names | LOW | Deploy updated threshold; no DB changes needed; scores already awarded stand |
| `next` command double-increment | MEDIUM | Migrate `current_track_index` to use atomic DB increment; no data migration needed |
| In-memory TrackState lost on restart | MEDIUM | Add Redis state restoration in BotSession.start(); requires new Redis key schema |
| Bot silenced by Twitch rate limit | LOW (resolves in 30 min) | Add rate limiter; until then, tell streamer to add bot as mod in their channel |
| SSE payload shape broken existing overlays | HIGH | Must deploy backward-compat `version` check in overlay JS AND revert payload shape; forces coordinated deploy |
| upsertScore lost increments | MEDIUM | Rewrite upsert as atomic SQL; historical sessions are unrecoverable |
| Live edit mid-round score inconsistency | LOW | Enforce edit-at-boundary rule; no data corruption, just policy |
| Export schema breakage | MEDIUM | Add `schemaVersion` field + import validation; old exports become unimportable |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Fuzzy false positives on short strings | Phase 1 — Game Engine | Test suite with 50+ short French artist names; < 1% false positive on common chat words |
| `next` command TOCTOU on `currentTrackIndex` | Phase 1 — Game Engine | Atomic DB increment in migration; concurrent `next` integration test |
| In-memory scoring state lost on restart | Phase 1 — Game Engine | BotSession.start() restores Redis game state; test bot kill mid-round |
| Bot rate limit silence | Phase 2 — Bot Auto-Messages | Token-bucket test: 25 events/30s; bot sends ≤ 15 messages and drops the rest with a log entry |
| SSE payload backward compat | Phase 3 — Overlay Redesign | `version` field on all payloads; overlay JS handles v1 (no version) and v2 side-by-side |
| Live edit mid-round inconsistency | Phase 4 — Live Editing | Dashboard shows warning + defers edit; integration test with edit during active scoring window |
| upsertScore concurrent race | Phase 1 — Game Engine | Atomic upsert migration; concurrent upsert test (10 parallel calls for same viewer) |
| Double-shot false penalty | Phase 1 — Game Engine | Test suite with long verbose chat messages; penalty only fires on short intentional guess pattern |
| Leaderboard DB query per message | Phase 1 — Game Engine | Redis ZSET leaderboard; verify DB not queried on every scoring event at 50+ events/min |
| Export schema instability | Phase 5 — Score Export | `schemaVersion: 1` in export; import rejects unknown versions with clear error |

---

## Sources

- Direct inspection of `/home/desty/42/Playground/packages/game-engine/src/fuzzy-matcher.ts` and `normalizer.ts` — pitfalls 1, 8 derived from code analysis
- Direct inspection of `/home/desty/42/Playground/apps/bot-worker/src/bot-session.ts` — pitfalls 2, 3, 7 derived from code analysis
- Direct inspection of `/home/desty/42/Playground/apps/web/src/app/api/overlay/[token]/route.ts` — pitfall 5 derived from code analysis
- [Twitch Chat Rate Limits — TMI Rate Limits (pajbot/tmi-rate-limits)](https://github.com/pajbot/tmi-rate-limits) — MEDIUM confidence, community-maintained
- [Twitch Developer Forums — Rate Limit Clarification](https://discuss.dev.twitch.com/t/rate-limit-clarification/40367) — MEDIUM confidence, official forum
- [Twitch Developer Forums — Chatbot Rate Limit Thoughts](https://discuss.dev.twitch.com/t/chatbot-rate-limit-thoughts/15538) — MEDIUM confidence
- [Redis — Fixing Race Conditions with Lua (DEV Community)](https://dev.to/silentwatcher_95/fixing-race-conditions-in-redis-counters-why-lua-scripting-is-the-key-to-atomicity-and-reliability-38a4) — HIGH confidence (validated against Redis docs)
- [Redis Transactions — MULTI/EXEC/WATCH](https://redis.io/docs/latest/develop/using-commands/transactions/) — HIGH confidence (official Redis docs)
- [MDN — Using Server-Sent Events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events) — HIGH confidence (MDN official)
- [Twitch Verified Bot Status Update (May 2024 join limit change)](https://discuss.dev.twitch.com/t/an-update-for-the-delayed-bot-verification-request-process/32325) — MEDIUM confidence, official forum

---
*Pitfalls research for: Twitch Blindtest Platform — v2.0 Advanced Gameplay Addition*
*Researched: 2026-03-17*
