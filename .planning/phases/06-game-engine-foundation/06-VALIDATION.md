---
phase: 6
slug: game-engine-foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-17
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest ^2.1.8 |
| **Config file** | `packages/game-engine/vitest.config.ts` |
| **Quick run command** | `cd packages/game-engine && npx vitest run` |
| **Full suite command** | `npx turbo test --filter=@playground/game-engine` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd packages/game-engine && npx vitest run`
- **After every plan wave:** Run `npx turbo test --filter=@playground/game-engine`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** ~5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 06-01-01 | 01 | 0 | GAME-01–05, 07–08 | unit stubs | `cd packages/game-engine && npx vitest run` | ❌ Wave 0 | ⬜ pending |
| 06-02-01 | 02 | 1 | GAME-01 | unit | `cd packages/game-engine && npx vitest run` | ❌ Wave 0 | ⬜ pending |
| 06-02-02 | 02 | 1 | GAME-02 | unit | `cd packages/game-engine && npx vitest run` | ❌ Wave 0 | ⬜ pending |
| 06-02-03 | 02 | 1 | GAME-03 | unit | `cd packages/game-engine && npx vitest run` | ❌ Wave 0 | ⬜ pending |
| 06-02-04 | 02 | 1 | GAME-04 | unit | `cd packages/game-engine && npx vitest run` | ❌ Wave 0 | ⬜ pending |
| 06-02-05 | 02 | 1 | GAME-05 | unit | `cd packages/game-engine && npx vitest run` | ❌ Wave 0 | ⬜ pending |
| 06-02-06 | 02 | 1 | GAME-07 | unit | `cd packages/game-engine && npx vitest run` | ❌ Wave 0 | ⬜ pending |
| 06-02-07 | 02 | 1 | GAME-08 | unit | `cd packages/game-engine && npx vitest run` | ❌ Wave 0 | ⬜ pending |
| 06-03-01 | 03 | 2 | GAME-06 | manual | See manual verifications below | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `packages/game-engine/src/scorer.test.ts` — extend existing file with test stubs for all v2 mechanics:
  - `describe('timing window', ...)` — GAME-01: first=3pts, in-window decay, post-window ignored
  - `describe('streak multiplier', ...)` — GAME-02: +0.1x per round, no cap, resets on miss/absence/malus/double-shot-fail
  - `describe('malus trap terms', ...)` — GAME-03: escalating -1/-2/-3, fuzzy detection, malus wins over correct answer
  - `describe('double-shot v2', ...)` — GAME-04: both correct = (pts+pts)×2, one correct = 0
  - `describe('featurings', ...)` — GAME-05: 1pt instant, independent per featuring
  - `describe('shuffle', ...)` — GAME-07: Fisher-Yates, non-repetitive

*Existing test infrastructure in `packages/game-engine/vitest.config.ts` is sufficient — no new framework needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Concurrent guesses produce no lost increments | GAME-06 | Requires live PostgreSQL with UNIQUE constraint + two simultaneous INSERT ON CONFLICT writes | 1. Start a session. 2. Fire two concurrent scoring events for the same viewer in the same round. 3. Confirm final score = sum of both, not just one. 4. Inspect DB: `SELECT score FROM session_scores WHERE viewer_username='test'` shows expected total. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
