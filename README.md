# Playground

Multi-tenant SaaS platform for Twitch chat-based mini-games. Streamers host blind tests, quizzes, and more directly from their dashboard.

## Architecture

Turborepo monorepo with two runtimes:

- `apps/web` — Next.js 15 App Router (dashboard, API, SSE overlays)
- `apps/bot-worker` — Node.js TypeScript process (Twitch bot, game engine)

Shared packages:

- `packages/db` — Drizzle ORM schema + migrations
- `packages/shared` — Zod env validation, constants, utility types
- `packages/game-types` — Shared interfaces and DTOs
- `packages/game-engine` — Game execution logic (bot-worker only)
- `packages/eslint-config` — Shared ESLint + Prettier config

## Prerequisites

- Node.js 20+
- pnpm 9+
- Docker + Docker Compose

## Local Development

### 1. Install dependencies

```bash
pnpm install
```

### 2. Configure environment variables

```bash
cp .env.example .env.local
```

Edit `.env.local` and fill in all required values (see [Environment Variables](#environment-variables) below). The bot-worker and web server **will crash immediately** at startup if any required variable is missing — this is intentional.

### 3. Start local services

```bash
docker-compose up -d
```

This starts PostgreSQL (port 5432) and Redis with AOF persistence (port 6379).

### 4. Start development servers

```bash
pnpm dev
```

- Next.js dev server: http://localhost:3000
- bot-worker: starts and logs to stdout

## Environment Variables

All variables are required. The process crashes with a descriptive error if any is missing.

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string |
| `AUTH_SECRET` | Auth.js v5 secret (min 32 chars). Generate: `openssl rand -base64 32` |
| `TOKEN_ENCRYPTION_KEY` | AES-256-GCM key — **exactly 64 hex characters**. Generate: `openssl rand -hex 32` |
| `TWITCH_CLIENT_ID` | Twitch OAuth app client ID (from dev.twitch.tv) |
| `TWITCH_CLIENT_SECRET` | Twitch OAuth app client secret |
| `NODE_ENV` | `development` \| `test` \| `production` |

## Railway Deployment

Two Railway services required:

| Service | Source | Environment variables |
|---|---|---|
| `web` | `apps/web/Dockerfile` | All 7 env vars above + any Railway-injected vars |
| `bot-worker` | `apps/bot-worker/Dockerfile` | All 7 env vars above |

Set `RAILWAY_TOKEN` in GitHub repository secrets to enable the deploy pipeline.

## Scripts

```bash
pnpm dev          # Start all services in dev mode
pnpm build        # Build all packages
pnpm test         # Run all tests via Turborepo
pnpm type-check   # TypeScript check all packages
pnpm lint         # Lint all packages
pnpm db:generate  # Generate Drizzle migrations
pnpm db:migrate   # Apply migrations
```
