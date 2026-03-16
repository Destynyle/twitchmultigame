# Stack Research

**Domain:** Twitch Blindtest SaaS — Milestone v2 Gameplay Engine Additions
**Researched:** 2026-03-17
**Confidence:** HIGH (existing codebase audited directly; new libraries verified via npm/WebSearch)

---

## Context: What Already Exists (Do Not Re-Add)

The following are confirmed present and functional — milestone research covers only NEW additions:

| Already in place | Location |
|-----------------|----------|
| Next.js 15 App Router | `apps/web` |
| Drizzle ORM + PostgreSQL RLS | `packages/db` |
| Redis pub/sub (ioredis 5.4.2) | `apps/web`, `apps/bot-worker` |
| tmi.js 1.8.5 + TwitchChatConnection | `apps/bot-worker` |
| `packages/game-engine` (Levenshtein fuzzy, BlindtestPlugin) | `packages/game-engine` |
| Overlay SSE at `/api/overlay/[token]` | `apps/web` |
| Tailwind CSS v4 | `apps/web` |
| Vitest 2.1.8 | all packages |

---

## Recommended Stack — New Additions Only

### 1. Fuzzy String Matching

**Verdict: No new library needed. Existing Levenshtein in `fuzzy-matcher.ts` is sufficient for v2.**

The current implementation uses a tolerance-ratio Levenshtein (30%) plus substring inclusion. The PROJECT.md mentions Sørensen-Dice as a design option, but:

- The existing `fuzzyMatch()` already passes all tests for French-accent tolerance, typo handling, and short-string exact-match protection.
- Dice-coefficient (`dice-coefficient` npm package, v3.0.0, ESM-only) would require adding an ESM dependency into a CJS bot-worker package, creating a module-system conflict.
- The game engine is `"type": "module"` (ESM), so `dice-coefficient` could technically be added to `packages/game-engine` without conflict, but brings no meaningful improvement over the tested Levenshtein approach for this domain.

**Decision:** Extend the existing normalizer for title cleanup (strip `(feat. ...)`, `[Live]`, `- Remix` annotations) using regex in `normalizer.ts`. Zero new dependencies.

If Dice-coefficient is later preferred: use `dice-coefficient` ^3.0.0 in `packages/game-engine` only. Do not add to bot-worker directly.

### 2. Scoring / Timer Logic (Streak, Malus, Double-Shot, Scoring Window)

**Verdict: No new library needed. Pure TypeScript in `packages/game-engine`.**

All scoring logic — streak multiplier, malus trap detection, double-shot bonus, 3-second scoring window — is pure stateful logic that belongs in `BlindtestPlugin` or a companion `ScoringEngine` class. Requirements:

- Streak state: a `Map<viewerUsername, streakCount>` that persists across rounds within a session.
- Scoring window: `setTimeout` / `Date.now()` delta; the bot-worker already runs in a long-lived Node.js process, so timers work correctly.
- Malus terms: passed in as configuration to `setCurrentTrack()` alongside title and artist.

The `ScoringEvent` type in `packages/game-types` needs new fields (`streak`, `malus`, `doubleShot: boolean`). Extend the interface there.

No external timing or state-machine library is needed. Complexity is low enough that custom code is more maintainable than a dependency.

### 3. Three-Zone Overlay (Separate URL Paths)

**Verdict: No new library. Next.js App Router route segments.**

The existing SSE endpoint at `/api/overlay/[token]/route.ts` publishes a single unified stream. For 3 independent OBS browser sources, use **query parameters** on the same SSE endpoint:

```
/api/overlay/[token]?zone=player
/api/overlay/[token]?zone=feed
/api/overlay/[token]?zone=leaderboard
```

Each zone connects to the same SSE stream but the client-side React component filters which events it renders. This approach:

- Requires zero new routing infrastructure.
- Preserves the existing public-URL, no-auth contract.
- Lets OBS crop each browser source independently by loading different zone URLs.

Alternative (separate route paths like `/api/overlay/[token]/player`) would work equally well but adds route files without benefit. Query parameter approach is simpler.

**Overlay zone components** are standard React + Tailwind CSS — no new UI library needed.

### 4. Bot Sending Automatic Twitch Messages

**Verdict: No new library. `IChatConnection.sendMessage()` already exists and is wired.**

Audit of `TwitchChatConnection.ts` confirms `sendMessage(channel, message)` calls `client.say(channel, message)` using the existing authenticated tmi.js client. The `IChatConnection` interface exposes this method. `BotSession` just needs to call `this.connection.sendMessage(twitchLogin, message)` on scoring events.

Required scope `chat:edit` is already in the Twitch OAuth config (confirmed in PROJECT.md constraints).

**Pattern for bot auto-messages in `BotSession`:**

- On `correct_answer` / `correct_title` / `correct_artist`: send congratulation message.
- On `malus` trigger: send malus notification.
- On streak milestone: send streak announcement.
- On `!score`, `!streak`, `!rank`, `!rules` commands: parse in `handleChatMessage`, call `sendMessage` with response.

Chat command parsing uses simple string prefix matching (`text.trim().startsWith('!')`). No command-framework library needed.

**Rate limiting:** Twitch enforces 20 messages/30s for normal bots, 100/30s for moderators. Bot auto-messages should be debounced — a simple counter with a rolling window is sufficient. Do not add a rate-limiter library.

### 5. Score Export (JSON, CSV, Image)

**New dependencies needed here.**

#### JSON export
No library needed. `JSON.stringify(scores, null, 2)` from a Next.js API route returning `Content-Disposition: attachment`.

#### CSV export — `papaparse`

| Library | Version | Why |
|---------|---------|-----|
| `papaparse` | ^5.4.1 | `Papa.unparse(rows)` converts array-of-objects to CSV string server-side; no dependencies; TypeScript types via `@types/papaparse`; works in both Node.js and browser |

Install in `apps/web` only (export endpoint lives there).

```bash
# apps/web
npm install papaparse
npm install -D @types/papaparse
```

#### Image export — `satori` + `@resvg/resvg-js`

Score image (a shareable PNG leaderboard card) requires SVG-to-PNG generation in a Next.js API route.

| Library | Version | Why |
|---------|---------|-----|
| `satori` | ^0.18.3 | Converts JSX to SVG; works in Node.js runtime; actively maintained by Vercel; the same engine behind `next/og`; no Chromium/headless browser needed |
| `@resvg/resvg-js` | ^2.6.2 | Rust-native SVG-to-PNG via napi-rs; fastest option for Node.js; used alongside satori in standard pattern |

Install in `apps/web` only.

```bash
# apps/web
npm install satori @resvg/resvg-js
```

**IMPORTANT:** The export API route must use `export const runtime = 'nodejs'` — satori's Node.js path requires it; the Edge runtime is not compatible with `@resvg/resvg-js`.

**Font requirement:** Satori requires font data as `ArrayBuffer` or `Buffer`. Bundle a web-safe font (e.g. Inter) as a static file in `public/fonts/` and load it via `fs.readFileSync` in the route handler.

---

## Supporting Libraries Summary

| Library | Version | Package | Purpose |
|---------|---------|---------|---------|
| `papaparse` | ^5.4.1 | `apps/web` | CSV generation for score export |
| `@types/papaparse` | ^5.3.x | `apps/web` (dev) | TypeScript types for papaparse |
| `satori` | ^0.18.3 | `apps/web` | JSX-to-SVG for score image generation |
| `@resvg/resvg-js` | ^2.6.2 | `apps/web` | SVG-to-PNG (Rust native, Node.js runtime only) |

**Total new dependencies: 3 runtime + 1 dev-only.**

---

## Installation

```bash
# From apps/web directory
npm install papaparse satori @resvg/resvg-js
npm install -D @types/papaparse
```

No changes needed to `apps/bot-worker` or `packages/game-engine` package.json.

---

## Alternatives Considered

| Recommended | Alternative | Why Not |
|-------------|-------------|---------|
| Levenshtein (existing) | `dice-coefficient` npm | Module system mismatch (ESM-only in CJS bot-worker); existing implementation passes all tests; no user-visible improvement |
| Query param zone filter | Separate route paths per zone | More route files for equivalent functionality; no URL clarity benefit |
| `papaparse` | Manual CSV string building | papaparse handles escaping, quoted fields, special characters correctly; negligible size cost |
| `satori` + `@resvg/resvg-js` | `puppeteer` / `playwright` (headless Chrome) | 50MB+ binary; slow cold start; incompatible with Render free tier memory; overkill for a leaderboard card |
| `satori` + `@resvg/resvg-js` | `sharp` alone | sharp cannot render arbitrary HTML/CSS layouts; requires pre-built SVG or image compositing instead of JSX templates |
| `tmi.js client.say()` (existing) | Twitch EventSub API | EventSub is for receiving events, not sending messages; IRC/tmi.js is the correct channel for bot outgoing messages |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `puppeteer` / `playwright` | 50MB+ headless Chrome; slow cold start on Render; not serverless-friendly | `satori` + `@resvg/resvg-js` |
| `canvas` (npm) | Requires native build (libcairo); unreliable on Render's build environment; layout primitives are low-level | `satori` JSX templates |
| State-machine libraries (XState) | Streak/window logic is simple enough; adds significant bundle and learning cost | Plain TypeScript class state in `packages/game-engine` |
| `commander` / `yargs` for chat commands | Bot runs in-process, not as a CLI; chat commands are simple prefix strings | `text.startsWith('!')` with a switch statement |
| `@vercel/og` | Wraps satori with Vercel-specific assumptions; requires Edge runtime or Vercel deployment | `satori` directly (Node.js runtime, works on Render) |

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|----------------|-------|
| `satori` ^0.18.3 | Node.js >= 16, React 18/19 JSX | Must use `runtime = 'nodejs'` in Next.js route — NOT Edge |
| `@resvg/resvg-js` ^2.6.2 | Node.js >= 14, Linux x64/arm64 | Includes prebuilt Rust binary for linux-x64-gnu — matches Render's environment |
| `papaparse` ^5.4.1 | Node.js >= 10, all browsers | No peer deps; TypeScript via `@types/papaparse` |
| `tmi.js` 1.8.5 (existing) | `sendMessage()` wired via `IChatConnection` | Already supports bot outbound messages; no upgrade needed |

---

## Stack Patterns by Variant

**For the scoring window (3-second first-finder grace period):**
- Use `Date.now()` timestamps stored in round state, not `setTimeout` callbacks
- Because setTimeout firing order across async message handlers is unreliable; timestamp comparison is deterministic and testable

**For bot chat commands (`!score`, `!rank`, `!streak`, `!rules`):**
- Parse in `BotSession.handleChatMessage()` before passing to the plugin
- Because commands are meta-gameplay (query state) not scoring; plugin stays pure scoring logic

**For overlay zones:**
- Pass `zone` query param from the browser source URL; filter events client-side in the React component
- Because server-side filtering would require 3 separate Redis subscriptions per overlay connection; client filtering is free

---

## Sources

- Direct code audit: `apps/bot-worker/src/connections/TwitchChatConnection.ts` — `sendMessage()` confirmed wired to `client.say()`
- Direct code audit: `packages/game-engine/src/fuzzy-matcher.ts` — Levenshtein implementation confirmed functional
- Direct code audit: `packages/game-engine/src/blindtest-plugin.ts` — scoring state confirmed in-memory, no external deps
- WebSearch: tmi.js `client.say()` requires `chat:edit` scope — MEDIUM confidence (official Twitch docs confirm scope requirement)
- WebSearch: `satori` 0.18.3 latest version — MEDIUM confidence (npm search result)
- WebSearch: `@resvg/resvg-js` 2.6.2 latest version — MEDIUM confidence (npm search result, last published ~2 years ago but stable)
- WebSearch: `papaparse` CSV unparse for Node.js — HIGH confidence (official papaparse docs + multiple sources agree)
- WebSearch: satori requires `runtime = 'nodejs'` in Next.js (not Edge) — HIGH confidence (multiple sources including Vercel docs)
- [satori GitHub](https://github.com/vercel/satori) — JSX-to-SVG, Node.js compatible
- [resvg-js GitHub](https://github.com/thx/resvg-js) — SVG-to-PNG Rust binding
- [papaparse docs](https://www.papaparse.com/docs) — `Papa.unparse()` for CSV generation
- [tmi.js docs](https://tmijs.com/) — `client.say()` API

---
*Stack research for: Twitch Blindtest SaaS — Milestone v2 Gameplay Engine*
*Researched: 2026-03-17*
