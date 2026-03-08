---
stepsCompleted: ['step-01-init', 'step-02-context', 'step-03-starter', 'step-04-decisions', 'step-05-patterns', 'step-06-structure', 'step-07-validation', 'step-08-complete']
lastStep: 8
status: 'complete'
completedAt: '2026-03-07'
inputDocuments:
  - '_bmad-output/planning-artifacts/prd.md'
workflowType: 'architecture'
project_name: 'Playground'
user_name: 'Desty Le Boss'
date: '2026-03-07'
---

# Architecture Decision Document

_This document builds collaboratively through step-by-step discovery. Sections are appended as we work through each architectural decision together._

## Starter Template Evaluation

### Primary Technology Domain

Full-stack TypeScript SaaS — dual-runtime monorepo. Primary domain: Next.js web
application (dashboard + API + SSE overlay) + separate Node.js bot worker processes.
Both runtimes share a Drizzle ORM schema and TypeScript types via monorepo packages.

### Starter Options Considered

**Option A — Turborepo + Next.js 15 App Router + Drizzle ORM** (selected)
- Handles both dashboard frontend and API/SSE backend in one Next.js app
- SSE works on Railway/Render/Fly.io with `runtime = 'nodejs'` + `dynamic = 'force-dynamic'`
- Drizzle ORM has native PostgreSQL RLS support via `pgPolicy` (ADR-06 compliant)
- Bot worker is a separate `apps/bot-worker` TypeScript package — plain Node.js process

**Option B — Turborepo + Fastify API + Vite React SPA**
- Better SSE performance isolation but more setup complexity
- Rejected: adds auth complexity (session management across separate API + SPA origins)

**Option C — T3 Stack (Next.js + tRPC + Prisma)**
- Strong type safety with tRPC but Prisma has weaker native RLS support than Drizzle
- Rejected: Drizzle is a better fit for ADR-06 RLS requirement

### Selected Starter: Turborepo 2.8.13 + Next.js 15 + Drizzle ORM

**Rationale for Selection:**
- Turborepo 2.8.13 (latest, March 2026) is actively maintained
- Monorepo structure cleanly isolates the two runtimes while sharing DB schema
  and type contracts via shared packages
- Next.js App Router handles dashboard, public pages, API routes, webhooks, and SSE
  in one runtime with a single auth session model
- Drizzle ORM provides first-class RLS support critical for ADR-06 multi-tenancy
- Deployment target (Railway/Render/Fly.io) supports long-lived Node.js SSE connections
- SSE constraint (NOT compatible with Vercel serverless) explicitly documented

**Initialization Command:**

```bash
pnpm dlx create-turbo@latest playground --example with-tailwind
```

Post-scaffold structure to match project needs:

```
playground/
├── apps/
│   ├── web/               # Next.js 15 App Router
│   │   ├── app/
│   │   │   ├── (dashboard)/    # Streamer dashboard routes
│   │   │   ├── (public)/       # Viewer profiles, leaderboards
│   │   │   ├── overlay/[token]/# SSE overlay route (nodejs runtime)
│   │   │   └── api/            # REST API + webhooks
│   │   └── ...
│   └── bot-worker/        # Node.js TypeScript process (separate runtime)
│       ├── src/
│       │   ├── bot-session.ts      # BotSession(IChatConnection, IRedisClient)
│       │   ├── chat-ingestion.ts
│       │   ├── connections/
│       │   │   ├── IChatConnection.ts      # Interface (injectable)
│       │   │   └── TwitchChatConnection.ts # Concrete impl (tmi.js)
│       │   └── plugins/        # GamePlugin implementations (import game-engine only)
│       └── ...
├── packages/
│   ├── db/                # Drizzle schema + pgPolicy RLS + migrations
│   ├── game-types/        # GamePlugin contract v1, session DTOs, event types
│   │                      # (imported by both apps/web AND apps/bot-worker)
│   ├── game-engine/       # Core engine execution logic
│   │                      # ⚠️ ONLY imported by apps/bot-worker — never by apps/web
│   └── shared/            # Domain constants, Zod schemas, utility types
└── turbo.json
```

**Architectural Decisions Provided by Starter:**

**Language & Runtime:**
- TypeScript 5.x across all packages
- Node.js ≥ 20 LTS (required for stable SSE streaming in Next.js App Router)
- Strict TypeScript configuration per package via shared `tsconfig`

**Package Boundary Rule:**
- `packages/game-types` — shared contract (interfaces, DTOs, plugin versioning)
  imported by any package that needs to *understand* game events
- `packages/game-engine` — execution logic imported **exclusively** by
  `apps/bot-worker`; the web server must never execute scoring logic (ADR-04)
- `BotSession` takes `IChatConnection` as constructor parameter — dependency
  injection enables `MockChatConnection` in tests without real IRC connections

**Styling Solution:**
- Tailwind CSS v4 for dashboard UI
- Overlay: plain CSS injected via OBS browser source (no Tailwind in overlay bundle)

**Build Tooling:**
- Turborepo 2.8.13 for task orchestration and build caching
- Next.js 15 Turbopack for `apps/web`
- `tsc` → CommonJS output for `apps/bot-worker` (Node.js process)
- `pnpm` workspaces for dependency management

**Database & ORM:**
- Drizzle ORM with `drizzle-kit` for migrations
- PostgreSQL RLS policies defined in schema via `pgPolicy` — ADR-06 compliant
- Target: Neon or Supabase (both support Drizzle RLS natively)

**Testing Framework:**

| Layer | Tool | Strategy |
|---|---|---|
| `apps/web` unit | Vitest + MSW | HTTP request mocking, React Testing Library |
| `apps/web` E2E | Playwright | Dashboard flows, auth, billing |
| `apps/bot-worker` unit | Vitest | `MockChatConnection` injection, in-memory state |
| `apps/bot-worker` integration | Vitest + Testcontainers | Real Redis container, real scoring pipeline |
| `packages/game-engine` | Vitest | Plugin contract isolation, event sequence testing |

Testcontainers provides a real Redis instance for bot-worker integration tests
without mocking Redis pub/sub behaviour (which `ioredis-mock` cannot fully replicate).

**Development Experience:**
- `turbo dev` — runs all apps simultaneously in watch mode
- Next.js Fast Refresh for `apps/web`
- `tsx --watch` for `apps/bot-worker` in development
- Shared ESLint + Prettier via `packages/eslint-config`

**SSE Critical Configuration:**
```typescript
// apps/web/app/overlay/[token]/route.ts
export const runtime = 'nodejs'        // Required: prevents serverless execution
export const dynamic = 'force-dynamic' // Required: disables static optimization

// MVP capacity: ~500 concurrent SSE connections per Next.js instance
// Vertical scaling: add instances behind load balancer (sticky sessions required)
// V2 migration path: extract apps/sse-gateway (Hono/Fastify) if SSE load
// warrants dedicated service separation
```

**Note:** Project initialization using the command above should be the first
implementation story (Epic 0 / Story 0.1 — Project Setup & Monorepo Scaffold).

## Core Architectural Decisions

### Decision Priority Analysis

**Critical Decisions (Block Implementation):**
- Auth.js v5 with Twitch OAuth + httpOnly cookie JWT
- tRPC for dashboard API + REST for public/overlay API
- Redis AOF persistence for NFR-R2 compliance
- Zod for validation + env schema validation at process startup

**Important Decisions (Shape Architecture):**
- TanStack Query v5 for client-side server state management
- Railway as deployment platform (SSE compatibility critical)
- Upstash Rate Limit for API protection
- GitHub Actions CI/CD pipeline

**Deferred Decisions (Post-MVP):**
- Proactive JWT invalidation on subscription webhook (accepted 5-min gap for MVP)
- SSE gateway extraction (documented V2 migration path)
- Advanced monitoring / alerting beyond Sentry + BetterStack

### Data Architecture

**Database:** PostgreSQL (Neon or Supabase) — managed, supports Drizzle RLS natively
**ORM:** Drizzle ORM with `drizzle-kit` for migrations
- Migrations: explicit `drizzle-kit migrate` only — never auto-migrate in production
- RLS: `pgPolicy` per table, `crudPolicy` helper from `drizzle-orm/neon`
- Schema location: `packages/db/schema/` — single source of truth for all apps

**Validation:** Zod v3
- All API inputs validated at the boundary (route handler entry)
- Drizzle `createInsertSchema` / `createSelectSchema` for DB-derived Zod types
- Shared schemas in `packages/shared/schemas/`

**Redis Configuration:**
- Persistence: **AOF (Append-Only File)** mode — lower RPO than RDB, required for NFR-R2
- Key pattern: `{tenantId}:session:{sessionId}:events` (game state)
- Key pattern: `bot:health:{workerId}` (bot monitoring)
- Session TTL: 24h for active sessions; weekly game scores flushed to PG at session end
- Provider: Upstash Redis (serverless-compatible, AOF available on paid plan)

**Caching Strategy:**
- Hot path (scoring, overlay): Redis only — no DB reads
- Dashboard data: TanStack Query client cache (30s stale time)
- Subscription role: JWT payload cached 5 min (accepted gap on webhook — see Auth)

### Authentication & Security

**Auth Framework:** Auth.js v5 (formerly NextAuth)
- Twitch OAuth provider configured server-side (ADR-05 compliant)
- Sessions stored as httpOnly secure cookies (JWT mode)
- JWT payload: `{ tenantId, role, subscriptionStatus, exp }`
- Token refresh: Auth.js automatic session refresh on expiry

**Authorization:**
- Role checked in Next.js middleware for route protection
- Feature flags evaluated in tRPC procedures from JWT `role` field
- RLS enforced at DB layer regardless of application-layer checks (ADR-06)

**JWT Invalidation Strategy:**
- **Decision:** Accept the 5-minute stale window on subscription downgrade
- **Rationale:** Redis-based token blacklist adds latency + operational complexity;
  the downgrade window is acceptable UX for MVP
- **UI mitigation:** On next API call returning 403, client shows "Refreshing access..."
  and triggers Auth.js session refresh; user loses no data

**Rate Limiting:** Upstash Rate Limit (Redis-backed)
- Applied in `apps/web/middleware.ts` for all `/api/` routes
- Public leaderboard endpoints: 60 req/min per IP
- Dashboard endpoints: 300 req/min per authenticated user
- Webhook endpoints: excluded from rate limit (validated by HMAC instead)

**Webhook Security:** HMAC signature verification middleware
- Stripe: `stripe.webhooks.constructEvent(payload, sig, secret)`
- Twitch EventSub: `X-Hub-Signature-256` header verification
- Implemented as reusable Next.js route middleware

**Token Encryption:** All OAuth tokens (Twitch, Spotify, YouTube) encrypted at rest
using AES-256-GCM before DB storage — encryption key from environment variable,
never committed to source (Zod env validation ensures key is present at startup)

### API & Communication Patterns

**Dashboard API:** tRPC v11
- Type-safe end-to-end from Next.js Server to React client components
- Router structure: `auth`, `playlist`, `session`, `subscription`, `admin`
- All procedures validate input with Zod, check JWT role in middleware
- No tRPC procedure ever executes scoring logic (ADR-04)

**Public / External API:** REST
- Overlay SSE: `GET /api/overlay/[token]/stream` (nodejs runtime, force-dynamic)
- Viewer profile: `GET /api/v1/profiles/[viewerId]` — public, rate-limited
- Leaderboard: `GET /api/v1/leaderboards/[...slug]` — public, rate-limited
- Webhooks: `POST /api/webhooks/stripe`, `POST /api/webhooks/twitch`

**Inter-Runtime Communication (Web Server ↔ Bot Workers):**
- Bot workers publish scoring events to Redis pub/sub channel
- Web server SSE handler subscribes and fans out to connected overlay clients
- No direct HTTP calls between runtimes — Redis is the only shared bus
- Admin commands (force token refresh, quarantine) published to
  `admin:commands:{workerId}` Redis channel; bot worker subscribes on startup

**Error Response Standard:**
```typescript
type ApiError = {
  error: {
    code: string       // e.g. 'UNAUTHORIZED', 'SESSION_NOT_FOUND'
    message: string    // Human-readable
    details?: unknown  // Optional structured details
  }
}
```

### Frontend Architecture

**Server State:** TanStack Query v5
- All server data fetched through React Query hooks
- Dashboard session data: `refetchInterval: 3000` during active session
- Stale time: 30s for playlist data, 5s for session state, 0 for leaderboard

**Component Model:**
- Next.js Server Components for initial renders, static data, SEO pages
- Client Components for interactive dashboard (session controls, real-time updates)
- Overlay: pure client-side React rendered in OBS browser source context

**Global State:** React Context only
- `TenantContext` — tenantId, streamer profile, subscription tier
- `SessionContext` — active session state for dashboard
- No Zustand / Redux — TanStack Query handles all server state

**Forms:** React Hook Form v7 + Zod resolver
- Validation runs client-side (Zod) and server-side (tRPC input validator)

**Real-time Dashboard Updates:**
- Bot health status: TanStack Query polling (3s interval)
- Active session leaderboard: TanStack Query polling (1s interval during session)
- Overlay SSE stream: dedicated `EventSource` in overlay client only

### Infrastructure & Deployment

**Deployment Platform:** Railway
- No serverless execution limits — SSE requires persistent connections
- Native Docker support, managed PostgreSQL and Redis add-ons
- ⚠️ Do NOT deploy to Vercel — SSE connections terminated at 10s

**Containers:**
- `apps/web` → Docker multi-stage build, Railway service
- `apps/bot-worker` → Docker multi-stage build, Railway service (horizontally scalable)
- Local: `docker-compose.yml` provides PostgreSQL + Redis; apps run natively

**CI/CD:** GitHub Actions
- `push → main`: tests → build → deploy to Railway
- `pull_request`: tests + type-check only

**Environment Validation:** Zod env schema at process startup
- Process crashes immediately if any required variable is missing
- Shared schema in `packages/shared/env.ts`
- TOKEN_ENCRYPTION_KEY: 64-char hex string (AES-256-GCM for OAuth tokens)

**Error Tracking:** Sentry (`@sentry/nextjs` + `@sentry/node`)
**Logging:** BetterStack / Logtail — structured JSON, Railway stdout capture
**Monitoring:** Upstash dashboard (Redis), Railway metrics, BetterStack Uptime (status page)

### Decision Impact Analysis

**Implementation Sequence:**
1. Monorepo scaffold (Turborepo + packages structure)
2. DB schema + Drizzle migrations + RLS policies (`packages/db`)
3. Auth.js v5 + Twitch OAuth (`apps/web`)
4. tRPC router skeleton + Zod env validation
5. GamePlugin contract v1 (`packages/game-types`)
6. Bot-worker skeleton with IChatConnection injection (`apps/bot-worker`)
7. Redis pub/sub plumbing (bot → web server SSE)
8. Overlay SSE route (`apps/web/app/overlay/[token]/route.ts`)
9. Core game engine: Blindtest plugin (`packages/game-engine`)
10. Stripe webhooks + subscription feature gating

**Cross-Component Dependencies:**
- `packages/db` schema must be stable before any app can run migrations
- `packages/game-types` contract must be finalized before bot-worker and web server
  implement their respective sides of the session protocol
- Redis channel naming convention must be agreed before bot-worker and SSE handler
  are implemented (naming drift = silent failure)
- Auth.js session shape (JWT payload) must be stable before tRPC procedures
  implement role-based access control

## Project Context Analysis

### Requirements Overview

**Functional Requirements:**
59 FRs across 10 capability areas drive a multi-layer real-time system. The core
architectural challenge is the dual real-time model: outbound SSE push to overlay
clients (one-to-many broadcast) and inbound chat ingestion at scale (many-to-one
aggregation), both mediated by a stateless bot layer and a shared Redis state store.

Key capability clusters and their architectural weight:
- **Game Engine (FR22-28):** The heaviest architectural surface. The GamePlugin
  contract (ADR-02) defines the extensibility boundary — the core engine must
  remain agnostic of plugin implementations. The contract must be versioned from
  V1 to avoid breaking changes when the plugin marketplace opens in V2.
- **Real-time Overlay (FR34-40):** SSE-based push from server to OBS browser
  source. Overlay data splits into two kinds: *public* (game state, global
  leaderboard — same for all viewers) and *personalized* (viewer rank, score,
  CTA). Architecture must handle this split: one public SSE broadcast stream +
  on-demand API calls for personalized data using a viewer session token.
  A single SSE stream per viewer does not scale to 50k concurrent connections.
- **Session & Bot (FR14-21, FR26-27):** Stateless bot workers with queue
  recovery on reconnect. Session state lives entirely in Redis, not in the bot
  process — this is what enables horizontal scaling and crash resilience. Bot
  workers are a *separate runtime* from the web server, not just a module.
- **Multi-tenant (FR1-8, FR6):** Every FR that touches data implies a
  tenant-scoped query. This is not an opt-in concern — it is the baseline.
- **Subscription & Billing (FR49-53):** Feature gating via role in JWT,
  refreshed on subscription webhook event. 60-second SLA from webhook to access
  update is a hard integration constraint. However, JWT is cached 5 minutes —
  creating a potential stale-access window that must be explicitly resolved
  (accept the gap or implement proactive JWT invalidation on webhook receipt).
- **Admin & Observability (FR54-59):** Real-time monitoring of sessions and bots
  requires a dedicated internal event stream separate from the game overlay stream.

**Non-Functional Requirements:**
NFRs directly constrain architecture choices:
- **NFR-P1 (300ms p95 overlay):** Dictates that SSE fan-out and Redis read
  latency must stay well under 300ms end-to-end — rules out synchronous DB reads
  on the hot path
- **NFR-P2 (100ms msg processing p95):** Bot chat processing must be near
  in-memory; no DB writes on the hot scoring path
- **NFR-P3 (5s reconnect):** Bot reconnect logic must be embedded in the worker
  with exponential backoff, not dependent on an external orchestrator
- **NFR-SC1/SC2 (50k viewers / 10k msg/min):** SSE fan-out requires a
  connection management strategy; chat sampling under extreme load is an explicit
  resilience decision. Single-server SSE may require an edge fan-out layer to
  reach 50k concurrent — this decision can be deferred to V2 with documented
  vertical scaling limits for MVP.
- **NFR-S2 (server-side scoring):** Scoring logic must be unreachable from any
  client path — enforced by architecture, not just convention
- **NFR-S3 (DB-layer isolation):** RLS enforced independently of application
  logic — protects against application bugs, not just malicious actors
- **NFR-R2 (zero score loss on crash):** Bot crash-safety depends on Redis
  persistence configuration (AOF recommended over RDB snapshots for lower RPO).
  Architecture must specify the Redis persistence mode explicitly.

**Scale & Complexity:**
- Primary domain: Full-stack SaaS web (TypeScript — ADR-01)
- Runtime model: **Dual-runtime** — not a pure monolith
  - **Runtime A (Web Server):** HTTP API, SSE overlay broadcast, webhook
    processing, admin panel, dashboard
  - **Runtime B (Bot Workers):** Streaming platform chat connection, message
    ingestion, scoring pipeline, Redis state management — horizontally scalable,
    stateless, separate processes/containers
- Complexity level: High
- Estimated architectural modules: ~12 (Auth, Tenant, Playlist, GameEngine,
  BotWorker, OverlaySSE, Scoring, Leaderboard, ViewerProfile, Subscription,
  AdminPanel, Observability)
- Both runtimes share PostgreSQL and Redis but do not share in-process memory

### Technical Constraints & Dependencies

**Pre-decided (ADRs from PRD frontmatter — non-negotiable):**
- ADR-01: TypeScript dual-runtime architecture for MVP (Web Server + Bot Workers
  as separate processes); microservice extraction deferred
- ADR-02: GamePlugin interface as strict typed contract; plugin contract must be
  versioned from V1 to enable safe evolution; cannot be loosened
- ADR-03: Redis for live state + PostgreSQL flush at session end (weekly games);
  Redis persistence mode (AOF) must be configured — data durability is not implicit
- ADR-04: Scoring 100% server-side; no client-side score path exists
- ADR-05: Twitch/Spotify/YouTube OAuth tokens server-side only; JWT for frontend
- ADR-06: PostgreSQL RLS + tenant_id on every tenant-scoped table

**External Dependency Constraints:**
- Streaming platform chat: server-side tokens, rate limit 800 msg/30s/connection;
  bot workers manage connection lifecycle independently
- Spotify Web Playback SDK: client-side (browser), requires Premium; server-side
  for metadata only
- YouTube iframe API: client-side embed; ContentID failures must be handled
- Stripe/Paddle: webhook-driven role updates (60s SLA); JWT cache (5 min) creates
  a stale-access window that architecture must resolve
- OBS Browser Source: SSE URL pasted directly; zero auth friction required

**Regulatory Constraints:**
- GDPR: right to erasure, 30-day grace period, EU hosting
- DSA: content moderation and flag mechanism at MVP
- PCI-DSS: zero scope (fully delegated to payment provider)

### Cross-Cutting Concerns Identified

1. **Multi-tenancy** — RLS + tenant_id is a baseline assumption for every
   data-touching component; requires a shared middleware/context pattern
2. **Dual-runtime state management** — Redis as the shared state bus between
   runtimes; web server reads game state for SSE broadcast; bot workers write
   game state after scoring; pub/sub required for push notification
3. **Authentication & Authorization (3 layers)** — External OAuth, Application
   JWT (tenantId + role + subscriptionStatus), Database RLS (tenant_id)
4. **SSE overlay data split** — Public game state broadcast vs. personalized
   viewer data (on-demand API fetch) must be cleanly separated
5. **Server-side scoring integrity** — No scoring entry point outside the game
   engine; enforced by architecture, not convention
6. **GamePlugin versioning** — Plugin contract versioning required from V1 to
   protect future marketplace plugins from breaking changes
7. **Observability** — Admin monitoring requires a separate event stream from
   game overlay; bot health events captured independently
8. **JWT invalidation strategy** — 5-min JWT cache vs. 60s webhook processing
   creates a stale-access window; architecture must explicitly choose between
   accepting the gap or implementing proactive invalidation
9. **Dual test harness** — Two runtimes require two distinct testing strategies:
   HTTP/mock-based for the web server; IRC simulation + Redis assertion for
   bot workers
10. **IChatConnection inversion** — Bot-worker must inject the streaming platform
    chat connection via interface (`IChatConnection`), not instantiate it directly;
    enables unit testing of GamePlugins without real IRC connections

## Implementation Patterns & Consistency Rules

_These patterns are enforced across both runtimes and all packages. Deviations require an explicit ADR._

### Naming Patterns

#### Database (PostgreSQL / Drizzle ORM)
- Tables: `snake_case`, plural nouns — e.g., `tenant_sessions`, `game_scores`
- Columns: `snake_case` — e.g., `tenant_id`, `created_at`, `is_active`
- Foreign keys: `{referenced_table_singular}_id` — e.g., `session_id`, `tenant_id`
- Indexes: `idx_{table}_{column(s)}` — e.g., `idx_game_scores_session_id`

#### REST API (public routes, webhooks, overlay)
- Base prefix: `/api/v1/`
- Resource paths: `kebab-case`, plural nouns — e.g., `/api/v1/game-sessions`, `/api/v1/overlay-tokens`
- Webhook paths: `/api/v1/webhooks/{provider}` — e.g., `/api/v1/webhooks/stripe`
- Response envelope (single): `{ data: T }`
- Response envelope (paginated): `{ data: T[], meta: { total: number, page: number, limit: number } }`
- Error response: `{ error: { code: string, message: string } }`

#### tRPC (dashboard API)
- Routers: `camelCase`, domain-grouped nouns — `sessionRouter`, `gameRouter`, `tenantRouter`
- Procedures: `verb + Noun` camelCase — `sessionRouter.create`, `sessionRouter.getById`, `gameRouter.listPlugins`
- Router files location: `apps/web/server/api/routers/{domain}.router.ts`
- Root router: `apps/web/server/api/root.ts`

#### TypeScript Files & Directories
- React components: `PascalCase.tsx` — e.g., `SessionCard.tsx`, `LeaderboardTable.tsx`
- Utility/helper files: `kebab-case.ts` — e.g., `format-score.ts`, `parse-chat-message.ts`
- Interface files: `PascalCase.ts` prefixed with `I` — e.g., `IChatConnection.ts`
- Test files: `{filename}.test.ts` co-located with source
- Server route files (Next.js): `route.ts` (API), `page.tsx` (UI)

### Structure Patterns

#### File Organization
- Tests: co-located with source (`*.test.ts` next to source file) — not in a separate `__tests__` directory
- Component organization: flat within each route segment at MVP; add feature subdirectories only when a route exceeds 10 components
  - e.g., `app/(dashboard)/sessions/components/` — flat list, not `components/session-card/`
- tRPC routers: one file per domain, domain-grouped not feature-grouped
  - `session.router.ts`, `game.router.ts`, `tenant.router.ts` — not `dashboard/session.router.ts`

#### Package Boundaries (strictly enforced)
- `packages/game-types` — shared by both runtimes; contains interfaces and Zod schemas only; no runtime logic
- `packages/game-engine` — bot-worker **only** (`apps/bot-worker`); never imported by `apps/web`
- `packages/db` — Drizzle schema + migrations; imported by both runtimes for type safety; migration CLI runs via `drizzle-kit migrate` explicitly
- `packages/shared` — Zod schemas, constants, env validation, utility functions; no framework-specific code

### Format Patterns

#### Identifiers
- Entity IDs (DB primary keys): UUID v4 string — `crypto.randomUUID()`; never integer auto-increment
- Session join codes (human-readable, user-typed): `nanoid(6)` — uppercase alphanumeric, e.g., `ABC123`; distinct from entity UUIDs
- Overlay tokens: UUID v4 (non-guessable, not human-typed)

#### Timestamps & Dates
- All timestamps: ISO 8601 UTC string — `new Date().toISOString()` → `"2026-03-07T10:00:00.000Z"`
- DB columns: `timestamp with time zone` (Drizzle: `timestamp({ withTimezone: true })`)
- Never: Unix epoch integers or locale-specific date strings

#### Redis Event Types
- Format: `SCREAMING_SNAKE_CASE` — e.g., `SCORE_UPDATED`, `SESSION_ENDED`, `PLAYER_JOINED`
- Redis channel naming: `game:{tenantId}:{sessionId}:state-update`
- Wildcard subscription pattern for bot-workers: `PSUBSCRIBE game:{tenantId}:*`
- Admin event channel: `admin:{tenantId}:session-monitor` (separate from game overlay)

### Communication Patterns

#### Auth Method by Route Type

| Route Type | Auth Method | Notes |
|------------|-------------|-------|
| Next.js dashboard routes (`/(dashboard)/*`) | Auth.js middleware (`middleware.ts`) | Session cookie check at edge |
| tRPC procedures (dashboard API) | `protectedProcedure` middleware | Role/subscription check at procedure level |
| Overlay route (`/overlay/[token]/*`) | Bearer token in URL param | No session cookie; token validated in route handler |
| Webhooks (`/api/v1/webhooks/*`) | HMAC signature validation | No session auth; Stripe/Twitch HMAC middleware |
| Public API (`/api/v1/public/*`) | Rate limit only (Upstash) | No user auth required |

**Rule:** Both middleware + `protectedProcedure` are required for dashboard tRPC routes — middleware blocks unauthenticated requests at the route segment level; `protectedProcedure` enforces role checks at the procedure level. Neither alone is sufficient.

#### Redis Pub/Sub
- Publisher: bot-worker (after scoring pipeline)
- Subscriber: web server SSE handler (fan-out to overlay clients)
- Subscribe pattern: `PSUBSCRIBE game:{tenantId}:*` (wildcard, not `SUBSCRIBE` with hardcoded channel)

#### SSE Events
- Event names: `kebab-case` — e.g., `score-updated`, `session-ended`, `reveal-triggered`
- Event data: JSON-stringified object matching the `GameStateEvent` type in `packages/game-types`

#### GamePlugin Contract
- Interface frozen at v1 for MVP — no modifications without a new ADR
- `IChatConnection` injected via constructor/factory, never instantiated inside a plugin
- Test double: `MockChatConnection implements IChatConnection` — standard class-based mock, not jest auto-mock

### Process Patterns

#### Error Handling
- tRPC procedures: throw `TRPCError` with appropriate `code` — never raw `Error`
- Next.js REST route handlers: return `NextResponse.json({ error: ... }, { status: N })`
- Bot-worker unhandled errors: log via structured logger + emit `BOT_ERROR` event to admin channel; never `process.exit()`

#### Environment Variables
- Access: always via `env.VARIABLE_NAME` from `packages/shared/env.ts` — never `process.env.VARIABLE_NAME` in business logic
- Validation: Zod schema at process startup; missing required vars crash the process immediately
- Required vars: `DATABASE_URL`, `REDIS_URL`, `AUTH_SECRET`, `TOKEN_ENCRYPTION_KEY` (64-char hex), `TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET`

#### Logging
- Package: **Pino** (`pino` + `pino-pretty` for local dev) — lightweight, JSON-native, Railway stdout-compatible
- Usage: `logger.info({ tenantId, sessionId }, 'Session started')` — structured fields, not string interpolation
- Never: `console.log`, `console.error` in production code paths
- Bot-worker: separate Pino instance with `{ runtime: 'bot-worker' }` base field

#### OAuth Token Security
- Storage: AES-256-GCM encrypted at rest; key from `TOKEN_ENCRYPTION_KEY` env var
- Transport: never sent to client; server-side only
- Frontend auth: httpOnly cookie JWT only; payload `{ tenantId, role, subscriptionStatus, exp }`

### Anti-Patterns (Forbidden)

| Anti-Pattern | Correct Pattern |
|---|---|
| `process.env.X` in business logic | `env.X` from `packages/shared/env.ts` |
| `console.log(...)` in any file | `logger.info(...)` via Pino |
| Scoring logic in `apps/web` | Scoring pipeline in `apps/bot-worker` only (ADR-04) |
| Direct DB access in bot-worker hot path | Redis read/write on hot path; DB only at session start/end |
| Integer auto-increment IDs | UUID v4 via `crypto.randomUUID()` |
| Unix epoch timestamps | ISO 8601 UTC strings |
| `game-engine` package imported in `apps/web` | `game-types` only (ADR-04) |
| SUBSCRIBE with hardcoded Redis channel in bot-worker | PSUBSCRIBE with wildcard pattern |
| `jest.mock()` auto-mock for IChatConnection | `MockChatConnection implements IChatConnection` class |
| Feature-grouped tRPC router files | Domain-grouped router files |

## Project Structure & Boundaries

### Requirements to Structure Mapping

| FR Category | DB Schema | tRPC Router | App Directory |
|---|---|---|---|
| FR1-8 Tenant/User | `schema/tenants.ts` | `tenant.router.ts` | `(dashboard)/settings/` |
| FR9-13 Content/Playlists | `schema/playlists.ts` | `playlist.router.ts` | `(dashboard)/playlists/` |
| FR14-21 Sessions | `schema/sessions.ts` | `session.router.ts` | `(dashboard)/sessions/` + `apps/bot-worker/src/engine/` |
| FR22-28 Game Engine | — | `game.router.ts` | `packages/game-engine/` (bot-worker) + `packages/game-types/` (shared) |
| FR34-40 Overlay/SSE | — | — | `app/overlay/[token]/route.ts` + `server/redis/sse-subscriber.ts` |
| FR41-48 Viewer Profile | `schema/viewers.ts` | — | `app/api/v1/viewers/[token]/route.ts` |
| FR49-53 Subscription | `schema/subscriptions.ts` | `subscription.router.ts` | `app/api/v1/webhooks/stripe/route.ts` |
| FR54-59 Admin | — | `admin.router.ts` | `(dashboard)/admin/` |

### Complete Project Directory Structure

```
playground/
├── .github/
│   └── workflows/
│       ├── ci.yml                          # PR: type-check + test only
│       └── deploy.yml                      # main: test → build → Railway deploy
├── .env.example                            # All required vars documented
├── .gitignore
├── README.md
├── docker-compose.yml                      # Local dev: PostgreSQL + Redis
├── turbo.json                              # Pipeline: build, test, type-check
├── package.json                            # pnpm workspace root
├── pnpm-workspace.yaml
│
├── apps/
│   │
│   ├── web/                                # Runtime A — Next.js 15 App Router
│   │   ├── package.json
│   │   ├── next.config.ts
│   │   ├── tsconfig.json
│   │   ├── tailwind.config.ts
│   │   ├── postcss.config.js
│   │   ├── middleware.ts                   # Auth.js session guard (dashboard segments)
│   │   ├── sentry.client.config.ts
│   │   ├── sentry.server.config.ts
│   │   ├── Dockerfile                      # Multi-stage build for Railway
│   │   └── src/
│   │       ├── app/
│   │       │   ├── globals.css
│   │       │   ├── layout.tsx
│   │       │   │
│   │       │   ├── (public)/               # No auth required
│   │       │   │   ├── page.tsx            # Landing page
│   │       │   │   ├── pricing/
│   │       │   │   │   └── page.tsx
│   │       │   │   └── auth/
│   │       │   │       ├── signin/page.tsx
│   │       │   │       └── error/page.tsx
│   │       │   │
│   │       │   ├── (dashboard)/            # Auth-gated by middleware.ts
│   │       │   │   ├── layout.tsx
│   │       │   │   ├── page.tsx            # Dashboard home
│   │       │   │   │
│   │       │   │   ├── sessions/           # FR14-21: session management
│   │       │   │   │   ├── page.tsx
│   │       │   │   │   ├── [id]/page.tsx   # Detail + leaderboard (FR35-40)
│   │       │   │   │   └── components/
│   │       │   │   │       ├── SessionCard.tsx
│   │       │   │   │       ├── SessionControls.tsx   # Start/stop/reveal (FR26-27)
│   │       │   │   │       └── LeaderboardTable.tsx  # FR35 (refetchInterval: 1000)
│   │       │   │   │
│   │       │   │   ├── playlists/          # FR9-13: content management
│   │       │   │   │   ├── page.tsx
│   │       │   │   │   ├── [id]/page.tsx   # Playlist editor
│   │       │   │   │   └── components/
│   │       │   │   │       ├── PlaylistCard.tsx
│   │       │   │   │       └── TrackEditor.tsx
│   │       │   │   │
│   │       │   │   ├── overlay/
│   │       │   │   │   └── page.tsx        # Overlay setup + OBS URL copy (FR34, FR41)
│   │       │   │   │
│   │       │   │   ├── settings/           # FR4-8: tenant settings
│   │       │   │   │   ├── page.tsx
│   │       │   │   │   └── components/
│   │       │   │   │       ├── ProfileForm.tsx
│   │       │   │   │       └── SubscriptionPanel.tsx  # FR49-53
│   │       │   │   │
│   │       │   │   └── admin/              # FR54-59: super-admin only
│   │       │   │       ├── page.tsx
│   │       │   │       └── components/
│   │       │   │           ├── SessionMonitor.tsx
│   │       │   │           └── BotHealthDashboard.tsx
│   │       │   │
│   │       │   ├── overlay/
│   │       │   │   └── [token]/            # OBS Browser Source endpoint
│   │       │   │       ├── page.tsx        # Overlay UI (FR34-40, FR42-48)
│   │       │   │       └── route.ts        # SSE — runtime='nodejs', dynamic='force-dynamic'
│   │       │   │
│   │       │   └── api/
│   │       │       ├── auth/[...nextauth]/route.ts     # Auth.js v5 handler
│   │       │       ├── trpc/[trpc]/route.ts            # tRPC HTTP handler
│   │       │       └── v1/
│   │       │           ├── webhooks/
│   │       │           │   ├── stripe/route.ts         # FR49-53: subscription events
│   │       │           │   └── twitch/route.ts         # Twitch EventSub
│   │       │           ├── overlay-tokens/route.ts     # POST: generate overlay token (FR41)
│   │       │           └── viewers/
│   │       │               └── [token]/route.ts        # GET: viewer personalized data (FR42-48)
│   │       │
│   │       ├── server/
│   │       │   ├── auth.ts                 # Auth.js v5 config (Twitch OAuth, JWT shape)
│   │       │   ├── api/
│   │       │   │   ├── root.ts             # tRPC root router (merges all domain routers)
│   │       │   │   ├── trpc.ts             # createTRPCRouter, protectedProcedure, context
│   │       │   │   └── routers/
│   │       │   │       ├── session.router.ts       # FR14-21
│   │       │   │       ├── game.router.ts          # FR22-28
│   │       │   │       ├── playlist.router.ts      # FR9-13
│   │       │   │       ├── tenant.router.ts        # FR1-8
│   │       │   │       ├── subscription.router.ts  # FR49-53
│   │       │   │       └── admin.router.ts         # FR54-59
│   │       │   └── redis/
│   │       │       ├── client.ts           # ioredis singleton
│   │       │       └── sse-subscriber.ts   # PSUBSCRIBE game:{tenantId}:* → SSE fan-out
│   │       │
│   │       ├── components/
│   │       │   ├── ui/                     # shadcn/ui primitives
│   │       │   └── layout/
│   │       │       ├── DashboardNav.tsx
│   │       │       └── PageHeader.tsx
│   │       │
│   │       ├── hooks/
│   │       │   ├── useSessionSSE.ts        # EventSource client hook (overlay page)
│   │       │   └── useTRPC.ts              # TanStack Query v5 + tRPC typed hooks
│   │       │
│   │       ├── lib/
│   │       │   ├── trpc/client.ts          # tRPC client + TanStack Query provider
│   │       │   ├── rate-limit.ts           # Upstash: 60/min public, 300/min dashboard
│   │       │   ├── webhook-verify.ts       # HMAC-SHA256 (Stripe + Twitch)
│   │       │   └── overlay-token.ts        # nanoid overlay token generation/validation
│   │       │
│   │       └── types/
│   │           └── next-auth.d.ts          # JWT: tenantId, role, subscriptionStatus
│   │
│   └── bot-worker/                         # Runtime B — stateless Node.js process
│       ├── package.json
│       ├── tsconfig.json
│       ├── Dockerfile                      # Separate Railway service
│       └── src/
│           ├── index.ts                    # Bootstrap: load env → start worker
│           ├── worker.ts                   # Lifecycle: connect → run → reconnect (NFR-P3)
│           ├── connections/
│           │   ├── IChatConnection.ts      # Interface (injectable)
│           │   ├── TwitchChatConnection.ts # Concrete Twitch IRC impl
│           │   └── MockChatConnection.ts   # Test double
│           ├── engine/
│           │   ├── session-runner.ts       # Session lifecycle orchestration
│           │   ├── scoring-pipeline.ts     # Server-side scoring (ADR-04)
│           │   └── redis-state.ts          # Redis R/W + PUBLISH events
│           └── __tests__/
│               ├── session-runner.test.ts  # Testcontainers real Redis
│               └── scoring-pipeline.test.ts
│
└── packages/
    │
    ├── db/                                 # Drizzle ORM + PostgreSQL
    │   ├── package.json
    │   ├── tsconfig.json
    │   ├── drizzle.config.ts
    │   ├── src/
    │   │   ├── index.ts
    │   │   ├── client.ts                   # Drizzle + postgres.js client
    │   │   ├── schema/
    │   │   │   ├── tenants.ts              # FR1-8
    │   │   │   ├── playlists.ts            # FR9-13
    │   │   │   ├── sessions.ts             # FR14-21
    │   │   │   ├── games.ts                # FR22-28
    │   │   │   ├── viewers.ts              # FR41-48
    │   │   │   └── subscriptions.ts        # FR49-53
    │   │   └── policies/
    │   │       └── rls.ts                  # pgPolicy RLS per table (ADR-06)
    │   └── migrations/                     # drizzle-kit generate output (explicit only)
    │
    ├── game-types/                         # Shared contracts — both runtimes
    │   ├── package.json
    │   ├── tsconfig.json
    │   └── src/
    │       ├── index.ts
    │       ├── plugin.interface.ts         # GamePlugin v1 (ADR-02)
    │       ├── context.types.ts            # GamePluginContext
    │       ├── events.types.ts             # GameStateEvent + SCREAMING_SNAKE_CASE union
    │       └── session.types.ts            # ChatMessage, StreamerAction, SessionConfig
    │
    ├── game-engine/                        # ⚠️ bot-worker ONLY
    │   ├── package.json
    │   ├── tsconfig.json
    │   └── src/
    │       ├── index.ts
    │       ├── plugin-registry.ts          # Plugin loading + version validation
    │       └── plugins/
    │           └── blindtest/
    │               ├── index.ts            # BlindtestPlugin implements GamePlugin
    │               ├── scorer.ts           # Title/artist matching + scoring
    │               └── scorer.test.ts
    │
    └── shared/                             # Framework-agnostic utilities
        ├── package.json
        ├── tsconfig.json
        └── src/
            ├── index.ts
            ├── env.ts                      # Zod env schema (crashes on missing vars)
            ├── constants.ts                # REDIS_CHANNEL_PREFIX, SESSION_STATES
            ├── schemas/
            │   ├── session.schema.ts
            │   ├── playlist.schema.ts
            │   └── tenant.schema.ts
            └── utils/
                ├── id.ts                   # randomUUID() + nanoid(6)
                ├── date.ts                 # ISO 8601 helpers
                └── encrypt.ts              # AES-256-GCM
```

### Architectural Boundaries

#### API Boundaries

| Surface | Protocol | Auth | Location |
|---|---|---|---|
| Dashboard CRUD | tRPC v11 | `protectedProcedure` + middleware | `server/api/routers/` |
| Overlay SSE stream | Server-Sent Events | Bearer token (URL param) | `app/overlay/[token]/route.ts` |
| Viewer personalized data | REST GET | Bearer token | `app/api/v1/viewers/[token]/route.ts` |
| Overlay token generation | REST POST | Session cookie | `app/api/v1/overlay-tokens/route.ts` |
| Stripe webhook | REST POST | HMAC-SHA256 | `app/api/v1/webhooks/stripe/route.ts` |
| Twitch EventSub | REST POST | HMAC-SHA256 | `app/api/v1/webhooks/twitch/route.ts` |
| Inter-runtime events | Redis pub/sub | Internal network | `bot-worker/src/engine/redis-state.ts` |

#### Data Flow

```
Twitch Chat (IRC, 800 msg/30s limit)
    │
    ▼
apps/bot-worker → TwitchChatConnection.onMessage()
    │
    ▼
game-engine: BlindtestPlugin.onChatMessage()
    │ scoring-pipeline.ts (server-side only — ADR-04)
    ▼
redis-state.ts
    ├── HSET  game:{tenantId}:{sessionId}  (state update)
    └── PUBLISH  game:{tenantId}:{sessionId}:state-update  (event)
         │
         ▼
apps/web: sse-subscriber.ts
    └── PSUBSCRIBE game:{tenantId}:*
         │
         ▼
overlay/[token]/route.ts → SSE → OBS Browser Source
```

#### Component Communication Rules

- **Dashboard UI → API:** TanStack Query v5 + tRPC only (`refetchInterval: 3000` default; `1000` for active leaderboard)
- **Overlay → Server:** `EventSource` (public game state) + separate REST fetch (personalized viewer data)
- **Bot-worker → Web server:** Redis pub/sub exclusively — no direct HTTP between runtimes
- **Package imports:** `game-types` and `shared` — both runtimes; `game-engine` — bot-worker only; `db` — both (types), migrations from `packages/db`

#### Data Boundaries

- **Hot path (active scoring):** Redis only — no DB writes during session scoring
- **Cold path (persistence):** PostgreSQL flush at session end via `onSessionEnd`
- **Tenant isolation:** RLS via `pgPolicy` on all tenant-scoped tables (ADR-06) — enforced at DB layer independently
- **OAuth tokens:** AES-256-GCM encrypted in `tenants.oauth_tokens` — never leaves server

## Architecture Validation Results

### Coherence Validation

**Decision Compatibility:** All 9 technology pairs validated — no conflicts identified. Next.js 15 App Router, tRPC v11, Auth.js v5, Drizzle + pgPolicy, ioredis PSUBSCRIBE, TanStack Query v5, Pino, Sentry v8, and Upstash Rate Limit are all mutually compatible.

**Pattern Consistency:** Naming conventions (DB/REST/tRPC/TypeScript) are internally consistent with no overlapping scopes. Error handling is scoped correctly — `TRPCError` for tRPC procedures, `NextResponse` for REST handlers. Auth method decision table assigns exactly one method per route type — no ambiguity.

**Structure Alignment:** Package boundaries are structurally enforced (`game-engine` in separate package, not import convention). SSE critical config is documented at the exact file path. tRPC router domain-grouping matches naming pattern rule.

### Requirements Coverage Validation

**Functional Requirements:** All 8 FR groups (FR1-59) have explicit architectural support — DB schema, tRPC router, and app directory location documented for each. No orphaned requirements.

**Non-Functional Requirements:** All 9 NFRs have direct architectural coverage — Redis hot path for latency NFRs, bot-worker reconnect for availability NFR, pgPolicy RLS for security NFR, Redis AOF for durability NFR.

**Regulatory:** GDPR covered via AES-256-GCM token encryption + tenant RLS isolation. DSA noted. PCI-DSS out of scope (Stripe handles fully).

### Gap Analysis Results

**Important gaps resolved:**

**G1 — Test Runner: Vitest** (`vitest` + `@vitest/coverage-v8`)
- Native ESM, no transform config required for TypeScript
- `describe`/`it`/`expect` API — Jest-compatible syntax
- Testcontainers works with Vitest (bot-worker integration tests)
- Turborepo `test` pipeline task: `vitest run` (CI), `vitest` (watch)

**G2 — Turbo pipeline tasks:**
```json
{
  "pipeline": {
    "build":        { "dependsOn": ["^build"], "outputs": [".next/**", "dist/**"] },
    "test":         { "dependsOn": ["^build"], "cache": false },
    "lint":         {},
    "type-check":   { "dependsOn": ["^build"] },
    "db:generate":  { "cache": false },
    "db:migrate":   { "cache": false, "dependsOn": ["^build"] }
  }
}
```

**Minor gaps resolved:**

**G3 — Payment provider:** **Stripe** confirmed for MVP. Paddle deferred to V2 if multi-currency/tax handling becomes a priority.

**G4 — Session join code character set:** `nanoid(6)` with custom alphabet `'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'` — excludes ambiguous characters `0`, `O`, `1`, `I` for on-stream readability.

**G5 — Admin panel refetchInterval:** `refetchInterval: 5000` for session monitor and bot health dashboard (lower urgency than active game leaderboard).

### Architecture Completeness Checklist

**Requirements Analysis**
- [x] Project context thoroughly analyzed (59 FRs, 10 areas, 10 NFRs)
- [x] Scale and complexity assessed (dual-runtime, high complexity)
- [x] Technical constraints identified (6 ADRs, 3 external constraints, 3 regulatory)
- [x] Cross-cutting concerns mapped (10 concerns)

**Architectural Decisions**
- [x] All 6 ADRs documented with explicit technology versions
- [x] Full technology stack specified (Next.js 15, tRPC v11, Auth.js v5, Drizzle, ioredis, TanStack Query v5, Pino, Vitest)
- [x] Integration patterns defined (tRPC, REST, SSE, Redis pub/sub)
- [x] Performance considerations addressed (Redis hot path, SSE fan-out, bot reconnect)

**Implementation Patterns**
- [x] Naming conventions: DB, REST API, tRPC, TypeScript files
- [x] Structure patterns: co-location, feature organization, package boundaries
- [x] Format patterns: UUID v4, nanoid(6) join codes, ISO 8601, Redis event types
- [x] Communication patterns: auth decision table, Redis PSUBSCRIBE, SSE events, GamePlugin contract
- [x] Process patterns: error handling, env access, logging (Pino), OAuth security
- [x] Anti-patterns list: 10 forbidden patterns with correct alternatives

**Project Structure**
- [x] Complete directory structure defined (all files and directories)
- [x] Component boundaries established (package import rules)
- [x] Integration points mapped (API boundary table, data flow diagram)
- [x] All 8 FR groups mapped to specific files and directories

### Architecture Readiness Assessment

**Overall Status: READY FOR IMPLEMENTATION**

**Confidence Level: High**

**Key Strengths:**
- Dual-runtime separation is explicit and enforced structurally (not by convention)
- All 6 ADRs from PRD are fully implemented in the architecture
- Auth decision table eliminates the most common source of implementation inconsistency
- IChatConnection injection enables bot-worker testing without real Twitch connections
- Redis AOF + session-end DB flush satisfies NFR-R2 without sacrificing hot-path performance
- Package boundary enforcement (`game-engine` isolation) prevents scoring logic from leaking to web server

**Areas for Future Enhancement (V2):**
- Edge fan-out layer if 50k+ concurrent SSE connections required (beyond single-server limits)
- Proactive JWT invalidation on subscription webhook (eliminate 5-min stale window)
- Plugin marketplace: public plugin registry with version compatibility matrix
- Paddle as alternative payment provider for multi-currency/EU tax scenarios

### Implementation Handoff

**AI Agent Guidelines:**
- Follow all architectural decisions exactly as documented — deviations require a new ADR
- Use implementation patterns consistently — refer to the Anti-Patterns table as a checklist
- Respect package boundaries — `game-engine` import in `apps/web` is a build error, not a convention
- All DB migrations run explicitly via `pnpm db:migrate` — never auto-migrate
- Both auth layers are mandatory for tRPC dashboard routes — middleware alone is insufficient

**First Implementation Steps (in order):**
1. `pnpm dlx create-turbo@latest` — scaffold monorepo
2. Configure `turbo.json` pipeline (G2 resolution above)
3. Create `packages/shared/src/env.ts` (Zod schema) — required by all subsequent packages
4. Create `packages/db` schema + `drizzle.config.ts` + run `db:generate` + `db:migrate`
5. Configure Auth.js v5 + Twitch OAuth in `apps/web/server/auth.ts`
6. Scaffold tRPC root router + `protectedProcedure` in `apps/web/server/api/`
7. Implement `packages/game-types` (GamePlugin v1 contract + event types)
8. Implement `apps/bot-worker` skeleton with `IChatConnection` injection
9. Wire Redis pub/sub: `redis-state.ts` (publisher) + `sse-subscriber.ts` (subscriber)
10. Implement `app/overlay/[token]/route.ts` SSE endpoint

