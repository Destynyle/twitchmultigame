---
storyId: '1.4'
title: 'Account Deletion with Grace Period'
epicId: '1'
status: 'in-progress'
---

# Story 1.4: Account Deletion with Grace Period

Status: done

## Story

As a streamer,
I want to permanently delete my account with a confirmation step,
so that I can exercise my GDPR right to data erasure at any time.

## Acceptance Criteria

1. **Given** an authenticated streamer on the Settings page
   **When** they click "Delete my account" and type a confirmation phrase
   **Then** their account is soft-deleted (`deleted_at = NOW()`), their session is destroyed, and they are redirected to the landing page
2. **Given** a soft-deleted tenant account
   **When** 30 calendar days have elapsed since `deleted_at`
   **Then** a scheduled job permanently deletes all associated rows across `tenants`, `users`, `oauth_tokens`, and all other tenant-scoped tables for that `tenant_id`
3. **Given** a streamer whose account is in the 30-day grace period
   **When** they attempt to sign in again with the same Twitch account
   **Then** they are shown a page informing them of the pending deletion with an option to reactivate before the deadline
4. **Given** a reactivation request during the grace period
   **When** the streamer confirms reactivation
   **Then** `deleted_at` is set back to `NULL` and all features are restored

## Tasks / Subtasks

- [x] Task 1: Add soft-delete support to database schema (AC: 1, 4)
  - [x] Add `deletedAt` timestamp column to `tenants` and `users` tables in `packages/db/src/schema/`.
  - [x] Update Drizzle queries/RLS policies to ignore soft-deleted tenants for normal operations.
  - [x] Generate and apply database migration (migrations 0003, 0004).
- [x] Task 2: Implement tRPC endpoints for account deletion and reactivation (AC: 1, 4)
  - [x] Add `deleteAccount` procedure in `tenant.router.ts` that sets `deletedAt = NOW()`.
  - [x] Add `reactivateAccount` procedure in `tenant.router.ts` that sets `deletedAt` to `null`.
- [x] Task 3: Build Settings UI for account deletion (AC: 1)
  - [x] Add `DeleteAccountForm` component to `apps/web/src/app/(dashboard)/settings/components/`.
  - [x] Requires typing "DELETE" to confirm; disabled until matched.
  - [x] Server action `deleteAccountAction` calls `signOut` and redirects to `/`.
- [x] Task 4: Handle sign-in flow for soft-deleted accounts (AC: 3, 4)
  - [x] Update `auth.ts` signIn callback: if tenant has `deletedAt !== null`, return `/auth/reactivate` redirect URL.
  - [x] Create `apps/web/src/app/(auth)/reactivate/page.tsx` — grace period notice + reactivate button.
  - [x] Server action `reactivateAccountAction` sets `deletedAt = null` and redirects to dashboard.
- [x] Task 5: Implement permanent deletion Cron Job (AC: 2)
  - [x] Created `POST /api/v1/cron/process-deletions` route in `apps/web`.
  - [x] Secured with `Authorization: Bearer CRON_SECRET` header.
  - [x] Deletes tenants where `deletedAt < NOW() - 30 days`; FK CASCADE handles related rows.
  - [x] Added `CRON_SECRET` to `packages/shared/src/env.ts` validation.

## Dev Notes

- **Architecture Patterns**: 
  - Soft-delete pattern (`deleted_at`) is a PRD requirement for GDPR compliance.
  - The permanent deletion job should be triggered via an authenticated API route designated for cron execution (a common pattern for Next.js apps deployed on Railway/Vercel).
- **Security**: 
  - Do NOT permanently delete data immediately on user request. It MUST be soft-deleted first.
  - Ensure the `/api/v1/cron/process-deletions` endpoint is strictly gated and cannot be triggered by public users.
- **Testing Standards**: 
  - Verify that soft-deleted accounts cannot access the dashboard or API routes (middleware/RLS should reject them).
  - Verify the 30-day logic carefully in tests (mocking dates).

### Project Structure Notes

- Database schema logic belongs in `packages/db`. Make sure to enable cascading deletes at the DB level where appropriate to avoid orphaned rows during permanent deletion.
- Dashboard API logic is isolated in `apps/web/src/server/api/routers/tenant.router.ts`.
- The user-facing public auth pages are under `apps/web/src/app/(public)/auth/`.

### References

- [Source: _bmad-output/planning-artifacts/prd.md#GDPR (EU)] - 30-day soft delete compliance
- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.4: Account Deletion with Grace Period]

## Dev Agent Record

### Agent Model Used

Antigravity

### Debug Log References

N/A

### Completion Notes List

- Task 1: `users.deletedAt` added (migration 0003), users RLS updated (migration 0004); `tenants.deletedAt` already present from Story 1.2
- Task 1: Schema also adds `unique('users_tenant_twitch_unique')` and `unique('oauth_tokens_tenant_provider_unique')` (post-limit fixes from review 1.2)
- Task 2: tRPC procedures use `db` directly (bypass RLS) — same pattern as provisioning in auth.ts
- Task 3: Server Action `deleteAccountAction` in `(dashboard)/settings/actions.ts` calls `signOut({ redirect: false })` then `redirect('/')`
- Task 4: Auth.js v5 `signIn` callback returns string URL `/auth/reactivate` for grace-period accounts — user IS signed in but redirected away from dashboard
- Task 4: Reactivate page placed in `(auth)` route group for consistency with signin/error pages
- Task 5: `CRON_SECRET` added to `packages/shared/src/env.ts` Zod schema — validates at startup
- All 34 tests pass (14 web, 18 db, 1 bot-worker, 1 game-engine); all 7 packages type-check clean

### File List

- `apps/web/server/auth.ts` — updated: soft-deleted tenant redirect to `/auth/reactivate` in signIn callback
- `apps/web/server/api/routers/tenant.router.ts` — updated: added `deleteAccount` and `reactivateAccount` procedures
- `apps/web/src/app/(dashboard)/settings/page.tsx` — updated: added Danger Zone section with DeleteAccountForm
- `apps/web/src/app/(dashboard)/settings/components/DeleteAccountForm.tsx` — created: client component with DELETE confirmation input
- `apps/web/src/app/(dashboard)/settings/actions.ts` — created: `deleteAccountAction` server action
- `apps/web/src/app/(auth)/reactivate/page.tsx` — created: grace period notice + reactivation button
- `apps/web/src/app/(auth)/reactivate/actions.ts` — created: `reactivateAccountAction` server action
- `apps/web/src/app/api/v1/cron/process-deletions/route.ts` — created: cron endpoint with CRON_SECRET auth
- `packages/shared/src/env.ts` — updated: added `CRON_SECRET` validation
- `.env.example` — updated: added `CRON_SECRET` placeholder
- `apps/web/src/smoke.test.ts` — updated: 6 new tests for Story 1.4
