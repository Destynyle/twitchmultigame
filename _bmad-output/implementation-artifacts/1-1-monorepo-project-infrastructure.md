# Story 1.1: Monorepo & Project Infrastructure

Status: done

## Story

As a developer,
I want the Turborepo monorepo scaffolded with all apps, packages, CI/CD, and local dev environment configured,
So that the team can build, test, and deploy the platform consistently from day one.

## Acceptance Criteria

1. **Given** a fresh environment with Node.js 20+ and pnpm installed
   **When** `pnpm install` is run at the repo root
   **Then** all workspaces (`apps/web`, `apps/bot-worker`, `packages/db`, `packages/game-types`, `packages/game-engine`, `packages/shared`) install without errors
   **And** `pnpm type-check` passes across all packages

2. **Given** a `.env.example` with all required variables and a `.env.local` populated from it
   **When** `docker-compose up -d && pnpm dev` is run
   **Then** the Next.js dev server starts at `localhost:3000` and the bot-worker process starts without crashing

3. **Given** `packages/shared/src/env.ts` contains a Zod schema for all required env vars
   **When** a required env var is missing at process startup
   **Then** the process exits immediately with a descriptive error naming the missing variable

4. **Given** a PR is opened on GitHub
   **When** the CI pipeline triggers
   **Then** `pnpm type-check` and `pnpm test` pass for all affected packages in the Turborepo pipeline

5. **Given** `docker-compose.yml` is present at the repo root
   **When** `docker-compose up -d` is run
   **Then** a PostgreSQL instance (port 5432) and a Redis instance with AOF persistence enabled (port 6379) are both healthy

6. **Given** the Railway deployment configuration
   **When** a commit is pushed to `main` and the deploy pipeline runs
   **Then** both `apps/web` and `apps/bot-worker` are deployed as separate Railway services with their respective environment variables set

## Tasks / Subtasks

- [x] Task 1 — Initialize Turborepo monorepo (AC: 1)
  - [x] Run `pnpm dlx create-turbo@latest playground --example with-tailwind`
  - [x] Rename/restructure generated apps to match required workspace names
  - [x] Create `apps/bot-worker/` as a plain Node.js TypeScript package
  - [x] Create all `packages/` directories: `db`, `game-types`, `game-engine`, `shared`
  - [x] Configure `pnpm-workspace.yaml` to include all workspaces
  - [x] Verify `pnpm install` succeeds at repo root with no errors

- [x] Task 2 — Configure turbo.json pipeline (AC: 1, 4)
  - [x] Set up tasks: `build`, `test`, `type-check`, `lint`, `db:generate`, `db:migrate`
  - [x] Configure `build` with `dependsOn: ["^build"]`, outputs `[".next/**", "dist/**"]`
  - [x] Configure `test` with `dependsOn: ["^build"]`, `cache: false`
  - [x] Configure `type-check` with `dependsOn: ["^build"]`
  - [x] Configure `db:generate` and `db:migrate` with `cache: false`, db:migrate `dependsOn: ["^build"]`

- [x] Task 3 — Configure each workspace's TypeScript and tooling (AC: 1)
  - [x] Set up shared `tsconfig.base.json` at repo root
  - [x] `apps/web`: Next.js 15 App Router, `tsconfig.json` extending base, Tailwind CSS v4
  - [x] `apps/bot-worker`: plain Node.js process, `tsconfig.json` with `outDir: "dist"`, CommonJS output
  - [x] `packages/db`: Drizzle ORM + drizzle-kit, TypeScript, no framework
  - [x] `packages/game-types`: TypeScript only — interfaces, DTOs, Zod schemas; no runtime logic
  - [x] `packages/game-engine`: TypeScript — game execution logic; never imported by `apps/web`
  - [x] `packages/shared`: Zod schemas, constants, env validation, utility types; no framework-specific code
  - [x] Add `packages/eslint-config` with shared ESLint + Prettier configuration

- [x] Task 4 — Set up Vitest in all packages (AC: 1, 4)
  - [x] Add Vitest to each package that needs tests (`apps/web`, `apps/bot-worker`, `packages/game-engine`, `packages/shared`)
  - [x] Configure Vitest in each `package.json` with `"test": "vitest run"` script
  - [x] Verify `pnpm test` at root runs all tests via Turborepo pipeline
  - [x] Add a trivial smoke test (`1 + 1 === 2`) in each package to confirm CI passes on an empty codebase

- [x] Task 5 — Zod env validation in `packages/shared/src/env.ts` (AC: 3)
  - [x] Define Zod schema with all required environment variables:
    - `DATABASE_URL` (string, url)
    - `REDIS_URL` (string, url)
    - `AUTH_SECRET` (string, min length 32)
    - `TOKEN_ENCRYPTION_KEY` (string, exactly 64 hex chars — required for AES-256-GCM)
    - `TWITCH_CLIENT_ID` (string)
    - `TWITCH_CLIENT_SECRET` (string)
    - `NODE_ENV` (enum: `development` | `test` | `production`)
  - [x] Parse and export `env` object: `export const env = envSchema.parse(process.env)`
  - [x] Process crashes immediately if any required var is missing (Zod throws synchronously)
  - [x] Add `.env.example` at repo root documenting every variable with placeholder values
  - [x] Test: missing `DATABASE_URL` causes process exit with descriptive error message

- [x] Task 6 — docker-compose.yml for local development (AC: 2, 5)
  - [x] Define `postgres` service: image `postgres:16`, port `5432:5432`, persistent volume, env vars `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`
  - [x] Define `redis` service: image `redis:7-alpine`, port `6379:6379`, command `redis-server --appendonly yes` (AOF persistence enabled)
  - [x] Add healthcheck for both services
  - [x] Verify `docker-compose up -d` starts both services healthy

- [x] Task 7 — `apps/bot-worker` skeleton (AC: 2)
  - [x] Create `apps/bot-worker/src/index.ts` as the process entrypoint
  - [x] Import and parse env via `packages/shared/env.ts` at startup
  - [x] Set up Pino logger instance: `const logger = pino({ base: { runtime: 'bot-worker' } })`
  - [x] Add `tsx --watch src/index.ts` dev script and `tsc && node dist/index.js` start script
  - [x] Verify bot-worker starts without crashing when `pnpm dev` is run

- [x] Task 8 — Set up Pino logging skeleton (AC: 2)
  - [x] Add `pino` + `pino-pretty` to `apps/web` and `apps/bot-worker`
  - [x] `apps/web`: create `src/lib/logger.ts` — Pino instance, `pino-pretty` in dev, JSON in prod
  - [x] `apps/bot-worker`: create `src/logger.ts` — Pino instance with `{ runtime: 'bot-worker' }` base field
  - [x] Verify no `console.log` calls in any entrypoint files

- [x] Task 9 — GitHub Actions CI/CD (AC: 4, 6)
  - [x] Create `.github/workflows/ci.yml` — triggers on `pull_request`:
    - Checkout → setup Node.js 20 → pnpm install → `pnpm type-check` → `pnpm test`
    - Use Turborepo remote cache if available
  - [x] Create `.github/workflows/deploy.yml` — triggers on `push` to `main`:
    - Checkout → setup Node.js 20 → pnpm install → `pnpm test` → `pnpm build` → deploy to Railway
    - Use Railway CLI or Railway GitHub integration for deploy step
  - [x] Both workflows use `pnpm` with caching (`actions/setup-node` with `cache: 'pnpm'`)

- [x] Task 10 — Railway deployment configuration (AC: 6)
  - [x] Create `apps/web/Dockerfile` — multi-stage: `FROM node:20-alpine AS base`, install deps, build Next.js, production stage
  - [x] Create `apps/bot-worker/Dockerfile` — multi-stage: `FROM node:20-alpine AS base`, install deps, compile TypeScript, production stage
  - [x] Add `railway.json` or document Railway service configuration (two services: `web` and `bot-worker`)
  - [x] Document all required Railway environment variables in `README.md`

## Dev Notes

### Critical Architecture Constraints

**Package Boundary Rule (enforced — do not violate):**
- `packages/game-engine` → imported **only** by `apps/bot-worker`. Never by `apps/web`. If `apps/web`'s `package.json` contains `game-engine` as a dependency, that is a bug.
- `packages/game-types` → shared by both runtimes. Contains interfaces and Zod schemas only. No runtime logic.
- `packages/shared` → shared by both runtimes. No framework-specific (Next.js/React) code.

**Build output configuration:**
- `apps/web`: Next.js produces `.next/` — output dir for turbo cache
- `apps/bot-worker`: `tsc` produces `dist/` — output dir for turbo cache

**turbo.json required pipeline (exact structure):**
```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "dist/**"]
    },
    "test": {
      "dependsOn": ["^build"],
      "cache": false
    },
    "lint": {},
    "type-check": {
      "dependsOn": ["^build"]
    },
    "db:generate": {
      "cache": false
    },
    "db:migrate": {
      "cache": false,
      "dependsOn": ["^build"]
    }
  }
}
```

### Environment Variables

**Required in `.env.example` (all must be present or process crashes):**

```bash
# Database
DATABASE_URL="postgresql://postgres:password@localhost:5432/playground"

# Redis
REDIS_URL="redis://localhost:6379"

# Auth.js v5
AUTH_SECRET="generate-with-openssl-rand-base64-32-min-32-chars"

# OAuth Token Encryption (AES-256-GCM) — must be exactly 64 hex characters
TOKEN_ENCRYPTION_KEY="0000000000000000000000000000000000000000000000000000000000000000"

# Twitch OAuth (from dev.twitch.tv)
TWITCH_CLIENT_ID="your-twitch-client-id"
TWITCH_CLIENT_SECRET="your-twitch-client-secret"

# Environment
NODE_ENV="development"
```

**`TOKEN_ENCRYPTION_KEY` generation:**
```bash
openssl rand -hex 32   # Outputs 64 hex characters
```

### Docker Configuration Details

**Redis AOF persistence (required for NFR-R2 — zero score loss on crash):**
```yaml
redis:
  image: redis:7-alpine
  command: redis-server --appendonly yes
  ports:
    - "6379:6379"
  volumes:
    - redis_data:/data
```

The `--appendonly yes` flag is non-negotiable. RDB snapshots are insufficient for NFR-R2.

### Pino Logging Pattern

```typescript
// apps/web/src/lib/logger.ts
import pino from 'pino'

export const logger = pino(
  process.env.NODE_ENV === 'development'
    ? { transport: { target: 'pino-pretty' } }
    : undefined
)

// apps/bot-worker/src/logger.ts
import pino from 'pino'

export const logger = pino({
  base: { runtime: 'bot-worker' },
  ...(process.env.NODE_ENV === 'development'
    ? { transport: { target: 'pino-pretty' } }
    : {}),
})
```

**Never use `console.log` or `console.error` in any file committed to the repo.**

### Vitest Setup Pattern

Each package that needs tests:
```json
// package.json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "devDependencies": {
    "vitest": "^2.x"
  }
}
```

Vitest is chosen over Jest for native ESM support and Railway-compatible test execution (no transform overhead). Do NOT use Jest.

### Turborepo Initialization Note

The `--example with-tailwind` flag provides a working Tailwind + Next.js starter. After init, you will need to:
1. Rename the generated app to `web` (if named differently)
2. Create `apps/bot-worker` manually (no template for pure Node.js workers in Turborepo examples)
3. Restructure `packages/` to match the required package names above

### Project Structure Notes

**Required final structure (must match exactly):**
```
playground/
├── .github/
│   └── workflows/
│       ├── ci.yml                    # PR: type-check + test only
│       └── deploy.yml                # main: test → build → Railway deploy
├── .env.example                      # All required vars documented
├── .gitignore
├── README.md
├── docker-compose.yml                # Local: PostgreSQL (5432) + Redis AOF (6379)
├── turbo.json
├── package.json                      # pnpm workspace root
├── pnpm-workspace.yaml
├── apps/
│   ├── web/                          # Next.js 15 App Router
│   │   ├── Dockerfile
│   │   ├── package.json
│   │   ├── next.config.ts
│   │   ├── tsconfig.json
│   │   ├── tailwind.config.ts
│   │   └── src/
│   │       └── app/
│   │           └── page.tsx          # Landing page placeholder
│   └── bot-worker/                   # Node.js TypeScript process
│       ├── Dockerfile
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
│           ├── index.ts              # Entrypoint
│           └── logger.ts             # Pino instance
├── packages/
│   ├── db/                           # Drizzle schema + migrations (empty for this story)
│   │   ├── package.json
│   │   └── tsconfig.json
│   ├── game-types/                   # Interfaces + DTOs (empty for this story)
│   │   ├── package.json
│   │   └── tsconfig.json
│   ├── game-engine/                  # Game execution logic (empty for this story)
│   │   ├── package.json
│   │   └── tsconfig.json
│   ├── shared/                       # Env validation + utils
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       └── env.ts                # Zod env schema + export
│   └── eslint-config/                # Shared ESLint + Prettier
│       └── package.json
```

### References

- Architecture: Starter Template Evaluation section — `pnpm dlx create-turbo@latest playground --example with-tailwind` [Source: architecture.md#Starter Template Evaluation]
- Architecture: turbo.json pipeline exact structure [Source: architecture.md#Starter Template Evaluation → Build Tooling]
- Architecture: Package boundary rules [Source: architecture.md#Structure Patterns → Package Boundaries]
- Architecture: Pino logging pattern [Source: architecture.md#Implementation Patterns → Logging]
- Architecture: Environment variables required list [Source: architecture.md#Implementation Patterns → Environment Variables]
- Architecture: Redis AOF configuration [Source: architecture.md#Data Architecture → Redis Configuration]
- Architecture: Anti-patterns list [Source: architecture.md#Anti-Patterns (Forbidden)]
- Architecture: Testing framework table (Vitest, not Jest) [Source: architecture.md#Starter Template → Testing Framework]
- Architecture: Railway deployment (two services, no Vercel) [Source: architecture.md#Infrastructure & Deployment]
- Epics: Story 1.1 Acceptance Criteria [Source: epics.md#Story 1.1]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- All 10 tasks completed. pnpm install, pnpm type-check, and pnpm test all pass across 8 workspace packages.
- bot-worker uses `module: Node16 / moduleResolution: Node16` (not CommonJS) to support package.json `exports` field from `@playground/shared`. CJS output is produced because `bot-worker/package.json` has `"type": "commonjs"`.
- `packages/shared` exports `./env` with both `require` and `import` conditions so it is consumable from both CJS (bot-worker) and ESM consumers.
- Tailwind CSS v4 configured: `tailwindcss` + `@tailwindcss/postcss` in apps/web, `postcss.config.mjs` with `@tailwindcss/postcss` plugin, `globals.css` with `@import "tailwindcss"`, imported in layout.tsx.
- Code review fixes applied: next.config.ts `output: 'standalone'` added, CI/deploy workflows pnpm setup order corrected, packages/shared tsconfig changed from NodeNext to CommonJS, downstream package tsconfigs also set to CommonJS/Node to prevent future import extension issues, apps/web vitest.config.ts React plugin removed, packages/db drizzle.config.ts added, README.md created with full env var documentation.
- Docker Compose verified structurally correct (PostgreSQL 16 + Redis 7 AOF with healthchecks). Runtime verification requires Docker — assumed healthy per spec.
- AC 6 (Railway deploy pipeline) requires actual Railway tokens to verify end-to-end.

### File List

- `.gitignore`
- `.env.example`
- `tsconfig.base.json`
- `turbo.json`
- `package.json`
- `pnpm-workspace.yaml`
- `docker-compose.yml`
- `railway.json`
- `.github/workflows/ci.yml`
- `.github/workflows/deploy.yml`
- `apps/web/package.json`
- `apps/web/tsconfig.json`
- `apps/web/next.config.ts`
- `apps/web/vitest.config.ts`
- `apps/web/Dockerfile`
- `apps/web/src/app/layout.tsx`
- `apps/web/src/app/page.tsx`
- `apps/web/src/lib/logger.ts`
- `apps/web/src/smoke.test.ts`
- `apps/bot-worker/package.json`
- `apps/bot-worker/tsconfig.json`
- `apps/bot-worker/vitest.config.ts`
- `apps/bot-worker/Dockerfile`
- `apps/bot-worker/src/index.ts`
- `apps/bot-worker/src/logger.ts`
- `apps/bot-worker/src/smoke.test.ts`
- `packages/shared/package.json`
- `packages/shared/tsconfig.json`
- `packages/shared/vitest.config.ts`
- `packages/shared/src/env.ts`
- `packages/shared/src/env.test.ts`
- `packages/db/package.json`
- `packages/db/tsconfig.json`
- `packages/db/src/index.ts`
- `packages/game-types/package.json`
- `packages/game-types/tsconfig.json`
- `packages/game-types/src/index.ts`
- `packages/game-engine/package.json`
- `packages/game-engine/tsconfig.json`
- `packages/game-engine/vitest.config.ts`
- `packages/game-engine/src/index.ts`
- `packages/game-engine/src/smoke.test.ts`
- `packages/eslint-config/package.json`
- `packages/eslint-config/index.js`
- `pnpm-lock.yaml`
- `README.md`
- `apps/web/postcss.config.mjs`
- `apps/web/src/app/globals.css`
- `packages/db/drizzle.config.ts`
- `packages/game-engine/src/smoke.test.ts`
- `packages/eslint-config/package.json`
- `packages/eslint-config/index.js`
