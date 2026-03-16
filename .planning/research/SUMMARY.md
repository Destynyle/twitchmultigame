# Project Research Summary

**Project:** Twitch Blindtest SaaS — Milestone v2 Gameplay Engine
**Domain:** Real-time Twitch chat game platform (advanced scoring mechanics)
**Researched:** 2026-03-17
**Confidence:** HIGH

## Executive Summary

This milestone adds advanced gameplay mechanics to an existing, functional Twitch blindtest platform. The architecture is well-understood through direct codebase inspection: a Next.js 15 web app communicates with a Node.js bot-worker via Redis pub/sub, with a `packages/game-engine` library containing the core matching and scoring logic. The recommended approach is incremental augmentation — not a rewrite. All new features can be built by extending the existing `BlindtestPlugin`, `BotSession`, and Redis command channel without introducing new architectural patterns. The only new npm dependencies are `papaparse`, `satori`, and `@resvg/resvg-js` for score export functionality.

The v2.0 differentiators are: a 3-second scoring window (multiple finders per track, time-degraded points), streak multipliers (x1/x1.5/x2 based on consecutive finds), malus trap terms (per-track penalty terms configured by the streamer), and a double-shot all-or-nothing bonus. These mechanics interact — the scoring window enables multiple finders, which makes streaks meaningful, and malus adds a risk layer. They must be built as a coordinated unit. On top of this, the bot gains outbound chat capabilities (auto-messages, `!score`/`!streak`/`!rank`/`!rules` commands) and the dashboard gains live track editing and score management tools.

The most critical risks are: (1) upsertScore race conditions under the new multi-finder model — must use atomic SQL upserts before implementing the scoring window; (2) the Twitch chat rate limit (20 messages/30s) will silently silence the bot if auto-messages are not rate-limited; (3) any shape change to the existing `state`/`scoring` SSE event payloads will break running OBS overlays without warning. All three can be fully prevented at the architectural level if addressed in the right phase order. The build order recommended by architecture research — DB migrations → game-types → BlindtestPlugin rewrite → BotSession extension → overlay zones → dashboard editing → score management — is the correct sequence to avoid cascading rework.

---

## Key Findings

### Recommended Stack

The existing stack is sufficient for all v2 gameplay logic. The `BlindtestPlugin`, `BotSession`, and `TwitchChatConnection.sendMessage()` already provide the hooks needed. Zero new dependencies are required for the core game engine, bot auto-messages, chat commands, live track editing, or overlay zone routing.

The only new dependencies are scoped to the score export feature in `apps/web`: `papaparse` ^5.4.1 (CSV generation), `satori` ^0.18.3 (JSX-to-SVG for score image), and `@resvg/resvg-js` ^2.6.2 (SVG-to-PNG via Rust). The image export route must use `runtime = 'nodejs'` — satori is incompatible with the Next.js Edge runtime. `puppeteer`/`canvas` are explicitly ruled out due to memory and build environment constraints on Render.

**Core technologies:**
- `BlindtestPlugin` (existing, packages/game-engine): core game logic — extend in-place, no new state-management library
- `BotSession` (existing, apps/bot-worker): orchestration — extend with `twitchLogin` field and `sendMessage` calls
- Redis pub/sub (existing): overlay fan-out and command channel — reuse both channels, add new event types
- `papaparse` ^5.4.1: CSV export — lightweight, no peer deps, server-side compatible
- `satori` + `@resvg/resvg-js`: score image export — Node.js runtime only, Vercel-native, no Chromium

### Expected Features

**Must have for v2.0 (table stakes + core differentiators):**
- Bot confirms correct answers in chat — silent bot feels broken to Twitch audience
- `!score` and `!rank` commands — expected self-service by any Twitch game viewer
- Scoring window / time degression (3s) — the core v2.0 value proposition
- Streak multiplier (x1/x1.5/x2) — primary engagement loop and visible differentiator
- Malus trap terms — streamer-controlled difficulty; requires DB migration
- Double-shot refactor (0 on partial) — aligns with the high-risk design decision
- Live track editing from dashboard — practical necessity; Spotify data is often wrong
- Manual score adjustment (+1/-1) — streamer fairness override

**Should have for v2.1 (secondary features):**
- Bot streak milestone announcements (3/5/10) — hype amplification after streak mechanic is validated
- `!streak` and `!rules` commands — convenience commands once infrastructure is live
- Score export JSON/CSV — session continuity for multi-part streams
- Score import — requires export format to be validated first

**Defer to v2.2+:**
- Score export as image (satori/resvg) — viral/sharing feature, high complexity, validate export need first
- Configurable scoring thresholds — defer until defaults are validated with real streams

**Explicit anti-features (do not build):**
- Bot messages for wrong answers — causes rate limit ban on busy streams
- Real-time leaderboard in chat on every score change — floods chat
- Per-viewer streak persistence across sessions — requires Epic 5 viewer profiles, not in scope

### Architecture Approach

The architecture preserves all existing boundaries: `BlindtestPlugin` holds all sub-second game state in-memory (scoring window, streak counters, answered viewers), writes only resolved scoring events to PostgreSQL, and publishes overlay events on the single `overlay:{tenantId}` Redis channel. The three OBS overlay zones are implemented as separate Next.js pages that all connect to the same SSE endpoint and filter events client-side — not as separate Redis subscribers, which would triple connection cost. Dashboard edits (live track metadata, score adjustments) flow through the existing `session:cmd:{sessionId}` command channel for in-process mutations, or write directly to DB (score adjustments) with the web server publishing a `state` event to the overlay channel.

**Major components and changes:**
1. `BlindtestPlugin` (rewrite) — add scoring window (Date.now() timestamps), per-viewer streak Map, malus term detection, double-shot atomic evaluation
2. `BotSession` (extend) — add `twitchLogin` field, `MessageQueue` rate limiter, `handleChatCommand()` routing, `sendBotMessage()` fire-and-forget
3. `bot-message-formatter.ts` (new) — generate Twitch chat strings from scoring events; keeps presentation separate from game logic
4. `overlay-events.ts` in game-types (new) — typed discriminated union for all v2 overlay payloads with `version: 2` field
5. DB migrations — add `streak` column to `session_scores`, `malus_terms text[]` to `tracks`
6. `/overlay/[token]/player|feed|leaderboard` pages (new) — three zone client pages, same SSE stream
7. `scores.ts` + `tracks.ts` server actions (new) — export/import/adjust/liveEdit

### Critical Pitfalls

1. **upsertScore concurrent race condition** — with multiple finders per track, concurrent DB writes for the same `(sessionId, viewerUsername)` will lose score increments. Fix: replace read-then-write with atomic `INSERT ... ON CONFLICT DO UPDATE SET score = score + excluded.score`. Must be in place before the scoring window is built.

2. **Twitch chat rate limit (20 msg/30s) silently bans the bot** — tmi.js does not surface rate limit errors; Twitch simply drops messages. Fix: implement a token-bucket `MessageQueue` in `BotSession` capped at 15 messages/30s, with priority queuing (scoring confirmations first) and message dropping for non-critical messages. Require streamers to add the bot as moderator for 100 msg/30s budget.

3. **SSE payload shape change breaks running OBS overlays** — any modification to existing `state`/`scoring` event shapes without versioning breaks OBS browser sources silently (no error shown to streamer). Fix: add `version: 2` field to all new payloads; only add new event types (`find`, `malus`, `track_change`) rather than replacing existing ones.

4. **Fuzzy matcher false positives on short artist names** — the 30% Levenshtein tolerance accepts completely unrelated 3-5 char words as matches (e.g., "lol" matches a 4-char artist name). Fix: require exact substring match for targets with 5 or fewer normalized characters; never use Levenshtein fallback on short strings. Malus terms must always use exact substring match.

5. **Double-shot false penalty on verbose chat messages** — substring inclusion can match artist name inside a long conversational sentence, triggering the "0 on partial double-shot" penalty on a viewer who never intended to guess. Fix: restrict double-shot penalty to messages under 60 normalized characters, or remove the "lose all points" penalty entirely (validate this design decision with the streamer before coding the penalty path).

---

## Implications for Roadmap

Based on the dependency graph from architecture research, the natural build order requires 5-6 phases with strict sequencing for the first three. Phases 4-6 can overlap once the engine foundation is stable.

### Phase 1: Game Engine Foundation

**Rationale:** Everything else depends on a correct game engine. DB schema changes and the upsertScore race condition fix must land before any scoring window work can be tested. BlindtestPlugin is the most tested component — extending it in isolation (unit tests, no web/bot plumbing) is the safest approach.

**Delivers:** A fully tested game engine implementing all v2.0 scoring mechanics (window, streak, malus, double-shot), DB migrations, and atomic DB upsert — ready to be wired into bot-session.

**Addresses:** Scoring window, streak multiplier, malus trap terms, double-shot refactor (from FEATURES.md v2.0 core)

**Avoids:** upsertScore race condition (Pitfall 7), fuzzy false positives on short strings (Pitfall 1), double-shot false penalty edge case (Pitfall 8), `next` command TOCTOU (Pitfall 2)

**DB migrations in this phase:**
- `session_scores.streak integer NOT NULL DEFAULT 0`
- `tracks.malus_terms text[] NOT NULL DEFAULT '{}'`
- Atomic upsert migration (unique index on `(session_id, viewer_username)`)

### Phase 2: Bot Auto-Messages and Chat Commands

**Rationale:** Bot outbound capability is the second dependency layer. BotSession must be extended with the MessageQueue and sendMessage wiring before any user-facing bot behavior ships. Rate limiting is non-negotiable — shipping without it guarantees a production ban.

**Delivers:** A fully active bot that confirms finds, announces malus/streaks, and responds to `!score`/`!rank` commands, with a token-bucket rate limiter enforcing the 15 msg/30s budget.

**Addresses:** Bot auto-messages on correct answer, !score and !rank commands (from FEATURES.md v2.0 core)

**Avoids:** Twitch rate limit ban (Pitfall 4)

**Uses:** `IChatConnection.sendMessage()` (already wired in TwitchChatConnection), `bot-message-formatter.ts` (new)

### Phase 3: Overlay Zone Redesign

**Rationale:** Overlay changes must be additive — new event types and new URL paths, never replacing existing payload shapes. Versioning must be decided and implemented before touching any existing event payload. This phase can begin once game-types overlay event types are finalized in Phase 1.

**Delivers:** Three independent OBS overlay zones (`/overlay/[token]/player|feed|leaderboard`), new typed event payloads with `version: 2`, and full backward compatibility with the existing single-overlay URL.

**Addresses:** Three-zone overlay requirement (ARCHITECTURE.md), SSE backward compatibility

**Avoids:** SSE payload backward compat breakage (Pitfall 5)

**Pattern:** Single SSE endpoint, client-side event filtering per zone page — do NOT create separate SSE routes per zone (Anti-Pattern 2 from ARCHITECTURE.md)

### Phase 4: Live Dashboard Editing

**Rationale:** Depends on Phase 2 (BotSession extension) for the `handleCommand()` routing, and on Phase 1 DB migrations for `malus_terms`. The critical constraint: live edits apply at round boundaries only, never mid-round. Dashboard must show a warning during active rounds and defer edits.

**Delivers:** `LiveEditTrackForm` component, `liveEditTrackAction` server action, `edit_track`/`set_malus_terms` command types in BotSession, with round-boundary enforcement.

**Addresses:** Live track editing (FEATURES.md v2.0 core)

**Avoids:** Live edit mid-round race condition (Pitfall 6)

### Phase 5: Score Management (Manual Adjust + Export/Import)

**Rationale:** Lowest dependency footprint of all phases — requires only the DB schema from Phase 1. Can be built in parallel with Phase 3 and 4. Score export/import is a pure data transformation in the web layer; no bot-worker involvement.

**Delivers:** Manual +/-1 score adjustment in dashboard, JSON/CSV score export, score import for session continuity.

**Addresses:** Manual score adjustment, score export JSON/CSV (FEATURES.md v2.0 core + v2.1)

**Uses:** `papaparse` ^5.4.1 for CSV generation; server actions in `apps/web/server/actions/sessions/scores.ts`

**Avoids:** Export schema instability — include `schemaVersion: 1` field in export; import rejects unsupported versions

### Phase 6: Secondary Bot Commands and Score Image Export

**Rationale:** These are v2.1/v2.2 features that add polish after the core mechanics are validated. Score image export has the highest implementation cost (satori + resvg-js, font bundling, Node.js runtime constraint) and lowest immediacy — defer until export demand is confirmed.

**Delivers:** `!streak` and `!rules` commands, bot streak milestone announcements (3/5/10), score export as PNG image.

**Addresses:** v2.1 secondary features from FEATURES.md

**Uses:** `satori` ^0.18.3 + `@resvg/resvg-js` ^2.6.2 (Node.js runtime only, not Edge)

### Phase Ordering Rationale

- **Phase 1 must come first:** DB migrations, atomic upsert, and the engine contract are prerequisites for all other phases. Building BotSession wiring on a buggy engine means debugging through two layers simultaneously.
- **Phase 2 before Phase 3:** Bot auto-messages depend on a working scoring engine (Phase 1) and must be rate-limited before any user sees them. Overlay zones display bot-emitted events — they can be built in parallel but need the event type contract from Phase 1 game-types work.
- **Phase 4 depends on Phase 2:** Live editing flows through `BotSession.handleCommand()` which is extended in Phase 2.
- **Phase 5 is independent:** Score adjust and export only touch the DB and web layer. Can begin after Phase 1 migrations land.
- **Phase 6 is purely additive:** No dependencies on Phases 3-5 except the bot infrastructure from Phase 2.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 1 (Game Engine):** The Redis state persistence strategy for scoring window (Pitfall 3 — `game:state:{sessionId}` key design) needs to be fully specified before coding. The bot restart recovery flow is a new pattern not yet in the codebase.
- **Phase 3 (Overlay Zones):** The backward-compat versioning strategy for existing SSE payloads needs a concrete decision: add `version` field additively vs. parallel event types. A wrong choice here requires a coordinated deploy.

Phases with standard patterns (skip research-phase):
- **Phase 2 (Bot Auto-Messages):** Token-bucket rate limiting is a well-documented pattern; the implementation is 20-30 lines of TypeScript. No research needed.
- **Phase 5 (Score Management):** Pure CRUD + data transformation. papaparse is well-documented; atomic Drizzle upsert pattern is established in the codebase.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Codebase audited directly; new libraries verified against npm and official docs |
| Features | HIGH | Existing game engine inspected directly; competitor analysis confirms table stakes; Twitch rate limit behavior verified against multiple sources |
| Architecture | HIGH | Based on direct code analysis of all major components; all integration points traced through the actual source files |
| Pitfalls | HIGH | 7 of 8 critical pitfalls derived from direct code inspection; rate limit behavior is MEDIUM (community docs, not official Twitch API docs) |

**Overall confidence:** HIGH

### Gaps to Address

- **Redis game state persistence design (Pitfall 3):** The research identifies the need to persist scoring window state to Redis for crash recovery, but does not fully specify the key schema, the restore logic in `BotSession.start()`, or the cleanup strategy on session `end`. This needs a concrete spec before Phase 1 coding begins.
- **Double-shot penalty validation:** PITFALLS.md flags that the "lose all points on partial double-shot" design decision should be validated with the streamer before coding the penalty path. The architectural choice (penalty vs. no penalty) has downstream test implications. This is a product decision, not a technical one.
- **Render deployment RLS status:** MEMORY.md notes an outstanding RLS INSERT policy issue on Render. This is pre-existing and unrelated to v2, but any new DB migrations (Phase 1) must account for the non-superuser INSERT policy pattern already established in migration 0011.
- **Bot moderator status in streamer channels:** The rate limit mitigation (100 msg/30s for mods vs 20 msg/30s for regular bots) requires streamers to add the bot as a mod. This is a UX/onboarding requirement that needs to be surfaced in the dashboard.

---

## Sources

### Primary (HIGH confidence)
- Direct codebase audit: `packages/game-engine/src/fuzzy-matcher.ts`, `blindtest-plugin.ts`, `normalizer.ts`
- Direct codebase audit: `apps/bot-worker/src/bot-session.ts`, `session-runner.ts`, `connections/TwitchChatConnection.ts`
- Direct codebase audit: `apps/web/src/app/api/overlay/[token]/route.ts`, `apps/web/server/redis.ts`
- Direct codebase audit: `packages/game-types/src/plugin.interface.ts`, `packages/db/src/schema/sessions.ts`
- [papaparse docs](https://www.papaparse.com/docs) — `Papa.unparse()` for CSV generation
- [satori GitHub](https://github.com/vercel/satori) — JSX-to-SVG, Node.js runtime requirement confirmed
- [MDN — Server-Sent Events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events) — SSE reconnect behavior

### Secondary (MEDIUM confidence)
- [pajbot/tmi-rate-limits](https://github.com/pajbot/tmi-rate-limits) — Twitch 20 msg/30s rate limit documentation
- [Twitch Developer Forums — Rate Limit Clarification](https://discuss.dev.twitch.com/t/rate-limit-clarification/40367) — moderator 100 msg/30s limit
- npm search: `satori` 0.18.3, `@resvg/resvg-js` 2.6.2 — latest versions at research time
- [GitHub: n-e-r-u/BlindTest](https://github.com/n-e-r-u/BlindTest) — competitor feature reference
- [GitHub: cleartonic/twitchtriviabot](https://github.com/cleartonic/twitchtriviabot) — scoring/command patterns

### Tertiary (LOW confidence)
- Twitch bot ban duration (30 min vs 1 hour) — inconsistent across community sources; treat as "at least 30 minutes, possibly longer"

---
*Research completed: 2026-03-17*
*Ready for roadmap: yes*
