# Feature Research

**Domain:** Twitch chat-driven music blindtest game (v2.0 gameplay engine)
**Researched:** 2026-03-17
**Confidence:** HIGH (codebase examined directly; patterns verified against Twitch ecosystem)

---

## Context: What Already Exists

The game engine package (`packages/game-engine`) already contains working implementations that inform what is truly "new" in this milestone:

| Already Built | State |
|---------------|-------|
| `normalize()` — lowercase, strip diacritics, collapse whitespace | DONE |
| `fuzzyMatch()` — Levenshtein 30% tolerance + substring inclusion | DONE |
| `BlindtestPlugin` — title/artist scoring, per-viewer one-score-per-track, double-shot detection | DONE (partial) |
| `BotSession` — passive chat listener, score upsert, leaderboard query, overlay publish | DONE (passive only) |
| Scoring: title 3pts first / 1pt after, artist 2pts first / 1pt after, double-shot 5pts flat | DONE |

What is NOT yet implemented: scoring window degression, streak multipliers, malus trap terms, bot outbound messages, chat commands, live track editing, manual score adjustment, score export.

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features that Twitch quiz game viewers and streamers expect. Missing any of these makes the game feel unfinished.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Bot confirms correct answers in chat | Every Twitch quiz bot does this — silence after a correct answer feels broken | MEDIUM | Must throttle: Twitch allows 20 msgs/30s; 1.5s minimum between sends. Message template: "@{user} a trouvé le titre ! (+3pts)" |
| `!score` command — viewer queries their score | Standard in all Twitch game bots (TwitchQuizBot, TriviaBot); viewers expect self-service | LOW | Reply directly to user in chat. Format: "@{user} : {score} pts (#{rank})" |
| `!rank` / `!top` command — leaderboard on demand | Viewers want social proof of standings without watching overlay | LOW | Show top 3 or top 5 inline. Rate-limit to one response per 10s per channel. |
| `!rules` command — game rules on demand | New viewers join mid-session and don't know how to play | LOW | Static configurable message, streamer edits it in dashboard |
| Manual score adjustment (+1/-1) | Streamer resolves edge cases (typo not caught, lag, debate) | LOW | Already has DB upsert infrastructure; needs dashboard UI + server action |
| Streamer can edit current track live | Mistakes in imported Spotify data (wrong title, featuring not stripped) | MEDIUM | Sends `edit` command via `session:cmd:{sessionId}` → bot updates plugin state mid-round |
| Session ends with a results summary | Closure — viewers want to see final standings; streamer wants a shareable moment | MEDIUM | Triggered on `end` action; show ranked leaderboard in overlay "ended" state |

### Differentiators (Competitive Advantage)

Features that set this platform apart from basic quiz bots and the existing BlindTest/n-e-r-u competitor.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Streak multiplier | Rewards consistent performers, creates tension ("will they maintain the streak?") | HIGH | Streak counter per-viewer in plugin state; resets on missed round (no find by round end). Multiplier: streak 1-2 = x1, 3-4 = x1.5, 5+ = x2. Bot announces milestones ("@user est en streak x5 !") |
| Scoring window / time degression | First finder gets max, latecomers get less — rewards speed, prevents winner-takes-all | HIGH | 3s configurable window after track reveal; points scale: first = 3, within 1s = 2, within 3s = 1. Requires `onReveal` to record timestamp. Needs `reveal` action from dashboard |
| Malus trap terms per track | Streamer adds tricky terms that penalize guessers (e.g., the producer's name, a remix version) — punishes spam-guessing | HIGH | Stored per track in DB (`malus_terms text[]`). Bot confirms malus hit in chat ("@user -1pt, piège !"). Streak breaks on malus. |
| Double-shot high-risk bonus | Title + artist in one message = jackpot or nothing — creates dramatic moments | MEDIUM | Current impl gives 5pts flat. PROJECT.md decision: if only ONE of the two matches, score 0 and block that viewer for this round. Must change current partial-credit behavior. |
| Bot announces streak milestones | Creates hype moments visible to all viewers in chat | LOW | Threshold-based (3, 5, 10 streak): "@user est en streak x{n} ! PogChamp" |
| `!streak` command | Viewer checks their own streak counter — reinforces the mechanic | LOW | Same pattern as !score — direct reply |
| Live dashboard track editing during play | Competitor tools (BlindTest/n-e-r-u) require stopping to edit; this works in-round | MEDIUM | Requires `edit` command type in `session:cmd` channel; plugin exposes `updateCurrentTrack()` |
| Score import/export JSON + CSV | Session continuity across stream breaks (e.g., Part 1 / Part 2 same evening) | MEDIUM | Export: server action reads `session_scores` for sessionId, serializes. Import: server action bulk-upserts into target session. Scores keyed by `viewerUsername`. |
| Score export as image | Shareable end-of-session screenshot for Twitter/Discord — viral loop | HIGH | html2canvas on the overlay leaderboard component (client-side), or node-canvas server-side render. Server-side preferred: consistent, no browser needed. |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Bot sends a message for EVERY wrong answer | "Immediate feedback for viewers" | At busy stream (200+ viewers) this would spam 100+ messages/min, instantly hitting Twitch rate limits (20 msgs/30s) and getting the bot banned for 1 hour | Only confirm CORRECT answers and malus hits. Wrong answers get no response — this is standard in all production quiz bots |
| Real-time score leaderboard in chat | "Some viewers don't see OBS overlay" | Leaderboard message = 10 lines; posting it on every score change floods chat and drowns gameplay | Leaderboard only on explicit `!rank` command with 10s cooldown |
| Fuzzy match with Dice/bigram coefficient | More accurate at short strings | Levenshtein already implemented and tested. Switching now creates regression risk with no meaningful UX gain for typical song titles | Keep Levenshtein at 0.30 tolerance; tune threshold if needed |
| Per-viewer streak persistence across sessions | "My streak carries over to next stream" | Requires cross-session identity; current model is session-scoped by design. Adds DB complexity (new table, cross-session queries) with low immediate value | Streaks are session-scoped. Cumulative scores (Epic 5 - Viewer profiles) will address cross-session persistence later |
| Voice/audio answer input | "Chat is too slow, let me speak" | Entirely different tech stack (WebRTC, speech-to-text). Out of scope for chat game. | Stay text-chat-only |
| Negative total scores | "Malus should be able to go below 0" | Confusing UX; viewers disengage when score goes negative | Floor total score at 0. Malus deducts from current points but min displayed score = 0 |

---

## Feature Dependencies

```
[Scoring Window / Time Degression]
    └──requires──> [Reveal action timestamp in onReveal()]
                       └──requires──> [Dashboard "Reveal" button (separate from "Next")]

[Streak Multiplier]
    └──requires──> [Per-viewer streak counter in BlindtestPlugin state]
    └──requires──> [Round-end detection to break streak on miss]
                       └──requires──> [Bot tracks which viewers scored in current round]

[Malus Trap Terms]
    └──requires──> [malus_terms column in tracks DB table (migration)]
    └──requires──> [Track data passed to plugin (currently only title + artist)]
    └──enhances──> [Streak Multiplier] (malus breaks streak)

[Double-Shot Refactor (0 on partial)]
    └──requires──> [Change to BlindtestPlugin.onChatMessage() — breaking behavior change]
    └──conflicts──> [Current partial credit behavior] (must choose one)

[Bot Auto-Messages (correct answer, malus, streak milestone)]
    └──requires──> [BotSession outbound send capability via connection.send()]
    └──requires──> [Rate limiter / message queue in BotSession]

[!score / !streak / !rank / !rules commands]
    └──requires──> [Bot Auto-Messages infrastructure]
    └──requires──> [Command prefix detection in handleChatMessage()]

[Live Track Editing]
    └──requires──> [New 'edit' command type in session:cmd channel]
    └──requires──> [plugin.updateCurrentTrack() method (new API)]
    └──requires──> [Dashboard live editing UI]

[Score Export JSON/CSV]
    └──requires──> [session_scores table with all needed fields] (already exists)
    └──requires──> [Server action: exportScores(sessionId)]

[Score Export Image]
    └──requires──> [Score Export JSON/CSV] (shares data layer)
    └──requires──> [html2canvas or server-side node-canvas render]

[Score Import]
    └──requires──> [Score Export JSON/CSV] (defines the format contract)
    └──requires──> [Server action: importScores(sessionId, data)]

[Manual Score Adjustment (+1/-1)]
    └──requires──> [Dashboard UI button per viewer row]
    └──requires──> [Server action: adjustScore(sessionId, viewerUsername, delta)]
```

### Dependency Notes

- **Scoring window requires reveal timestamp**: `onReveal()` must record `Date.now()`. This requires a dashboard "Reveal" action distinct from "Next" (currently Next = advance + reveal atomically).
- **Streak requires round-end signal**: The plugin needs to know when a round ends to penalize viewers who did NOT find the answer. This is currently missing — `next` action clears state silently. A `roundEnd` lifecycle event or check at `next` time is needed.
- **Malus requires DB migration**: Add `malus_terms text[] DEFAULT '{}'` to the tracks table (migration 0013). The track loading in bot-session.ts must also fetch this field.
- **Double-shot refactor is a breaking behavior change**: The current BlindtestPlugin gives points for each half independently then blocks the viewer. Changing to "0 on partial" requires either a two-pass check or a deferred scoring pattern where the full message is evaluated before any points are awarded. Tests must be updated.
- **Bot outbound messages need rate limiting**: Twitch enforces 20 messages per 30 seconds for non-mod bots. A simple queue with 1.5s minimum between sends is sufficient for typical blindtest traffic.

---

## MVP Definition

### Launch With (v2.0 core)

The minimum set that delivers a meaningfully better game than v1.0.

- [ ] **Scoring window (3s)** — changes the game dynamic from "first only" to "racing window"; core of v2.0 value
- [ ] **Streak multiplier** — the primary engagement loop; most visible differentiator
- [ ] **Malus trap terms** — allows streamer to configure the difficulty; requires DB migration + track edit UI
- [ ] **Double-shot refactor (0 on partial)** — aligns with the high-risk design decision; must ship with streak
- [ ] **Bot auto-messages on correct answer** — minimum viable bot feedback; silent bot feels broken
- [ ] **!score and !rank commands** — self-service for viewers; expected by Twitch audience
- [ ] **Live track editing** — practical necessity; Spotify import data is often wrong
- [ ] **Manual score adjustment** — streamer override; practical necessity for fairness

### Add After Validation (v2.1)

- [ ] **Bot streak milestone announcements** — enhances hype but not blocking; add when streak mechanic is validated
- [ ] **!streak and !rules commands** — convenience; add when !score/!rank are working
- [ ] **Score export JSON/CSV** — utility feature; add when session endings are stable
- [ ] **Score import** — session continuity; add after export format is validated

### Future Consideration (v2.2+)

- [ ] **Score export as image** — viral/sharing feature; high complexity (node-canvas dependency), defer until product-market fit confirmed for export feature
- [ ] **Configurable scoring thresholds** — streamer can set window duration, point values; defer until defaults are validated with real streams

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Bot auto-messages (correct answer) | HIGH | MEDIUM | P1 |
| Scoring window / time degression | HIGH | HIGH | P1 |
| Streak multiplier | HIGH | HIGH | P1 |
| Malus trap terms | HIGH | HIGH | P1 |
| Double-shot refactor | MEDIUM | MEDIUM | P1 |
| !score command | HIGH | LOW | P1 |
| !rank command | MEDIUM | LOW | P1 |
| Live track editing | HIGH | MEDIUM | P1 |
| Manual score adjustment | MEDIUM | LOW | P1 |
| Bot streak milestone announcements | MEDIUM | LOW | P2 |
| !streak command | MEDIUM | LOW | P2 |
| !rules command | LOW | LOW | P2 |
| Score export JSON/CSV | MEDIUM | MEDIUM | P2 |
| Score import | MEDIUM | MEDIUM | P2 |
| Score export image | LOW | HIGH | P3 |
| Configurable scoring thresholds | LOW | MEDIUM | P3 |

**Priority key:**
- P1: Must have for v2.0 launch
- P2: Should have, add in v2.1
- P3: Nice to have, future consideration

---

## Competitor Feature Analysis

| Feature | BlindTest (n-e-r-u) | TwitchTriviaBot (cleartonic) | Our v2.0 Approach |
|---------|---------------------|------------------------------|-------------------|
| Answer matching | "Typo tolerance" (algo undocumented) | Exact match from CSV | Levenshtein 30% + substring, fully tested |
| Scoring | Points to fastest | 1pt standard, 3pt bonus mode | Timing window with degression |
| Streaks | Not documented | Not implemented | Session-scoped multiplier (x1 / x1.5 / x2) |
| Malus / traps | Not documented | Not implemented | Per-track configurable trap terms |
| Double-shot | Not documented | Not implemented | Title+artist = jackpot, partial = 0 |
| Bot messages | "Optional chat notifications" | Question announcement only | Full feedback: find, malus, streak milestone |
| Chat commands | Not documented | `!score` | `!score`, `!streak`, `!rank`, `!rules` |
| Live editing | Playlist edition (stop required) | Not possible | Live mid-round via dashboard |
| Score export | Leaderboard display | Not implemented | JSON, CSV; image as v2.2 |

---

## Implementation Notes by Feature

### Scoring Window
The `onReveal()` lifecycle event must record a reveal timestamp. Each `onChatMessage()` call computes `elapsed = now - revealTimestamp`. Points: first 0s = 3, 0-1s = 2, 1-3s = 1, after 3s = 0 (too late). The 3s window is configurable at session level.

### Streak Multiplier
Track a `Map<viewerUsername, streakCount>` in plugin state. Increment on any scoring event for that viewer. Reset to 0 when `roundEnd` fires and the viewer did NOT score that round. Apply multiplier to base points before persisting. Announce milestones (3, 5, 10) via bot outbound channel.

### Malus Trap Terms
`malus_terms: string[]` on each track. During `onChatMessage()`, after fuzzy-match check, also check each malus term with `fuzzyMatch(text, term)`. If hit: deduct 1pt (floor 0), break streak, fire a `malus` scoring event. Malus is only active while the round is "open" (within reveal window or until both title+artist found).

### Double-Shot Refactor
Current: if both match, award 5pts, viewer blocked. To implement "0 on partial": evaluate title AND artist match atomically. If only one matches, award 0, block the viewer with reason `double_shot_partial`. If both match, award bonus points. This is the riskier change — requires coordinated test update.

### Bot Rate Limiting
Implement a simple `MessageQueue` in BotSession: array of pending messages, `setInterval` drains one message every 1.5s. Cap queue depth at 20 to prevent backlog. Priority: !commands replies go first, then auto-messages.

### Score Export/Import
Export: `GET /api/sessions/[id]/export?format=json|csv` — server action returns serialized `session_scores` rows. Import: `POST /api/sessions/[id]/import` — accepts the same format, bulk-upserts by `viewerUsername`, additive (adds to existing score, doesn't replace).

---

## Sources

- Codebase direct examination: `packages/game-engine/src/` (normalizer, fuzzy-matcher, blindtest-plugin, scorer tests)
- Codebase direct examination: `apps/bot-worker/src/bot-session.ts` (BotSession architecture)
- [GitHub: n-e-r-u/BlindTest](https://github.com/n-e-r-u/BlindTest) — competitor reference
- [GitHub: cleartonic/twitchtriviabot](https://github.com/cleartonic/twitchtriviabot) — scoring/command patterns
- [GitHub: pajbot/tmi-rate-limits](https://github.com/pajbot/tmi-rate-limits) — Twitch rate limit documentation (20 msgs/30s, 1.5s throttle)
- [Twitch Developer Docs: Chat & Chatbots](https://dev.twitch.tv/docs/chat/) — official rate limit confirmation
- [html2canvas](https://html2canvas.hertzen.com/) — score image export approach
- [Dice coefficient / Fuzzy text search](https://fuzzy.stereobooster.com/measures/dice-coefficient/) — algorithm reference (chose Levenshtein instead)

---

*Feature research for: Twitch blindtest SaaS — v2.0 gameplay engine*
*Researched: 2026-03-17*
