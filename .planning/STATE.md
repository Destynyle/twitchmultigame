# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-17)

**Core value:** The streamer can run an engaging live blindtest on their Twitch stream with zero friction — chat guesses, bot reacts, overlay updates in real time.
**Current focus:** Phase 6 — Game Engine Foundation

## Current Position

Phase: 6 of 12 (Game Engine Foundation)
Plan: 0 of ? in current phase
Status: Ready to plan
Last activity: 2026-03-17 — Roadmap created for v2.0 milestone (phases 6-12)

Progress: [░░░░░░░░░░] 0% (v2.0 — 0/7 phases complete)

## Performance Metrics

**Velocity:**
- Total plans completed: 0 (v2.0)
- Average duration: —
- Total execution time: —

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| — | — | — | — |

*Updated after each plan completion*

## Accumulated Context

### Architecture
- Redis channels: `session:cmd:{sessionId}` (web→bot), `overlay:{tenantId}` (bot→SSE), `sessions:events` (web→bot lifecycle)
- Current migration: 0011_rls_insert_policies.sql — RLS INSERT workaround in place for Render non-superuser
- All Phase 6 DB migrations must follow the 0011 permissive INSERT policy pattern

### Key Decisions
- Fuzzy matching: Sørensen-Dice bigrams, threshold 0.8; exact substring required for targets ≤5 chars
- Double-shot penalty design (lose-all vs. no-penalty) must be confirmed before coding penalty path
- Streak breaks on wrong answer including malus
- 3 overlay zones as separate URL paths, single SSE endpoint with client-side filtering (not separate SSE routes)
- SSE payload versioning: add `version: 2` field + new event types additively, never replace existing shapes

### Pending Todos

None yet.

### Blockers/Concerns

- [Phase 6]: Double-shot penalty design must be confirmed with streamer before coding — product decision
- [Phase 6]: Redis game state persistence key schema for crash recovery needs spec before coding
- [Phase 8]: Streamers must add bot as moderator for 100 msg/30s budget — needs UX surface in dashboard

## Session Continuity

Last session: 2026-03-17
Stopped at: Roadmap written — ready to plan Phase 6
Resume file: None
