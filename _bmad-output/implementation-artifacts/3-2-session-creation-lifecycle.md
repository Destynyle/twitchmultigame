---
story: 3.2
title: Session Creation & Lifecycle Management
status: done
date: 2026-03-08
---

# Story 3.2: Session Creation & Lifecycle Management

## Status: Done

## What was implemented

### tRPC Session Router
`apps/web/server/api/routers/session.router.ts`

All lifecycle procedures:
- `list` — fetch all sessions for the tenant, newest first
- `getById` — fetch single session by UUID
- `create` — insert a new session with `status: 'pending'`
- `launch` — transition `pending` → `active`, sets `startedAt`
- `pause` — transition `active` → `paused`
- `resume` — transition `paused` → `active`
- `end` — transition any status → `ended`, sets `endedAt`
- `nextTrack` — increment `currentTrackIndex`

### Root Router Update
`apps/web/server/api/root.ts` — `sessionRouter` registered as `session:`

### Server Actions
`apps/web/src/app/(dashboard)/sessions/actions.ts`
- `createSessionAction(formData)` — creates session in pending state
- `updateSessionStatusAction(sessionId, action)` — handles launch/pause/resume/end transitions

### UI Components
- `sessions/page.tsx` — server component, fetches sessions and playlists, renders `SessionsClient`
- `sessions/components/SessionsClient.tsx` — client component, session list with status badges, new session button, selection
- `sessions/components/NewSessionForm.tsx` — client form for game type, playlist selection, test mode toggle
- `sessions/components/SessionControlPanel.tsx` — lifecycle control buttons (Launch/Pause/Resume/End) appropriate to current status, shows track index

### Tests
Appended to `apps/web/src/smoke.test.ts` — Story 3.2 describe block with 4 tests.

## Acceptance Criteria Verification

| AC | Description | Status |
|----|-------------|--------|
| 1 | New Session → pending | Done |
| 2 | Launch → active, startedAt set | Done |
| 3 | Pause → paused | Done |
| 4 | Resume → active | Done |
| 5 | End → ended, endedAt set | Done |
| 6 | Control view shows status and track index | Done |

## Notes

- Bot-worker integration deferred to Story 3.7 per MVP simplification
- Session state managed purely via DB status updates (no Redis/job queue)
- Page reloads used for state refresh (optimistic updates deferred to later story)
