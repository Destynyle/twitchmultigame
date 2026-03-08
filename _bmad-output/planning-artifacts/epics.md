---
stepsCompleted: ['step-01-validate-prerequisites', 'step-02-design-epics', 'step-03-create-stories', 'step-04-final-validation']
status: 'complete'
completedAt: '2026-03-07'
inputDocuments:
  - '_bmad-output/planning-artifacts/prd.md'
  - '_bmad-output/planning-artifacts/architecture.md'
---

# Playground - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for Playground, decomposing the requirements from the PRD and Architecture into implementable stories.

## Requirements Inventory

### Functional Requirements

FR1: Streamer can authenticate to the platform using their Twitch account without manual configuration
FR2: Streamer can connect a Spotify account to import playlists and enable in-app audio playback
FR3: Streamer can connect a YouTube account to import playlists and enable in-app video/audio playback
FR4: Streamer can disconnect and reconnect audio platform accounts independently from their Twitch session
FR5: Viewer can create a profile (no password required — Twitch identity only) by opting in directly from a stream overlay
FR6: Platform automatically provisions an isolated tenant namespace for each new streamer on first login
FR7: Streamer can permanently delete their account with a 30-day grace period before data removal
FR8: Viewer can request erasure of their profile and participation history
FR9: Streamer can create custom playlists by manually entering song or question metadata
FR10: Streamer can import playlists directly from their connected Spotify or YouTube account
FR11: Streamer can organize, edit, rename, and delete their custom playlists
FR12: Streamer can export their playlists at any time in a portable format
FR13: Any user can report playlist or quiz content for platform moderation review
FR14: Streamer can create a game session by selecting a game type and an associated playlist or question set
FR15: Streamer can launch, pause, resume, and end a game session from the dashboard
FR16: Streamer can control session flow entirely using rebindable keyboard shortcuts without a mouse
FR17: Streamer can run a private test session without streaming live on Twitch
FR18: Streamer can import a previously exported score file to resume cumulative scoring from a prior session
FR19: Streamer can export session scores at any time, with an automatic prompt presented at session end
FR20: System maintains a separate, independent score table per game type within a single session
FR21: Streamer can view a real-time event log of bot status, reconnection events, and session alerts in the dashboard
FR22: System validates viewer answers submitted via Twitch chat against the active challenge in real-time
FR23: System awards progressive points to the first correct respondent and to subsequent correct respondents within a configurable time window
FR24: System supports the Blindtest game type: streamer controls audio revelation; viewers answer the song title or artist in chat
FR25: System supports the Quiz game type: streamer presents questions; viewers submit text answers in chat
FR26: Bot automatically reconnects to Twitch IRC following a connection drop, without session data loss
FR27: System queues chat messages received during a reconnection window and processes them in order upon recovery
FR28: System supports adding new game types through a defined plugin contract without modifying core game engine logic
FR29: Streamer can play audio tracks in-app from connected Spotify playlists during a session (Spotify Premium account required)
FR30: Streamer can play audio and video content in-app from connected YouTube playlists during a session
FR31: Streamer can embed external video content by link (YouTube, Twitch Clips) for use in movie or clip guessing games
FR32: System displays a clear notice and alternative path when Spotify Premium is required but not detected
FR33: System displays a clear fallback message when a linked video is unavailable or access-restricted
FR34: Streamer can access a unique, persistent overlay URL for use as an OBS browser source
FR35: Overlay displays real-time game state updates to stream viewers within 300ms p95 of a server scoring event
FR36: Overlay displays the answering viewer's identity and score with visual feedback upon a correct answer
FR37: Overlay displays the current session leaderboard state during and after an active game round
FR38: Streamer can preview the overlay appearance from within the dashboard before going live
FR39: Overlay includes a visible call-to-action for viewers to create their own streamer account
FR40: Streamer can select an overlay theme from a set of available visual options
FR41: System maintains a real-time intra-community leaderboard per game type per session
FR42: Viewer can see their current rank and accumulated score during an active session via the overlay
FR43: Streamer can view the full score table for all game types in the current session from the dashboard
FR44: System prompts the streamer to export session scores at session end (CSV and JSON formats)
FR45: Viewer can access a public profile page displaying their participation history, scores, and earned badges
FR46: Viewer profile is accessible via a shareable direct URL usable outside the platform
FR47: Viewer can access cross-session statistics on their own profile
FR48: Platform automatically pre-populates the streamer onboarding flow with data from the viewer's existing profile upon conversion
FR49: Streamer can subscribe to a paid tier through an in-platform payment flow
FR50: Platform enforces feature access limits based on the streamer's active subscription tier
FR51: Streamer can upgrade, downgrade, or cancel their subscription at any time
FR52: Platform automatically updates access permissions within 60 seconds following a subscription status change event
FR53: Streamer retains access to paid features during a grace period following a payment failure before downgrade
FR54: Platform admin can curate, edit, and schedule the weekly official playlist
FR55: Platform admin can monitor active sessions, bot connection states, and platform health indicators in real-time
FR56: Platform admin can perform remote session interventions (e.g. force token refresh, resolve overlay delivery issues)
FR57: Platform admin can place streamer or viewer accounts in quarantine pending investigation
FR58: Platform admin can review flagged content submissions and apply moderation actions
FR59: Platform admin can access an immutable audit log of all administrative actions

### NonFunctional Requirements

NFR-P1: Overlay receives game state updates within 300ms p95 of a scoring event on the server
NFR-P2: Bot processes incoming chat messages within 100ms p95 under normal load (up to 10,000 messages/minute per session)
NFR-P3: Bot reconnects to the active streaming platform chat connection within 5 seconds of a connection drop, with zero manual intervention required
NFR-P4: Streamer dashboard reflects session state changes within 500ms of a server event
NFR-P5: Score export for sessions with up to 500 participants generates and downloads within 3 seconds
NFR-P6: Playlist import from Spotify or YouTube (up to 200 tracks) completes within 10 seconds
NFR-S1: All OAuth tokens (Twitch, Spotify, YouTube) are encrypted at rest and never exposed to frontend clients or included in logs
NFR-S2: All score calculation and answer validation occurs exclusively server-side; no scoring data is accepted from client inputs
NFR-S3: Multi-tenant data isolation is enforced at the database layer independently of application-layer logic
NFR-S4: All platform communications are transmitted over encrypted transport; no unencrypted channel is accepted for any API surface
NFR-S5: OAuth tokens are automatically rotated before expiry; no user session is interrupted by token expiry
NFR-S6: Payment processing is fully delegated to the payment provider; no card data transits or is stored on platform servers
NFR-S7: All platform admin actions are recorded in an immutable audit log (actor, action, timestamp, affected resource)
NFR-SC1: Platform supports at least 50,000 concurrent viewers distributed across all active sessions without overlay latency exceeding 300ms p95
NFR-SC2: Chat message processing sustains 10,000 messages per minute per active session without message processing latency exceeding 100ms p95
NFR-SC3: Bot worker processes are horizontally scalable; a single high-load session has zero measurable impact on other sessions
NFR-SC4: Platform sustains peak traffic windows (18h-24h CET) at 3x baseline load without breaching SLA targets
NFR-SC5: One tenant's session failure or resource spike has zero measurable impact on other tenants' active sessions
NFR-R1: Platform maintains 99.5% availability during peak streaming windows (18h-24h CET)
NFR-R2: No session score data is lost on bot process crash; session state in the persistence layer survives independently of any individual process
NFR-R3: Chat messages received during a bot reconnection window are queued and processed in arrival order upon recovery
NFR-R4: Scheduled maintenance windows are restricted to 03h-07h CET to minimize streamer impact
NFR-R5: Incidents exceeding 5 minutes trigger automated notifications; a public status page is maintained at all times
NFR-A1: Overlay UI maintains WCAG 2.1 AA minimum color contrast ratios for readability during live streams
NFR-A2: Streamer dashboard supports complete keyboard navigation without a mouse
NFR-A3: (V2 target) All public-facing surfaces achieve WCAG 2.1 AA compliance
NFR-I1: StreamingProvider abstraction ensures all Twitch-specific logic is isolated to a single adapter
NFR-I2: AudioProvider abstraction ensures all Spotify- and YouTube-specific logic is isolated to individual adapters
NFR-I3: Platform handles streaming platform chat rate limits (800 messages per 30 seconds per connection) transparently without session interruption
NFR-I4: Platform handles YouTube ContentID-blocked video failures gracefully with a user-facing fallback message and no session crash
NFR-I5: Subscription status changes from payment provider webhooks are reflected in platform feature access within 60 seconds of webhook receipt
NFR-I6: OBS overlay browser source functions correctly with zero configuration beyond pasting the provided overlay URL

### Additional Requirements

- Starter template: `pnpm dlx create-turbo@latest` — Turborepo 2.8.13 monorepo (Epic 1, Story 1)
- Monorepo structure: `apps/web` (Next.js 15 App Router) + `apps/bot-worker` (Node.js stateless) + `packages/db` + `packages/game-types` + `packages/game-engine` + `packages/shared`
- Docker multi-stage builds for Railway deployment (two separate Railway services)
- `docker-compose.yml` for local dev (PostgreSQL + Redis with AOF persistence)
- GitHub Actions CI/CD: PR branch → type-check + test; main → test + build + Railway deploy
- Vitest as test runner across all apps and packages (native ESM, Turborepo-compatible)
- Pino structured logging (JSON output, Railway stdout-compatible)
- Drizzle migrations via `pnpm db:migrate` — explicit only, never auto-migrate
- Zod env schema validation at process startup — process crashes on missing required vars
- Turbo pipeline task order: db packages must build before apps; test depends on build
- AES-256-GCM encryption for OAuth tokens (TOKEN_ENCRYPTION_KEY 64-char hex)
- HMAC-SHA256 webhook verification middleware (Stripe + Twitch EventSub)
- Upstash Rate Limit: 60 req/min public API, 300 req/min dashboard API, excluded for webhooks
- tRPC v11 for dashboard API (type-safe); REST for public/webhooks/overlay
- Auth.js v5 Twitch OAuth: JWT payload `{ tenantId, role, subscriptionStatus, exp }`
- Redis channel naming: `game:{tenantId}:{sessionId}:state-update`; bot-worker uses `PSUBSCRIBE game:{tenantId}:*`
- `IChatConnection` interface with `MockChatConnection` test double for bot-worker unit tests
- Testcontainers for bot-worker integration tests (real Redis container)
- Session join codes: `nanoid(6)` with alphabet `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (no ambiguous chars)
- Admin panel `refetchInterval: 5000`; active leaderboard `refetchInterval: 1000`; dashboard default `refetchInterval: 3000`

### FR Coverage Map

FR1: Epic 1 - Twitch OAuth onboarding
FR6: Epic 1 - Auto-provisionnement tenant
FR7: Epic 1 - Suppression compte streamer (grace period)
FR2: Epic 2 - OAuth Spotify
FR3: Epic 2 - OAuth YouTube
FR4: Epic 2 - Déconnexion/reconnexion audio indépendante
FR9: Epic 2 - Création playlists manuelles
FR10: Epic 2 - Import playlists Spotify/YouTube
FR11: Epic 2 - CRUD playlists
FR12: Epic 2 - Export playlists
FR29: Epic 2 - Lecture audio Spotify in-app (Web Playback SDK)
FR30: Epic 2 - Lecture audio/vidéo YouTube in-app (iframe)
FR31: Epic 2 - Embed vidéo externe (YouTube, Twitch Clips)
FR32: Epic 2 - Notice fallback Spotify Premium absent
FR33: Epic 2 - Fallback vidéo indisponible/bloquée
FR14: Epic 3 - Création session (type + playlist)
FR15: Epic 3 - Lancement/pause/reprise/fin session
FR16: Epic 3 - Hotkeys rebindables (mouse-free)
FR17: Epic 3 - Session de test privé (sans stream live)
FR18: Epic 3 - Import scores (reprise session précédente)
FR19: Epic 3 - Export scores + prompt automatique fin session
FR20: Epic 3 - Table scores séparée par type de jeu
FR21: Epic 3 - Log temps réel bot/session
FR22: Epic 3 - Validation réponses chat temps réel
FR23: Epic 3 - Scoring progressif (premier répondant + fenêtre temps)
FR24: Epic 3 - Jeu Blindtest (révélation audio, réponse titre/artiste)
FR25: Epic 3 - Jeu Quiz (questions streamer, réponses texte)
FR26: Epic 3 - Reconnexion automatique bot IRC sans perte de données
FR27: Epic 3 - File d'attente messages reconnexion (traitement en ordre)
FR28: Epic 3 - Plugin contract (extensibilité sans modifier le core)
FR34: Epic 4 - URL overlay unique et persistante (OBS browser source)
FR35: Epic 4 - Mises à jour overlay <300ms p95 depuis événement serveur
FR36: Epic 4 - Affichage identité viewer + score + feedback visuel
FR37: Epic 4 - Leaderboard session affiché pendant/après chaque round
FR38: Epic 4 - Prévisualisation overlay depuis le dashboard
FR39: Epic 4 - CTA visible viewer → créer compte streamer
FR40: Epic 4 - Sélection thème overlay
FR41: Epic 4 - Leaderboard intra-session temps réel (par type de jeu)
FR42: Epic 4 - Viewer voit rang + score cumulé via overlay
FR43: Epic 4 - Streamer voit table scores complète (dashboard)
FR44: Epic 4 - Prompt export scores fin session (CSV et JSON)
FR5: Epic 5 - Opt-in profil viewer depuis overlay (Twitch identity)
FR8: Epic 5 - Effacement profil viewer (GDPR — 30 jours)
FR13: Epic 5 - Signalement contenu pour modération
FR45: Epic 5 - Profil public viewer (historique, scores, badges)
FR46: Epic 5 - URL publique partageable du profil viewer
FR47: Epic 5 - Statistiques cross-sessions sur profil viewer
FR48: Epic 5 - Pré-population onboarding streamer depuis profil viewer
FR49: Epic 6 - Flux abonnement in-platform (Stripe)
FR50: Epic 6 - Feature gating par tier actif (transversal — préparé Epic 1)
FR51: Epic 6 - Upgrade / downgrade / annulation abonnement
FR52: Epic 6 - Mise à jour accès <60s après webhook subscription
FR53: Epic 6 - Grace period 7 jours après échec paiement
FR54: Epic 7 - Curation, édition, scheduling playlist officielle hebdo
FR55: Epic 7 - Monitoring temps réel (sessions, bots, santé plateforme)
FR56: Epic 7 - Interventions distantes sur sessions actives
FR57: Epic 7 - Mise en quarantaine de comptes
FR58: Epic 7 - Review + actions modération contenu signalé
FR59: Epic 7 - Audit log immuable toutes actions admin

## Epic List

> **Note de planification:** Les epics 1, 2, et 3 constituent le chemin critique vers la première session jouable. Aucune validation terrain n'est possible avant leur complétion. Les epics 4-7 enrichissent la plateforme progressivement.
>
> **Note architecturale (FR50):** Le feature gating est une préoccupation transversale. Le JWT payload `{ tenantId, role, subscriptionStatus }` est mis en place dès Epic 1. Les gates elles-mêmes sont activées en Epic 6.

### Epic 1: Platform Foundation & Streamer Onboarding

Streamers can sign in with Twitch, get an isolated tenant account auto-provisioned, and access their dashboard in under 2 minutes. The platform runs locally and in CI/CD with full multi-tenant database isolation.

**FRs covered:** FR1, FR6, FR7
**Architecture requirements:** Turborepo scaffold, DB schema (all tables + RLS), Auth.js v5 Twitch OAuth, JWT payload with subscriptionStatus, CI/CD GitHub Actions, docker-compose, Zod env, Pino logging

### Epic 2: Playlist & Audio Management

Streamers can connect their music platforms (Spotify and/or YouTube), import or manually create playlists, and have their content ready for game sessions — with clear fallback handling for Premium requirements and unavailable media.

**FRs covered:** FR2, FR3, FR4, FR9, FR10, FR11, FR12, FR29, FR30, FR31, FR32, FR33

### Epic 3: Game Session & Bot Engine

Streamers can launch a complete game session from end to end — bot connects automatically, validates chat answers in real time, scores server-side, reconnects silently in under 5 seconds with zero data loss, and the streamer has full score management (export/import). Blindtest and Quiz are both playable.

**FRs covered:** FR14, FR15, FR16, FR17, FR18, FR19, FR20, FR21, FR22, FR23, FR24, FR25, FR26, FR27, FR28

**Implementation notes:** FR28 (GamePlugin contract) must be Story 1 of this epic — Blindtest and Quiz stories depend on it. Bot-worker integration tests require Testcontainers (real Redis container, not mocks).

### Epic 4: Overlay, Real-Time Display & Leaderboard

Viewers see real-time game state on the OBS overlay within 300ms p95 of a scoring event. The streamer has a full leaderboard view from the dashboard. The overlay CTA for viewer→streamer conversion is live.

**FRs covered:** FR34, FR35, FR36, FR37, FR38, FR39, FR40, FR41, FR42, FR43, FR44

### Epic 5: Viewer Identity & Viral Loop

Viewers have public profiles discoverable from the overlay. The viewer→streamer conversion pipeline is fully operational, with pre-populated onboarding from viewer profile data.

**FRs covered:** FR5, FR8, FR13, FR45, FR46, FR47, FR48

**Implementation notes:** FR47 (cross-session stats) requires session fixture data for testing.

### Epic 6: Subscription & Freemium Gates

Streamers can subscribe to paid tiers; the platform enforces feature access automatically based on active subscription status, with Stripe webhook-driven role updates within 60 seconds.

**FRs covered:** FR49, FR50, FR51, FR52, FR53

**Implementation notes:** FR50 gates are applied retroactively to all features implemented in Epics 2-5. JWT `subscriptionStatus` field prepared in Epic 1 is consumed here.

### Epic 7: Platform Administration & Operations

Platform admins can monitor real-time platform health, manage content moderation, intervene on sessions remotely, and operate the weekly official playlist workflow with full audit trail.

**FRs covered:** FR54, FR55, FR56, FR57, FR58, FR59

---

## Epic 1: Platform Foundation & Streamer Onboarding

Streamers can sign in with Twitch, get an isolated tenant account auto-provisioned, and access their dashboard in under 2 minutes. The platform runs locally and in CI/CD with full multi-tenant database isolation.

### Story 1.1: Monorepo & Project Infrastructure

As a developer,
I want the Turborepo monorepo scaffolded with all apps, packages, CI/CD, and local dev environment configured,
So that the team can build, test, and deploy the platform consistently from day one.

**Acceptance Criteria:**

**Given** a fresh environment with Node.js 20+ and pnpm installed
**When** `pnpm install` is run at the repo root
**Then** all workspaces (`apps/web`, `apps/bot-worker`, `packages/db`, `packages/game-types`, `packages/game-engine`, `packages/shared`) install without errors
**And** `pnpm type-check` passes across all packages

**Given** a `.env.example` with all required variables and a `.env.local` populated from it
**When** `docker-compose up -d && pnpm dev` is run
**Then** the Next.js dev server starts at `localhost:3000` and the bot-worker process starts without crashing

**Given** `packages/shared/src/env.ts` contains a Zod schema for all required env vars
**When** a required env var is missing at process startup
**Then** the process exits immediately with a descriptive error naming the missing variable

**Given** a PR is opened on GitHub
**When** the CI pipeline triggers
**Then** `pnpm type-check` and `pnpm test` pass for all affected packages in the Turborepo pipeline

**Given** `docker-compose.yml` is present at the repo root
**When** `docker-compose up -d` is run
**Then** a PostgreSQL instance (port 5432) and a Redis instance with AOF persistence enabled (port 6379) are both healthy

**Given** the Railway deployment configuration
**When** a commit is pushed to `main` and the deploy pipeline runs
**Then** both `apps/web` and `apps/bot-worker` are deployed as separate Railway services with their respective environment variables set, supporting horizontal scaling for peak load windows (NFR-SC4, NFR-R1)

### Story 1.2: Database Schema & Multi-Tenant Foundation

As a platform operator,
I want the `tenants`, `users`, and `oauth_tokens` tables created with Row-Level Security policies,
So that multi-tenant data isolation is enforced at the database layer independently of application logic.

**Acceptance Criteria:**

**Given** the `packages/db` Drizzle schema is defined
**When** `pnpm db:generate && pnpm db:migrate` is run
**Then** the `tenants`, `users`, and `oauth_tokens` tables are created with `tenant_id UUID NOT NULL` columns and all columns named in `snake_case`

**Given** RLS policies are applied via `pgPolicy` in Drizzle for all tenant-scoped tables
**When** a DB query executes without a tenant context set in the session
**Then** no rows are returned (RLS blocks access by default)

**Given** a valid `tenant_id` is set in the DB session context
**When** a query runs on any tenant-scoped table
**Then** only rows belonging to that `tenant_id` are returned, regardless of application-layer filtering

**Given** `drizzle-kit generate` is run after a schema change
**When** the output migration SQL is inspected
**Then** it contains the expected `CREATE TABLE`, `ALTER TABLE ENABLE ROW LEVEL SECURITY`, and `CREATE POLICY` statements

**Given** a migration is applied with `pnpm db:migrate`
**When** that same migration is run again without schema changes
**Then** the command exits cleanly with "No migrations to run"

**Given** a migration fails mid-apply in production
**When** it is rolled back
**Then** the previous schema state is fully restored with no partial table or policy changes remaining

### Story 1.3: Twitch OAuth Sign-In, Tenant Provisioning & Dashboard Shell

As a streamer,
I want to sign in with my Twitch account and immediately access a functional dashboard,
So that I have an isolated account auto-provisioned and can navigate all platform sections in under 2 minutes.

**Acceptance Criteria:**

**Given** I am on the landing page as an unauthenticated user
**When** I click "Sign in with Twitch" and authorize the application
**Then** I am redirected to `/dashboard` within 10 seconds of authorization

**Given** a streamer signs in for the first time with a new Twitch account
**When** Auth.js v5 processes the OAuth callback
**Then** a new row is created in `tenants` and a corresponding `users` row with `role: 'free'` and `subscriptionStatus: 'free'`
**And** no duplicate tenant is created if the same Twitch account signs in again

**Given** a successful sign-in
**When** the JWT is issued
**Then** the token payload contains `{ tenantId, role, subscriptionStatus, exp }` and is stored in an httpOnly cookie (never in localStorage)

**Given** the Twitch OAuth token received at sign-in
**When** it is stored in the database
**Then** it is encrypted with AES-256-GCM using `TOKEN_ENCRYPTION_KEY` and the plaintext token is never written to any log or response

**Given** an authenticated streamer
**When** they access `/dashboard`
**Then** they see a navigation sidebar with links to: Sessions, Playlists, Overlay Setup, Settings, and their Twitch display name and avatar are visible

**Given** an authenticated streamer
**When** they access any `/dashboard/*` route
**Then** `middleware.ts` allows the request through without redirect

**Given** an unauthenticated user
**When** they access any `/dashboard/*` route
**Then** they are redirected to `/auth/signin` with the original path preserved as a redirect parameter

**Given** the dashboard navigation
**When** a user navigates using the Tab key only
**Then** all navigation links are reachable and visually focused in logical order (NFR-A2)

**Given** a streamer clicks "Sign out"
**When** the action completes
**Then** the Auth.js session is destroyed, the httpOnly cookie is cleared, and they are redirected to the landing page

### Story 1.4: Account Deletion with Grace Period

As a streamer,
I want to permanently delete my account with a confirmation step,
So that I can exercise my GDPR right to data erasure at any time.

**Acceptance Criteria:**

**Given** an authenticated streamer on the Settings page
**When** they click "Delete my account" and type a confirmation phrase
**Then** their account is soft-deleted (`deleted_at = NOW()`), their session is destroyed, and they are redirected to the landing page

**Given** a soft-deleted tenant account
**When** 30 calendar days have elapsed since `deleted_at`
**Then** a scheduled job permanently deletes all associated rows across `tenants`, `users`, `oauth_tokens`, and all other tenant-scoped tables for that `tenant_id`

**Given** a streamer whose account is in the 30-day grace period
**When** they attempt to sign in again with the same Twitch account
**Then** they are shown a page informing them of the pending deletion with an option to reactivate before the deadline

**Given** a reactivation request during the grace period
**When** the streamer confirms reactivation
**Then** `deleted_at` is set back to `NULL` and all features are restored

---

## Epic 2: Playlist & Audio Management

Streamers can connect their music platforms (Spotify and/or YouTube), import or manually create playlists, and have their content ready for game sessions — with clear fallback handling for Premium requirements and unavailable media.

### Story 2.1: Spotify OAuth Connection

As a streamer,
I want to connect my Spotify account to the platform,
So that my Spotify playlists are available for import and in-app playback during game sessions.

**Acceptance Criteria:**

**Given** an authenticated streamer on the Settings page
**When** they click "Connect Spotify" and authorize on Spotify's consent screen
**Then** their Spotify OAuth access token and refresh token are encrypted (AES-256-GCM) and stored in `oauth_tokens`, associated with their `tenant_id`
**And** the Settings page shows "Spotify connected" with their Spotify display name

**Given** a Spotify token that is within 5 minutes of expiry
**When** the platform makes any Spotify API call
**Then** the token is proactively refreshed using the stored refresh token before the request proceeds (NFR-S5)
**And** the new token is stored encrypted, overwriting the previous one

**Given** a streamer whose Spotify token has been revoked on Spotify's side
**When** the platform attempts to use the token
**Then** the streamer is prompted to reconnect their Spotify account with a clear error message

### Story 2.2: YouTube OAuth Connection

As a streamer,
I want to connect my YouTube account to the platform,
So that my YouTube playlists are available for import and in-app video/audio playback.

**Acceptance Criteria:**

**Given** an authenticated streamer on the Settings page
**When** they click "Connect YouTube" and authorize on Google's consent screen
**Then** their YouTube OAuth tokens are encrypted and stored in `oauth_tokens` with `provider: 'youtube'`
**And** the Settings page shows "YouTube connected" with their YouTube channel name

**Given** a YouTube token that is within 5 minutes of expiry
**When** the platform makes any YouTube API call
**Then** the token is proactively refreshed before the request proceeds (NFR-S5)
**And** the new token is stored encrypted, overwriting the previous one

**Given** a streamer who has not connected any audio provider
**When** they view the Settings page
**Then** both "Connect Spotify" and "Connect YouTube" options are visible and neither is required

### Story 2.3: Audio Account Management

As a streamer,
I want to disconnect and reconnect my audio platform accounts independently,
So that I can manage my integrations without affecting my Twitch session or other connected services.

**Acceptance Criteria:**

**Given** a streamer with Spotify connected
**When** they click "Disconnect Spotify" and confirm
**Then** the Spotify OAuth tokens are deleted from `oauth_tokens`
**And** YouTube connection status is unaffected

**Given** a streamer with both Spotify and YouTube connected
**When** they disconnect one provider
**Then** the other provider remains connected and functional

**Given** a streamer who disconnects an audio provider
**When** they later click "Connect [provider]" again
**Then** the OAuth flow restarts cleanly as if it were a first-time connection

### Story 2.4: Playlist & Track Schema + Manual Playlist Creation

As a streamer,
I want to create a custom playlist by manually entering track or question metadata,
So that I can build game content even without a connected audio platform.

**Acceptance Criteria:**

**Given** the `packages/db` schema
**When** `pnpm db:generate && pnpm db:migrate` is run
**Then** `playlists` and `tracks` tables are created with `tenant_id` columns and RLS policies applied

**Given** an authenticated streamer on the Playlists page
**When** they click "New Playlist", enter a name, and add at least one track with title and artist
**Then** the playlist is saved to `playlists` and tracks to `tracks`, both scoped to their `tenant_id`

**Given** a Free tier streamer who already has 3 playlists
**When** they attempt to create a 4th playlist
**Then** they see a clear message indicating the 3-playlist limit with an upgrade prompt

**Given** a Pro tier streamer
**When** they create playlists
**Then** no playlist count limit is enforced

**Given** a track entry form
**When** a streamer submits a track without a title
**Then** a validation error is shown and the track is not saved

### Story 2.5: Playlist Import from Connected Audio Providers

As a streamer,
I want to import playlists directly from my connected Spotify or YouTube account,
So that I don't need to manually enter track metadata I already have.

**Acceptance Criteria:**

**Given** a streamer with Spotify connected
**When** they click "Import from Spotify"
**Then** a list of their Spotify playlists is displayed within 10 seconds (NFR-P6)

**Given** a streamer selects a Spotify playlist with up to 200 tracks
**When** they confirm the import
**Then** the playlist and all tracks (title, artist, duration) are saved to the DB within 10 seconds (NFR-P6)

**Given** a streamer with YouTube connected
**When** they click "Import from YouTube" and select a playlist
**Then** the playlist and tracks (title, video ID) are imported with the same 10-second SLA (NFR-P6)

**Given** a streamer attempts to import when the provider is not connected
**When** they click the import button
**Then** they are redirected to connect that provider first with a clear prompt

**Given** a Free tier streamer with 2 existing playlists
**When** an import would exceed the 3-playlist limit
**Then** the import is rejected with a clear limit message and upgrade prompt

### Story 2.6: Playlist Management — Edit, Rename, Delete & Export

As a streamer,
I want to organize, edit, rename, delete, and export my playlists,
So that I can keep my content library current and portable.

**Acceptance Criteria:**

**Given** a streamer on the Playlists page
**When** they click a playlist and then "Edit"
**Then** they can add, remove, or reorder tracks, and save the changes

**Given** a streamer editing a playlist
**When** they rename it and save
**Then** the new name is reflected immediately in the playlist list

**Given** a streamer on the Playlists page
**When** they click "Delete" on a playlist and confirm
**Then** the playlist and all its tracks are permanently deleted from the DB

**Given** a streamer on any playlist
**When** they click "Export Playlist"
**Then** a JSON file is downloaded containing the playlist name, all track titles, artists, and metadata

**Given** a playlist seeded with 500 tracks in the test database
**When** the export is triggered in an integration test
**Then** the export file is generated in under 3 seconds (NFR-P5 validation)

### Story 2.7: Spotify In-App Audio Playback

As a streamer,
I want to play audio tracks from my Spotify playlists in-app during a game session,
So that the audio plays in my browser without switching applications.

**Acceptance Criteria:**

**Given** a streamer with Spotify Premium connected and a Spotify playlist selected
**When** they start a session and trigger audio play for a track
**Then** the Spotify Web Playback SDK plays the track audio in the browser on the streamer's device

**Given** a streamer connected to Spotify without a Premium account
**When** they attempt to use Spotify playback
**Then** a clear notice is displayed: "Spotify Premium is required for in-app playback" with a link to upgrade or switch to YouTube (FR32)
**And** no playback error crashes the session

**Given** a Spotify track is playing and the streamer triggers "Next"
**When** the action executes
**Then** playback transitions to the next track within 2 seconds

**Given** a Spotify playback session
**When** the token is proactively refreshed mid-session
**Then** playback continues uninterrupted

### Story 2.8: YouTube In-App Playback & External Video Embed

As a streamer,
I want to play YouTube content in-app and embed external video links,
So that I can use free audio/video sources without needing Spotify Premium.

**Acceptance Criteria:**

**Given** a streamer with YouTube connected and a YouTube playlist selected
**When** they trigger play for a track
**Then** the YouTube iframe API loads the video in the dashboard playback area

**Given** a streamer enters an external video URL (YouTube or Twitch Clips) for a track
**When** the session reaches that track
**Then** the video is embedded via iframe and the streamer can control play/pause (FR31)

**Given** a YouTube video that is ContentID-blocked or unavailable
**When** the iframe attempts to load it
**Then** a clear fallback message is displayed: "This video is unavailable in your region or has been removed" (FR33, NFR-I4)
**And** the session does not crash — the streamer can skip to the next track

---

## Epic 3: Game Session & Bot Engine

Streamers can launch a complete game session from end to end — bot connects automatically, validates chat answers in real time, scores server-side, reconnects silently in under 5 seconds with zero data loss. Blindtest and Quiz are both playable. Full score management (export/import) is included.

### Story 3.1: GamePlugin Contract, Bot-Worker Skeleton & Session DB Schema

As a developer,
I want the GamePlugin v1 contract defined, the bot-worker skeleton deployed, and the session database schema created,
So that all subsequent game engine stories can build on a stable, testable foundation.

**Acceptance Criteria:**

**Given** `packages/game-types/src/plugin.interface.ts`
**When** a new game plugin is implemented
**Then** it must implement `GamePlugin` with hooks: `onSessionStart`, `onChatMessage`, `onStreamerAction`, `onReveal`, `onSessionEnd` — all returning `Promise<void>`
**And** the `version` field is a semver string required on every plugin

**Given** `apps/bot-worker/src/connections/IChatConnection.ts`
**When** the bot-worker initializes a session
**Then** it receives an `IChatConnection` instance via constructor injection, never instantiating it internally

**Given** `apps/bot-worker/src/connections/MockChatConnection.ts`
**When** used in unit tests
**Then** it implements `IChatConnection` and allows simulating incoming chat messages programmatically

**Given** `pnpm db:generate && pnpm db:migrate` is run
**When** the migration applies
**Then** `sessions`, `session_scores`, and `game_configs` tables exist with `tenant_id` columns and RLS policies

**Given** a bot-worker integration test using Testcontainers
**When** the test suite runs
**Then** a real Redis container is spun up automatically; `ioredis-mock` is never used in integration tests

### Story 3.2: Session Creation & Lifecycle Management

As a streamer,
I want to create a game session by selecting a game type and playlist, then control its lifecycle from the dashboard,
So that I can launch, pause, resume, and end sessions on demand.

**Acceptance Criteria:**

**Given** an authenticated streamer on the Sessions page
**When** they click "New Session", select "Blindtest", and pick a playlist
**Then** a session record is created with `status: 'pending'` and they are taken to the session control view

**Given** a streamer on the session control view
**When** they click "Launch Session"
**Then** the bot-worker process starts, connects to Twitch IRC, and session status changes to `'active'`

**Given** an active session
**When** the streamer clicks "Pause"
**Then** the bot stops accepting answers but maintains the IRC connection, and session status changes to `'paused'`

**Given** a paused session
**When** the streamer clicks "Resume"
**Then** the bot resumes accepting answers and session status returns to `'active'`

**Given** an active or paused session
**When** the streamer clicks "End Session"
**Then** the bot disconnects from Twitch IRC, final scores are flushed from Redis to PostgreSQL, and session status changes to `'ended'`

### Story 3.3: Hotkey-Driven Session Controls

As a streamer,
I want to control my entire session using rebindable keyboard shortcuts without touching my mouse,
So that I can focus on entertaining my audience during a live stream.

**Acceptance Criteria:**

**Given** an active session in the dashboard
**When** the streamer presses the configured hotkey for "Next track / Next question"
**Then** the session advances to the next item without any mouse interaction

**Given** default hotkeys (Space = next, P = pause, R = reveal, E = end)
**When** a streamer opens the Hotkeys settings panel
**Then** they can rebind any action to a different key combination and the new binding is saved

**Given** a rebound hotkey configuration
**When** the streamer reloads the dashboard
**Then** their custom hotkey bindings are restored from the database

**Given** a hotkey action is triggered
**When** the same key is pressed during a text input field focus
**Then** the hotkey does NOT fire (input fields take priority)

**Given** the dashboard hotkey panel
**When** a streamer navigates it using Tab and Enter only
**Then** they can view and rebind all hotkeys without using a mouse (NFR-A2)

### Story 3.4: Private Test Session Mode

As a streamer,
I want to run a private test session without streaming live on Twitch,
So that I can verify my playlist and game settings before going live.

**Acceptance Criteria:**

**Given** an authenticated streamer creating a new session
**When** they toggle "Test mode" before launching
**Then** the session starts using `MockChatConnection` instead of `TwitchChatConnection` — no Twitch IRC connection is made

**Given** a test session is active
**When** the streamer types a simulated chat message in the test input panel
**Then** the message is processed by the game engine as if it came from a real viewer, and scoring is applied

**Given** a test session
**When** the streamer ends it
**Then** the session is marked `status: 'test_ended'` and no scores are published to any leaderboard

**Given** a test session in the dashboard
**When** it is active
**Then** a clear "TEST MODE" indicator is visible to prevent confusion with a live session

### Story 3.5: Blindtest Plugin — Answer Validation & Scoring

As a system,
I want the Blindtest plugin to validate viewer chat answers and award progressive points server-side,
So that the game is fair, tamper-proof, and real-time.

**Acceptance Criteria:**

**Given** an active Blindtest session and a track is revealed
**When** a viewer types the correct song title in Twitch chat
**Then** the bot validates the answer server-side within 100ms p95 (NFR-P2), awards full points to the first correct respondent, and writes the score to Redis

**Given** a configurable time window after the first correct answer
**When** subsequent viewers submit the correct title or artist within the window
**Then** they receive partial points based on their response order (FR23)

**Given** a viewer submits an answer with minor spelling variation (e.g. "daft punk" vs "Daft Punk")
**When** the fuzzy matcher evaluates it
**Then** the answer is accepted if it meets the configured similarity threshold

**Given** the Blindtest scoring pipeline
**When** any score calculation occurs
**Then** it executes exclusively in `apps/bot-worker` — no scoring logic exists in `apps/web` (ADR-04)

**Given** a session with both Blindtest and Quiz rounds
**When** the Blindtest round ends
**Then** scores are stored in `session_scores` keyed by `(session_id, game_type: 'blindtest')` — separate from Quiz scores (FR20)

**Given** a Blindtest unit test in `scorer.test.ts`
**When** the test suite runs
**Then** it passes without any Redis or Twitch connection (pure logic test)

### Story 3.6: Quiz Plugin — Custom Questions & Answer Validation

As a streamer,
I want to define custom quiz questions and have viewer answers validated in real time,
So that I can run a quiz game with my own content using the same engine as Blindtest.

**Acceptance Criteria:**

**Given** a streamer with a Quiz playlist (questions + expected answers)
**When** they launch a Quiz session
**Then** `QuizPlugin` implements the `GamePlugin` v1 contract with no modifications to core engine logic (FR28)

**Given** an active Quiz round with a question displayed
**When** a viewer submits a correct text answer in Twitch chat
**Then** the answer is validated server-side within 100ms p95 (NFR-P2) and points are awarded using the same progressive scoring as Blindtest (FR23)

**Given** a Quiz question with multiple accepted answers configured
**When** a viewer submits any accepted variant
**Then** the answer is marked correct

**Given** a Quiz session
**When** scores are recorded
**Then** they are stored in `session_scores` with `game_type: 'quiz'`, separate from Blindtest scores (FR20)

### Story 3.7: Bot Auto-Reconnection, Message Queue & Event Log

As a streamer,
I want the bot to reconnect automatically after a connection drop and queue any missed messages,
So that my session continues invisibly without data loss, and I can see bot events in the dashboard.

**Acceptance Criteria:**

**Given** an active session where the Twitch IRC connection drops
**When** the bot-worker detects the disconnection
**Then** it initiates reconnection with exponential backoff, completing within 5 seconds (NFR-P3)

**Given** a reconnection in progress and three messages arrive in order [A, B, C]
**When** the queue is processed upon reconnection
**Then** messages are processed strictly in order A → B → C
**And** scores are assigned based on that arrival order — no viewer loses their position due to the reconnection (FR27, NFR-R3)

**Given** a reconnection completes
**When** the queue is processed
**Then** a notification appears in the dashboard event log: "Bot reconnected — Xs — no data lost" with timestamp (FR21)

**Given** the dashboard session view is open
**When** any bot event occurs (connect, disconnect, reconnect, error)
**Then** it appears in the real-time event log within 500ms (NFR-P4)

**Given** a bot process that crashes mid-session
**When** it is restarted
**Then** session state is recovered from Redis (ADR-03, NFR-R2) — no score data is lost

### Story 3.8: Score Export & Import

As a streamer,
I want to export my session scores at any time and import a previous score file to resume cumulative scoring,
So that I can run multi-session competitions and keep a portable record of results.

**Acceptance Criteria:**

**Given** an active or ended session
**When** the streamer clicks "Export Scores"
**Then** a file download begins within 3 seconds for sessions with up to 500 participants (NFR-P5), containing all viewer names, scores, and game type in both CSV and JSON formats

**Given** a session that has just ended
**When** the end-session confirmation modal appears
**Then** an "Export Scores" prompt is automatically shown before the modal can be dismissed (FR19)

**Given** a streamer creating a new session
**When** they click "Import Scores" and upload a previously exported score file
**Then** the scores from the file are loaded as the starting cumulative scores for the new session (FR18)

**Given** an imported score file with a viewer not present in the current session
**When** that viewer participates and scores
**Then** their imported score is carried forward and new points are added correctly

**Given** a malformed or incompatible score file
**When** the streamer attempts to import it
**Then** a clear validation error is displayed and no partial import occurs

---

## Epic 4: Overlay, Real-Time Display & Leaderboard

Viewers see real-time game state on the OBS overlay within 300ms p95 of a scoring event. The streamer has a full leaderboard view from the dashboard. The viewer→streamer CTA is live.

### Story 4.1: Overlay Token Generation & SSE Infrastructure

As a streamer,
I want a unique, persistent overlay URL I can paste into OBS as a browser source,
So that my viewers see the live game overlay without any configuration on my part.

**Acceptance Criteria:**

**Given** an authenticated streamer on the Overlay Setup page
**When** they view the page for the first time
**Then** a unique overlay token is generated via `nanoid(6)` with alphabet `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` and stored associated with their `tenant_id`
**And** the full overlay URL (`/overlay/[token]`) is displayed with a one-click "Copy" button

**Given** the overlay URL is pasted into OBS as a browser source
**When** OBS loads the page
**Then** the overlay page loads with no authentication required and zero additional configuration (NFR-I6)

**Given** `apps/web/app/overlay/[token]/route.ts`
**When** a client connects to the SSE endpoint
**Then** the route runs with `export const runtime = 'nodejs'` and `export const dynamic = 'force-dynamic'`

**Given** the SSE subscriber in `apps/web/server/redis/sse-subscriber.ts`
**When** it connects to Redis
**Then** it uses `PSUBSCRIBE game:{tenantId}:*` — never a hardcoded channel name

**Given** a bot-worker publishes a `SCORE_UPDATED` event to Redis
**When** the SSE subscriber receives it
**Then** in a local integration test with a simulated Redis publish, the SSE delivery time is under 100ms (NFR-P1 integration proxy; p95 under load validated separately)

**Given** an overlay token that does not exist in the DB
**When** a client loads the overlay URL
**Then** a neutral "Session not active" placeholder is shown — no error page, no crash

### Story 4.2: Real-Time Score Display on Overlay

As a viewer,
I want to see game state updates and my score appear on the overlay within moments of a correct answer,
So that I get immediate, visible feedback that my answer was registered.

**Acceptance Criteria:**

**Given** a viewer submits a correct answer and the bot-worker scores it
**When** the `SCORE_UPDATED` Redis event is published
**Then** the overlay displays the viewer's Twitch display name and their new score within 300ms p95 of the scoring event (FR35, NFR-P1)

**Given** a correct answer event received by the overlay
**When** it renders the viewer identity and score
**Then** a visual feedback animation plays before returning to the default overlay state (FR36)

**Given** multiple correct answers in quick succession
**When** the overlay receives them
**Then** each is displayed in sequence without events being dropped or overlapping incorrectly

**Given** an overlay client that loses its SSE connection
**When** the `EventSource` reconnects automatically
**Then** the overlay resumes receiving events without requiring a page reload

**Given** no active session for the overlay token
**When** the overlay is open in OBS
**Then** it displays a neutral waiting state without error

### Story 4.3: Session Leaderboard on Overlay

As a viewer,
I want to see the live leaderboard on the overlay during and after each round,
So that I can track my rank and compare with other participants in real time.

**Acceptance Criteria:**

**Given** an active game round with scored participants
**When** the overlay receives a leaderboard update event
**Then** it displays the top N participants (configurable, default 10) with display names, scores, and ranks (FR37, FR41)

**Given** a viewer participating in the session
**When** they look at the overlay
**Then** they can see their own rank and accumulated score highlighted (FR42)

**Given** the leaderboard during an active round
**When** a new correct answer changes scores
**Then** the leaderboard updates within 300ms p95 without a full page reload

**Given** a session with both Blindtest and Quiz rounds
**When** the leaderboard is shown
**Then** it displays scores for the current game type only (FR20)

### Story 4.4: Streamer Score Dashboard View

As a streamer,
I want to see the full real-time score table for all participants from my dashboard,
So that I can monitor the session and have all data available at a glance.

**Acceptance Criteria:**

**Given** an active session in the dashboard
**When** the streamer views the session detail page
**Then** a score table shows all participating viewers, their scores, and ranks, refreshed every 1000ms via TanStack Query (FR43)

**Given** a session with multiple game types
**When** the streamer views the dashboard score table
**Then** they can switch between tabs for each game type's scores (FR20)

**Given** an ended session
**When** the streamer views it in the dashboard
**Then** the final frozen score table is shown with an "Export Scores" button prominently displayed (FR44)

**Given** the streamer clicks "Export Scores" from the dashboard score view
**When** the export completes
**Then** both a CSV file and a JSON file are available for download within 3 seconds for up to 500 participants (NFR-P5)

### Story 4.5: Overlay Preview & Theme Selection

As a streamer,
I want to preview my overlay appearance from the dashboard and choose a visual theme,
So that I can verify how it looks before going live.

**Acceptance Criteria:**

**Given** a streamer on the Overlay Setup page
**When** they view the page
**Then** a live preview of the overlay is embedded in the dashboard using an iframe pointing to their overlay URL (FR38)

**Given** a streamer selects a different theme from the available options (minimum 2 at MVP)
**When** they select it
**Then** the preview iframe updates immediately to show the new theme (FR40)

**Given** a theme selection is saved
**When** OBS renders the overlay URL
**Then** the overlay applies the saved theme without additional configuration

**Given** a Free tier streamer
**When** they view theme options
**Then** 2 basic themes are available; additional themes show locked with an upgrade prompt

### Story 4.6: Viewer-to-Streamer CTA in Overlay

As a viewer,
I want to see a call-to-action in the overlay inviting me to create my own streamer account,
So that I can discover the platform organically during a game I'm already enjoying.

**Acceptance Criteria:**

**Given** an active game session on the overlay
**When** the overlay is rendered
**Then** a visible CTA is displayed that does not obstruct core game information (FR39)

**Given** a viewer clicks the CTA in the overlay
**When** the link opens
**Then** they are taken to the platform landing page with an onboarding flow pre-targeted at new streamer registration

**Given** the overlay CTA
**When** the overlay is rendered
**Then** the CTA is readable at 1920×1080 and meets WCAG 2.1 AA contrast ratios (NFR-A1)

**Given** a streamer who wants to disable the CTA
**When** they toggle "Hide CTA" in the Overlay Setup page
**Then** the CTA no longer appears in their overlay

---

## Epic 5: Viewer Identity & Viral Loop

Viewers have public profiles discoverable from the overlay. The viewer→streamer conversion pipeline is fully operational with pre-populated onboarding from viewer Twitch identity.

### Story 5.1: Viewer Profile Opt-In from Overlay & Viewer DB Schema

As a viewer,
I want to create a public profile by opting in directly from the overlay I'm watching,
So that my participation history is tracked and I can be recognized across sessions.

**Acceptance Criteria:**

**Given** `pnpm db:generate && pnpm db:migrate` is run for this story
**When** the migration applies
**Then** a `viewer_profiles` table exists with `twitch_user_id`, `display_name`, `created_at`, `deleted_at` columns and RLS policies applied

**Given** a viewer watching a stream on the overlay
**When** they click "Create my profile"
**Then** they are redirected to a lightweight opt-in page requiring only Twitch OAuth authorization (no password, no email) (FR5)

**Given** a viewer completes the Twitch OAuth on the opt-in page
**When** the callback processes
**Then** a `viewer_profiles` row is created using their Twitch identity
**And** their participation history from previous sessions (matched by `twitch_user_id`) is retroactively linked

**Given** a viewer who already has a profile
**When** they follow the opt-in flow again
**Then** no duplicate profile is created and they are redirected to their existing profile page

**Given** a viewer who has not opted in
**When** they participate in a session
**Then** their score is tracked ephemerally for that session but no persistent profile is created without explicit opt-in

### Story 5.2: Viewer Public Profile Page & Shareable URL

As a viewer,
I want a public profile page showing my participation history and badges, accessible via a shareable URL,
So that I can share my gaming identity outside the platform.

**Acceptance Criteria:**

**Given** a viewer with an existing profile
**When** they navigate to `/profile/[twitchUsername]`
**Then** a public page displays: Twitch display name, avatar, total sessions participated, top scores, and earned badges (FR45)

**Given** a viewer's profile page URL
**When** it is opened in a browser by anyone — including unauthenticated users
**Then** the page loads publicly without requiring a login (FR46)

**Given** a viewer on their own profile page
**When** they click "Copy profile link"
**Then** the shareable URL is copied to clipboard

**Given** a viewer who has earned a badge
**When** their profile page loads
**Then** the badge is displayed with its label and the date it was earned

**Given** a viewer with zero sessions played
**When** their profile page is viewed
**Then** a friendly empty state is shown rather than an error

### Story 5.3: Cross-Session Statistics on Viewer Profile

As a viewer,
I want to see aggregated statistics across all my sessions on my profile,
So that I can track my improvement and competitive standing over time.

**Acceptance Criteria:**

**Given** a viewer with participation history across multiple sessions
**When** their profile page loads
**Then** it displays: total sessions played, total correct answers, average score per session, best single-session score, and most-played game type (FR47)

**Given** a viewer who has participated in both Blindtest and Quiz sessions
**When** their profile statistics load
**Then** stats are shown per game type separately

**Given** a test using session fixture data (pre-seeded sessions in test DB)
**When** the stats aggregation query runs for a viewer with known participation history
**Then** the computed totals match the expected values from the fixture data

**Given** a viewer profile page
**When** new session data is added
**Then** statistics update within the next page load (no stale cache beyond 60 seconds)

### Story 5.4: Viewer-to-Streamer Onboarding Pre-Population

As a viewer who wants to become a streamer,
I want the onboarding flow to be pre-filled with my Twitch identity,
So that I can start streaming without re-entering information I've already provided.

**Acceptance Criteria:**

**Given** a viewer with an existing profile who clicks the overlay CTA "Host your own blindtest →"
**When** they land on the streamer onboarding page
**Then** their Twitch display name and avatar are pre-populated in the onboarding form (FR48)

**Given** a viewer who completes the streamer onboarding flow
**When** they finish onboarding
**Then** they have a fully provisioned streamer tenant and their viewer profile is linked to their new streamer account

**Given** a viewer without an existing profile who clicks the streamer CTA
**When** they land on the onboarding page
**Then** they go through the standard Twitch OAuth flow with no pre-population (graceful degradation)

**Given** a newly converted streamer
**When** they access the dashboard for the first time
**Then** they can launch their first session in under 2 minutes from the moment they clicked the CTA

### Story 5.5: Viewer Profile Erasure — GDPR

As a viewer,
I want to request the permanent deletion of my profile and participation history,
So that I can exercise my GDPR right to erasure at any time.

**Acceptance Criteria:**

**Given** an authenticated viewer on their profile page
**When** they click "Delete my profile" and confirm
**Then** their `viewer_profiles` row is soft-deleted (`deleted_at = NOW()`) and they are signed out

**Given** a soft-deleted viewer profile
**When** 30 calendar days have elapsed
**Then** a scheduled job permanently deletes the row and all associated participation history (FR8)

**Given** a viewer whose profile has been deleted
**When** their `twitch_user_id` appears in historical session score data
**Then** their scores are anonymized (display name replaced with "Anonymous") to preserve leaderboard integrity

**Given** a viewer who requests erasure
**When** the soft-delete is applied
**Then** their public profile URL returns a 404 immediately

**Given** a viewer in the 30-day grace period
**When** they sign in again
**Then** they are offered a reactivation option to cancel the deletion

### Story 5.6: Content Reporting

As a platform user,
I want to report a playlist or quiz content item for moderation review,
So that harmful or inappropriate content can be flagged and reviewed by the platform team.

**Acceptance Criteria:**

**Given** any authenticated user viewing a playlist or quiz question
**When** they click "Report content"
**Then** a modal appears with a reason selector and an optional free-text field (FR13)

**Given** a completed content report submission
**When** the form is submitted
**Then** a report record is created with: `reporter_id`, `content_type`, `content_id`, `reason`, `created_at`
**And** the reporter sees a confirmation: "Report submitted. Our team will review it."

**Given** a report is created
**When** it is stored
**Then** it is visible in the Platform Admin moderation queue (Story 7.5)

**Given** a user who has already reported the same content item
**When** they attempt to report it again
**Then** a duplicate report from the same user for the same content is not created

---

## Epic 6: Subscription & Freemium Gates

Streamers can subscribe to paid tiers; the platform enforces feature access automatically based on active subscription status, with Stripe webhook-driven role updates within 60 seconds.

### Story 6.1: Subscription DB Schema & Stripe Webhook Infrastructure

As a platform operator,
I want a Stripe webhook endpoint that updates subscription roles within 60 seconds of any subscription event,
So that streamer access reflects their actual subscription status automatically.

**Acceptance Criteria:**

**Given** `pnpm db:generate && pnpm db:migrate` is run for this story
**When** the migration applies
**Then** a `subscription_records` table exists with: `tenant_id`, `stripe_customer_id`, `stripe_subscription_id`, `status`, `tier`, `current_period_end`, `grace_period_end`

**Given** `apps/web/app/api/v1/webhooks/stripe/route.ts` receives a POST request
**When** the request arrives
**Then** the `Stripe-Signature` header is verified against `STRIPE_WEBHOOK_SECRET` using HMAC-SHA256 before any business logic executes
**And** requests with invalid signatures return HTTP 401 and are not processed

**Given** a valid `subscription.created` or `subscription.updated` webhook event
**When** the webhook handler processes it
**Then** the streamer's `role` in `users` is updated within 60 seconds of webhook receipt (FR52, NFR-I5)

**Given** a `subscription.cancelled` webhook event
**When** the handler processes it
**Then** the streamer's role is downgraded to `'free'` at `current_period_end` — not immediately

**Given** a Stripe webhook event that arrives out of order
**When** the handler processes it
**Then** it handles the event idempotently without creating duplicate DB records

**Given** the webhook endpoint
**When** it receives any request
**Then** it is excluded from Upstash rate limiting

### Story 6.2: Subscribe to Paid Tier — Stripe Checkout Flow

As a streamer,
I want to subscribe to the Pro tier through an in-platform payment flow,
So that I can unlock unlimited playlists, all MVP games, and score export/import.

**Acceptance Criteria:**

**Given** an authenticated Free tier streamer
**When** they click "Upgrade to Pro (~15€/mo)"
**Then** they are redirected to a Stripe Checkout session pre-filled with their email and tenant metadata

**Given** a streamer who completes payment on Stripe Checkout
**When** they are redirected back
**Then** they land on a success page confirming their Pro subscription
**And** within 60 seconds their JWT is refreshed with `role: 'pro'` and `subscriptionStatus: 'pro'`

**Given** a streamer who abandons Stripe Checkout
**When** they return to the platform
**Then** their Free tier status is unchanged and no partial subscription record is created

**Given** a streamer attempting to subscribe
**When** Stripe processes the payment
**Then** no card data transits through or is stored on platform servers (NFR-S6)

### Story 6.3: Feature Access Enforcement

As the platform,
I want to enforce subscription tier limits across all features,
So that Free tier restrictions are respected and paid features are only accessible to eligible streamers.

**Acceptance Criteria:**

**Given** a Free tier streamer calling `playlist.create` tRPC procedure when they already have 3 playlists
**When** the procedure executes
**Then** it throws `TRPCError` with code `FORBIDDEN` and the dashboard shows an upgrade prompt

**Given** a Free tier streamer calling `session.create` with `game_type: 'quiz'`
**When** the procedure executes
**Then** it is blocked with message: "Quiz is available on Pro tier"

**Given** a Free tier streamer clicking "Export Scores"
**When** the export action is triggered
**Then** they see an upgrade prompt — score export requires Pro tier

**Given** a Free tier streamer attempting to connect a second audio provider while one is already connected
**When** the connection attempt is made
**Then** it is blocked with message: "Free tier supports one audio provider. Upgrade to Pro for both."

**Given** a Pro tier streamer
**When** they access any Pro-gated feature (unlimited playlists, all games, both audio providers, score export)
**Then** access is granted without any upgrade prompt or restriction

**Given** a streamer whose JWT contains `subscriptionStatus: 'free'`
**When** they call any Pro-gated tRPC procedure
**Then** the `protectedProcedure` middleware rejects with `FORBIDDEN` — enforcement is at the procedure level, not only in the UI

### Story 6.4: Subscription Management — Upgrade, Downgrade & Cancel

As a streamer,
I want to upgrade, downgrade, or cancel my subscription at any time from my settings,
So that I have full control over my billing without contacting support.

**Acceptance Criteria:**

**Given** an authenticated Pro tier streamer on the Settings page
**When** they click "Manage Subscription"
**Then** they are redirected to the Stripe Customer Portal with their existing subscription pre-loaded (FR51)

**Given** a streamer who downgrades from Pro to Free in the Stripe Customer Portal
**When** Stripe sends a `subscription.updated` webhook
**Then** their role is updated to `'free'` at the end of the current billing period — not immediately

**Given** a streamer who cancels their subscription
**When** Stripe sends a `subscription.cancelled` webhook
**Then** their role is scheduled to downgrade to `'free'` at `current_period_end`
**And** they are notified: "Your Pro access ends on [date]"

**Given** a downgraded streamer who had more than 3 playlists on Pro
**When** their role switches to `'free'`
**Then** existing playlists beyond the limit become read-only (not deleted) with a prompt to upgrade

### Story 6.5: Payment Failure Grace Period

As a streamer,
I want to retain access to paid features for 7 days after a payment failure,
So that a temporary billing issue doesn't immediately interrupt a live stream.

**Acceptance Criteria:**

**Given** Stripe sends a `payment.failed` webhook event
**When** the webhook handler processes it
**Then** `subscription_records.grace_period_end` is set to `NOW() + 7 days` and the streamer's role is NOT immediately downgraded (FR53)

**Given** a streamer in the grace period
**When** they access Pro-gated features
**Then** access is granted normally — no restrictions during the grace period

**Given** a streamer in the grace period
**When** they log into the dashboard
**Then** a persistent warning banner is displayed: "Payment failed — your Pro access ends in X days. Update your payment method."

**Given** the grace period check function called directly in a test with a tenant whose `grace_period_end` is in the past
**When** the function executes
**Then** the tenant's role is set to `'free'` and `subscription_records.status` is set to `'expired'`

**Given** Stripe sends a `payment.succeeded` event during the grace period
**When** the webhook processes it
**Then** `grace_period_end` is cleared, subscription is restored to active, and the warning banner disappears on next login

---

## Epic 7: Platform Administration & Operations

Platform admins can monitor real-time platform health, manage content moderation, intervene on sessions remotely, and operate the weekly official playlist workflow with full audit trail.

### Story 7.1: Admin Role & Audit Log Infrastructure

As a platform operator,
I want an admin-only role with an immutable audit log of all administrative actions,
So that every admin action is traceable, accountable, and tamper-proof.

**Acceptance Criteria:**

**Given** `pnpm db:generate && pnpm db:migrate` is run for this story
**When** the migration applies
**Then** an `admin_audit_log` table exists with: `id UUID`, `actor_id`, `action`, `target_type`, `target_id`, `metadata JSONB`, `created_at TIMESTAMPTZ`
**And** the table has no `UPDATE` or `DELETE` permissions — insert only (immutable)

**Given** a user with `role: 'admin'` in their JWT
**When** they access any `/dashboard/admin/*` route
**Then** middleware allows access

**Given** a user without `role: 'admin'`
**When** they attempt to access any `/dashboard/admin/*` route
**Then** they receive a 403 and are redirected to the main dashboard

**Given** any admin action executes
**When** the action completes
**Then** a row is inserted into `admin_audit_log` with `actor_id`, action type, affected resource, and `created_at = NOW()` (FR59, NFR-S7)
**And** actions that fail to write the audit log are rolled back entirely

**Given** an admin queries the audit log
**When** they filter by `actor_id`, `action`, or `target_id`
**Then** results are returned in descending `created_at` order with pagination (50 rows per page)

### Story 7.2: Real-Time Platform Monitoring Dashboard

As a platform admin,
I want a real-time view of active sessions, bot connection states, and platform health indicators,
So that I can detect and respond to issues before they impact streamers.

**Acceptance Criteria:**

**Given** an admin on the `/dashboard/admin` page
**When** the page loads
**Then** it displays all active sessions with: streamer name, game type, session duration, bot connection status, and viewer count (FR55)
**And** the list refreshes every 5000ms via TanStack Query `refetchInterval: 5000`

**Given** a bot that is reconnecting
**When** the admin monitoring view updates
**Then** the affected session row is visually highlighted (amber indicator) with reconnection duration shown

**Given** a bot disconnected for more than 10 seconds
**When** the admin monitoring view updates
**Then** the row shows a red indicator and an "Intervene" button becomes available

**Given** an admin viewing the health dashboard
**When** they look at platform-level metrics
**Then** they see: total active sessions, total connected bots, Redis memory usage, and last deployment timestamp

**Given** BetterStack Uptime is configured for the platform domain
**When** an incident lasting more than 5 minutes occurs
**Then** automated notifications are sent to the configured Discord webhook or email (NFR-R5)

### Story 7.3: Remote Session Interventions

As a platform admin,
I want to perform remote interventions on active sessions,
So that I can resolve overlay delivery issues or force token refreshes without requiring the streamer to act.

**Acceptance Criteria:**

**Given** an admin who clicks "Intervene" on a session
**When** the intervention panel opens
**Then** available actions include: "Force SSE reconnect", "Force token refresh", "Force bot reconnect", "End session"

**Given** an admin triggers "Force SSE reconnect"
**When** the action executes
**Then** a `SESSION_FORCE_RECONNECT` event is published to the Redis channel for that session
**And** overlay clients reconnect their EventSource within 5 seconds
**And** an audit log entry is written (FR59)

**Given** an admin triggers "Force token refresh"
**When** the action executes
**Then** the Twitch OAuth token for that tenant is refreshed using the stored refresh token
**And** an audit log entry is written (FR59)

**Given** an admin triggers "End session" remotely
**When** the action executes
**Then** session status is set to `'ended'`, bot disconnects, Redis state is flushed to PostgreSQL
**And** the streamer sees a dashboard notification: "Session ended by platform admin"
**And** an audit log entry is written (FR59)

**Given** an admin performs any remote intervention
**When** the intervention completes
**Then** a notification appears in the affected streamer's dashboard event log within 500ms (FR56)

### Story 7.4: Account Quarantine Management

As a platform admin,
I want to place streamer or viewer accounts in quarantine pending investigation,
So that I can suspend access for accounts with suspicious activity without permanent deletion.

**Acceptance Criteria:**

**Given** an admin on the user management panel
**When** they search for a user by Twitch username
**Then** the user record is displayed with their current status, tier, and a "Quarantine" action button (FR57)

**Given** an admin clicks "Quarantine" on a streamer account and provides a reason
**When** the action is confirmed
**Then** the streamer's `role` is set to `'quarantined'`, all active sessions for that tenant are immediately ended
**And** the streamer sees: "Your account is under review. Contact support."
**And** an audit log entry is written with the reason (FR59)

**Given** an admin who lifts a quarantine
**When** they click "Restore access" and confirm
**Then** the account's role is restored to its previous value
**And** an audit log entry is written for the restoration (FR59)

**Given** an admin viewing the quarantine queue
**When** they filter by status `'quarantined'`
**Then** all currently quarantined accounts are listed with quarantine date, reason, and acting admin

### Story 7.5: Content Moderation Queue

As a platform admin,
I want to review reported content and apply moderation actions,
So that harmful or inappropriate playlists and quiz questions are addressed promptly.

**Acceptance Criteria:**

**Given** content reports submitted via Story 5.6
**When** an admin opens the moderation queue
**Then** they see pending reports with: content type, content preview, reporter count, report reasons, and reported date (FR58)

**Given** an admin decides to remove a flagged playlist
**When** they click "Remove content" and confirm
**Then** the playlist is soft-deleted and becomes inaccessible to all users
**And** the submitting streamer receives a dashboard notification: "A playlist was removed following a moderation review"
**And** an audit log entry is written with the content ID and reason (FR59)

**Given** an admin reviews a report and determines no action is needed
**When** they click "Dismiss"
**Then** the report is marked `status: 'dismissed'` and removed from the active queue
**And** an audit log entry is written (FR59)

**Given** the moderation queue
**When** an admin filters by report reason
**Then** only reports with that reason are shown

### Story 7.6: Weekly Official Playlist Curation & Publishing

As a platform admin,
I want to curate and publish the weekly official playlist via CSV upload or manual entry,
So that all participating streamers play the same curated content each week.

**Acceptance Criteria:**

**Given** an admin on the official playlist management page
**When** they click "New Weekly Playlist"
**Then** they can enter a theme, add tracks manually (title, artist, difficulty), and set a publish date (FR54)

**Given** an admin who wants to import tracks in bulk
**When** they upload a CSV file with columns: `title`, `artist`, `difficulty`
**Then** the tracks are imported and displayed in the draft playlist for review before publishing

**Given** an admin editing a draft weekly playlist
**When** they reorder tracks using up/down buttons
**Then** the order is saved immediately and reflects the intended difficulty progression

**Given** a weekly playlist in draft state
**When** the admin clicks "Publish" and confirms
**Then** the playlist status changes to `'published'` and participating streamers see it in their dashboard as "This week's official playlist"
**And** an audit log entry is written with the playlist ID, track count, and publish timestamp (FR59)

**Given** a weekly playlist that has already been played by at least one streamer
**When** the admin attempts to edit it
**Then** a warning is displayed: "This playlist has already been played. Editing may affect leaderboard consistency."
**And** edit access requires a secondary confirmation
