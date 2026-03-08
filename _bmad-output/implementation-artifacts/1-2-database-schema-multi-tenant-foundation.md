# Story 1.2: Database Schema & Multi-Tenant Foundation

Status: done

## Story

As a platform operator,
I want the `tenants`, `users`, and `oauth_tokens` tables created with Row-Level Security policies,
so that multi-tenant data isolation is enforced at the database layer independently of application logic.

## Acceptance Criteria

1. **Given** the `packages/db` Drizzle schema is defined
   **When** `pnpm db:generate && pnpm db:migrate` is run
   **Then** the `tenants`, `users`, and `oauth_tokens` tables are created with `tenant_id UUID NOT NULL` columns (on scoped tables) and all columns named in `snake_case`

2. **Given** RLS policies are applied via `pgPolicy` in Drizzle for all tenant-scoped tables
   **When** a DB query executes without a tenant context set in the session
   **Then** no rows are returned (RLS blocks access by default)

3. **Given** a valid `tenant_id` is set in the DB session context via `SET LOCAL app.current_tenant_id = '{id}'`
   **When** a query runs on any tenant-scoped table
   **Then** only rows belonging to that `tenant_id` are returned, regardless of application-layer filtering

4. **Given** `drizzle-kit generate` is run after schema definition
   **When** the output migration SQL is inspected
   **Then** it contains `CREATE TABLE`, `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`, and `CREATE POLICY` statements for each tenant-scoped table

5. **Given** a migration is applied with `pnpm db:migrate`
   **When** that same migration is run again without schema changes
   **Then** the command exits cleanly (no new migration files applied)

6. **Given** a migration fails mid-apply in production
   **When** it is rolled back
   **Then** the previous schema state is fully restored (drizzle-kit uses transactional DDL by default)

## Tasks / Subtasks

- [x] Task 1 — Add `@playground/shared` dependency and postgres.js client (AC: 1)
  - [x] Add `@playground/shared: workspace:*` to `packages/db/package.json` dependencies
  - [x] Create `packages/db/src/client.ts` — `postgres.js` connection pool + `drizzle()` instance
  - [x] Import `env.DATABASE_URL` from `@playground/shared/env` (never raw `process.env`)
  - [x] Export `db`, `Database` type, and `withTenantContext()` helper

- [x] Task 2 — Create `packages/db/src/schema/tenants.ts` (AC: 1, 4)
  - [x] Define `tenants` table: `id` (uuid PK), `twitch_id` (text unique), `twitch_login`, `display_name`, `deleted_at` (nullable), `created_at`, `updated_at`
  - [x] Define `userRole` enum: `'free' | 'premium' | 'admin'`
  - [x] Define `subscriptionStatus` enum: `'free' | 'active' | 'past_due' | 'canceled'`
  - [x] Define `users` table: `id`, `tenant_id` FK→tenants, `twitch_id`, `role`, `subscription_status`, `created_at`, `updated_at`
  - [x] Define `oauthProvider` enum: `'twitch' | 'spotify' | 'youtube'`
  - [x] Define `oauth_tokens` table: `id`, `tenant_id` FK→tenants, `provider`, `encrypted_access_token`, `encrypted_refresh_token` (nullable), `expires_at` (nullable), `created_at`, `updated_at`
  - [x] Add `pgPolicy` inline on `tenants`, `users`, `oauth_tokens` using `app.current_tenant_id` session variable

- [x] Task 3 — Create `packages/db/src/schema/index.ts` (AC: 1)
  - [x] Re-export all schema objects from `tenants.ts`
  - [x] Export as named exports AND as `* as schema` aggregate for drizzle client

- [x] Task 4 — Update `packages/db/src/index.ts` exports (AC: 1)
  - [x] Export `db`, `withTenantContext` from `./client`
  - [x] Export all schema tables, enums, and inferred types from `./schema`
  - [x] Export `type Database` for type-safe usage in both runtimes

- [x] Task 5 — Update `packages/db/drizzle.config.ts` (AC: 4, 5)
  - [x] Point `schema` to `'./src/schema/index.ts'`
  - [x] Point `out` to `'./migrations'`
  - [x] Set `dialect: 'postgresql'`
  - [x] Use `env.DATABASE_URL` via `process.env['DATABASE_URL']` (drizzle-kit runs outside Node context — cannot use Zod env here)
  - [x] Add `verbose: true`, `strict: true` for safety

- [x] Task 6 — Update `packages/db/package.json` exports (AC: 1)
  - [x] Add `@playground/shared: workspace:*` to `dependencies`
  - [x] Add conditional exports for `.`, `./client`, `./schema`
  - [x] Ensure `db:generate` and `db:migrate` scripts use `drizzle-kit generate` and `drizzle-kit migrate`

- [x] Task 7 — Run `pnpm db:generate` and inspect migration SQL (AC: 4)
  - [x] Run `pnpm db:generate` from repo root
  - [x] Verify generated SQL file in `packages/db/migrations/` contains:
    - `CREATE TABLE "tenants"`, `CREATE TABLE "users"`, `CREATE TABLE "oauth_tokens"`
    - `ALTER TABLE "users" ENABLE ROW LEVEL SECURITY`
    - `ALTER TABLE "oauth_tokens" ENABLE ROW LEVEL SECURITY`
    - `CREATE POLICY` statements with the correct USING expression

- [x] Task 8 — Apply migration to local PostgreSQL (AC: 1, 5)
  - [x] Ensure `docker-compose up -d` is running
  - [x] Run `pnpm db:migrate` from repo root
  - [x] Verify all three tables exist in the `playground` database
  - [x] Run `pnpm db:migrate` again — verify idempotent exit (AC5)

- [x] Task 9 — Schema type tests with Vitest (AC: 1, 4)
  - [x] Create `packages/db/src/schema/tenants.test.ts`
  - [x] Test: schema exports all expected table objects
  - [x] Test: column types are correct (uuid for ids, timestamp for dates, text for strings)
  - [x] Test: read generated migration SQL file and assert it contains all required DDL statements
  - [x] Run `pnpm test` — verify all tests pass

- [x] Task 10 — `pnpm type-check` passes (AC: 1)
  - [x] Run `pnpm type-check` — all 8 workspace packages pass with no TypeScript errors

## Dev Notes

### Critical Architecture Constraints

**Package Boundary Rule:**
- `packages/db` → imported by **both** `apps/web` AND `apps/bot-worker` for types and query execution
- Never use `process.env.DATABASE_URL` directly — always import `env` from `@playground/shared/env` in application code
  - Exception: `drizzle.config.ts` uses `process.env` directly because drizzle-kit runs as a CLI tool outside the app runtime

**Multi-Tenant RLS Pattern (ADR-06 — non-negotiable):**
- Every tenant-scoped table MUST have `pgPolicy` for RLS — enforced at DB layer independently of app logic
- Tenant context is set per-query via `SET LOCAL app.current_tenant_id = '{uuid}'` inside a transaction
- The `withTenantContext()` helper wraps any tenant-scoped query in a transaction with the correct SET LOCAL
- `tenants` table: RLS via `id = current_setting('app.current_tenant_id', true)::uuid`
- `users` / `oauth_tokens`: RLS via `tenant_id = current_setting('app.current_tenant_id', true)::uuid`
- Use `current_setting('app.current_tenant_id', true)` (second arg `true` = returns NULL if unset, not an error)

**Identifiers:**
- All primary keys: UUID v4 via Drizzle's `.defaultRandom()` (maps to `gen_random_uuid()`)
- Never integer auto-increment IDs

**Timestamps:**
- Always `timestamp({ withTimezone: true })` — never `timestamp` without timezone
- Default: `.defaultNow()` for `created_at`; `updated_at` updated by application logic or trigger

**Naming:**
- Table names: `snake_case`, plural — `tenants`, `users`, `oauth_tokens`
- Column names: `snake_case` — `tenant_id`, `created_at`, `twitch_login`
- Index names: `idx_{table}_{column}` — `idx_users_tenant_id`
- Policy names: `{table}_{description}` — `users_tenant_isolation`

**OAuth Token Security:**
- `encrypted_access_token` and `encrypted_refresh_token` stored as AES-256-GCM ciphertext (see `packages/shared/src/utils/encrypt.ts` — to be created in this story or confirmed stub)
- Plaintext tokens NEVER written to any column, log, or response body

### Implementation Patterns

#### Drizzle Schema Definition

```typescript
// packages/db/src/schema/tenants.ts
import {
  pgTable,
  uuid,
  text,
  timestamp,
  pgEnum,
  pgPolicy,
  index,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

// ─── Enums ───────────────────────────────────────────────────────────────────

export const userRoleEnum = pgEnum('user_role', ['free', 'premium', 'admin'])
export const subscriptionStatusEnum = pgEnum('subscription_status', [
  'free',
  'active',
  'past_due',
  'canceled',
])
export const oauthProviderEnum = pgEnum('oauth_provider', [
  'twitch',
  'spotify',
  'youtube',
])

// ─── Tenants (root table — no tenant_id FK) ──────────────────────────────────

export const tenants = pgTable(
  'tenants',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    twitchId: text('twitch_id').unique().notNull(),
    twitchLogin: text('twitch_login').notNull(),
    displayName: text('display_name').notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    pgPolicy('tenants_self_isolation', {
      as: 'permissive',
      for: 'all',
      to: 'public',
      using: sql`${table.id} = current_setting('app.current_tenant_id', true)::uuid`,
    }),
  ]
)

// ─── Users (tenant-scoped) ───────────────────────────────────────────────────

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    twitchId: text('twitch_id').notNull(),
    role: userRoleEnum('role').notNull().default('free'),
    subscriptionStatus: subscriptionStatusEnum('subscription_status')
      .notNull()
      .default('free'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('idx_users_tenant_id').on(table.tenantId),
    pgPolicy('users_tenant_isolation', {
      as: 'permissive',
      for: 'all',
      to: 'public',
      using: sql`${table.tenantId} = current_setting('app.current_tenant_id', true)::uuid`,
    }),
  ]
)

// ─── OAuth Tokens (tenant-scoped) ────────────────────────────────────────────

export const oauthTokens = pgTable(
  'oauth_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    provider: oauthProviderEnum('provider').notNull(),
    encryptedAccessToken: text('encrypted_access_token').notNull(),
    encryptedRefreshToken: text('encrypted_refresh_token'),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('idx_oauth_tokens_tenant_id').on(table.tenantId),
    index('idx_oauth_tokens_tenant_provider').on(table.tenantId, table.provider),
    pgPolicy('oauth_tokens_tenant_isolation', {
      as: 'permissive',
      for: 'all',
      to: 'public',
      using: sql`${table.tenantId} = current_setting('app.current_tenant_id', true)::uuid`,
    }),
  ]
)
```

#### Drizzle Client + Tenant Context Helper

```typescript
// packages/db/src/client.ts
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { env } from '@playground/shared/env'
import * as schema from './schema/index'

const client = postgres(env.DATABASE_URL)
export const db = drizzle(client, { schema })

export type Database = typeof db

/**
 * Wraps a callback in a transaction with the tenant context set.
 * MUST be used for all queries on tenant-scoped tables.
 *
 * @example
 * const results = await withTenantContext(tenantId, async (tx) => {
 *   return tx.select().from(schema.users)
 * })
 */
export async function withTenantContext<T>(
  tenantId: string,
  callback: (tx: Database) => Promise<T>
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`SELECT set_config('app.current_tenant_id', ${tenantId}, true)`
    )
    return callback(tx as unknown as Database)
  })
}
```

#### drizzle.config.ts (updated)

```typescript
// packages/db/drizzle.config.ts
import type { Config } from 'drizzle-kit'

export default {
  schema: './src/schema/index.ts',
  out: './migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env['DATABASE_URL']!,
  },
  verbose: true,
  strict: true,
} satisfies Config
```

Note: `drizzle.config.ts` uses `process.env` directly (not `@playground/shared/env`) because drizzle-kit runs as a standalone CLI outside the app process. The `!` non-null assertion is acceptable here.

#### Schema Index

```typescript
// packages/db/src/schema/index.ts
export * from './tenants'
```

#### Package Main Index

```typescript
// packages/db/src/index.ts
export { db, withTenantContext } from './client'
export type { Database } from './client'
export * from './schema'
```

### Vitest Test Strategy

Tests MUST NOT connect to a real DB. AC4 (migration SQL content) is testable by reading the generated `.sql` file from disk after running `pnpm db:generate`.

```typescript
// packages/db/src/schema/tenants.test.ts
import { describe, it, expect } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { tenants, users, oauthTokens } from './tenants'

describe('tenants schema exports', () => {
  it('exports tenants table', () => {
    expect(tenants).toBeDefined()
  })
  it('exports users table', () => {
    expect(users).toBeDefined()
  })
  it('exports oauthTokens table', () => {
    expect(oauthTokens).toBeDefined()
  })
})

describe('migration SQL validation (AC4)', () => {
  it('generated migration contains expected DDL', () => {
    const migrationsDir = path.join(__dirname, '../../migrations')
    const sqlFiles = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql'))
    expect(sqlFiles.length).toBeGreaterThan(0)

    const sql = sqlFiles
      .map((f) => fs.readFileSync(path.join(migrationsDir, f), 'utf-8'))
      .join('\n')

    expect(sql).toContain('CREATE TABLE "tenants"')
    expect(sql).toContain('CREATE TABLE "users"')
    expect(sql).toContain('CREATE TABLE "oauth_tokens"')
    expect(sql).toContain('ENABLE ROW LEVEL SECURITY')
    expect(sql).toContain('CREATE POLICY')
    expect(sql).toContain('app.current_tenant_id')
  })
})
```

**Important:** The migration SQL test requires `pnpm db:generate` to have been run BEFORE the test suite. In CI, add `db:generate` as a prerequisite step before `test`.

### Dependency Updates

`packages/db/package.json` must add:
```json
{
  "dependencies": {
    "@playground/shared": "workspace:*",
    "drizzle-orm": "^0.38.3",
    "postgres": "^3.4.5"
  }
}
```

`packages/db/package.json` exports:
```json
{
  "exports": {
    ".": {
      "require": "./src/index.ts",
      "import": "./src/index.ts",
      "types": "./src/index.ts"
    },
    "./client": {
      "require": "./src/client.ts",
      "import": "./src/client.ts",
      "types": "./src/client.ts"
    },
    "./schema": {
      "require": "./src/schema/index.ts",
      "import": "./src/schema/index.ts",
      "types": "./src/schema/index.ts"
    }
  }
}
```

### Drizzle ORM Version Notes (0.38.x)

The installed version is `drizzle-orm@^0.38.3`. Key API points:
- `pgPolicy` is available in `drizzle-orm/pg-core` in v0.36+ — use it directly, not `crudPolicy` from `drizzle-orm/neon` (Neon-specific)
- Table constraints/policies are defined in the 3rd argument callback as an array: `(table) => [index(...), pgPolicy(...)]`
- `pgEnum` is defined at the top level (not inside `pgTable`), then referenced as a column type
- For `pgPolicy`, `to: 'public'` is correct for standard PostgreSQL; change to `'authenticated'` if using Supabase with `supabase_auth_admin` role
- `sql` template tag for raw SQL expressions: `import { sql } from 'drizzle-orm'`
- Drizzle infers TypeScript types: `InferSelectModel<typeof users>` and `InferInsertModel<typeof users>`

### Previous Story Intelligence (1.1)

From Story 1.1 completion:
- `packages/db` exists with scaffold: `package.json`, `tsconfig.json`, `src/index.ts` (empty export), `drizzle.config.ts` (already created)
- tsconfig uses `module: CommonJS, moduleResolution: Node` (explicitly set)
- `packages/shared` exports `env` via `require` + `import` conditions at `@playground/shared/env`
- pnpm workspace is operational — `workspace:*` references work
- All root turbo pipelines (`db:generate`, `db:migrate`) are already wired in `turbo.json`

**The drizzle.config.ts at `packages/db/drizzle.config.ts` already exists** from Story 1.1's code review fixes. It points to `./src/schema.ts` (single file) — this MUST be updated to `./src/schema/index.ts` (folder barrel).

### Project Structure Notes

Files to create/modify in this story:

```
packages/db/
├── drizzle.config.ts           ← UPDATE: schema path to ./src/schema/index.ts
├── src/
│   ├── index.ts                ← UPDATE: export db + schema
│   ├── client.ts               ← CREATE: postgres.js + drizzle client + withTenantContext
│   └── schema/
│       ├── index.ts            ← CREATE: barrel export
│       └── tenants.ts          ← CREATE: tenants + users + oauth_tokens + pgPolicy
├── migrations/                 ← AUTO-GENERATED by drizzle-kit generate
│   └── 0000_*.sql             ← generated migration file (check into git)
```

DO NOT create schema files for other domains (playlists, sessions, games, viewers, subscriptions) — those belong to their respective epics. This story ONLY implements the 3 foundational tables.

### References

- Architecture: Data Architecture section — `crudPolicy helper from drizzle-orm/neon`, `pgPolicy per table`, `schema location: packages/db/schema/` [Source: architecture.md#Data Architecture]
- Architecture: Naming patterns — `snake_case` tables, `idx_{table}_{column}` indexes, `timestamp({ withTimezone: true })` [Source: architecture.md#Implementation Patterns → Naming Patterns]
- Architecture: Anti-patterns — `process.env.X` forbidden in business logic [Source: architecture.md#Anti-Patterns]
- Architecture: Format patterns — UUID v4 via `defaultRandom()`, never integer auto-increment [Source: architecture.md#Format Patterns → Identifiers]
- Architecture: Package boundaries — `packages/db` imported by both runtimes [Source: architecture.md#Structure Patterns → Package Boundaries]
- Architecture: ADR-06 — RLS enforced at DB layer independently of application-layer checks [Source: architecture.md#Architecture Validation]
- Architecture: OAuth Token Security — AES-256-GCM encrypted, never plaintext in DB [Source: architecture.md#Authentication & Security → Token Encryption]
- Architecture: Project structure — `packages/db/src/schema/tenants.ts` for FR1-8 [Source: architecture.md#Complete Project Directory Structure]
- Epics: Story 1.2 Acceptance Criteria [Source: epics.md#Story 1.2]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- Task 6/tsconfig: Changed `packages/db` tsconfig from `CommonJS/Node` to `Node16/Node16` — required for resolving `@playground/shared/env` subpath export
- Task 6/package.json: Removed `"type": "module"` — conflicts with Node16 CJS resolution; all workspace packages use dual `require`+`import` export conditions
- Task 7: `drizzle-kit generate` produced `migrations/0000_flaky_hellion.sql` — verified all 3 CREATE TABLE, 3 ENABLE ROW LEVEL SECURITY, 3 CREATE POLICY with `app.current_tenant_id`, uuid PKs, `timestamp with time zone`, snake_case columns
- Task 8: AC5 (`pnpm db:migrate` idempotent) verified with docker-compose postgres
- Task 9: Fixed regex bug in timestamp test — original `[^w]` incorrectly matched valid SQL; replaced with negative lookahead `(?! with time zone)`
- Task 10: All 7 workspace packages pass `tsc --noEmit` with zero errors

**Code Review Fixes (1-2):**
- H1: Added UNIQUE constraint `oauth_tokens_tenant_provider_unique` on `(tenant_id, provider)` — enables safe upsert for token refresh
- M1: Added `update_updated_at_column()` trigger function + triggers for all 3 tables in migration 0002
- M2: Added UNIQUE constraint `users_tenant_twitch_unique` on `(tenant_id, twitch_id)` — prevents duplicate Twitch users within a tenant
- M3: Added `{ max: 10, idle_timeout: 20, connect_timeout: 10 }` to postgres.js client
- M4: Added `FORCE ROW LEVEL SECURITY` for all 3 tables in migration 0002 (ADR-06)
- M5: Fixed `withTenantContext` callback type from `Database` to proper `Transaction` type (no more `as unknown as` cast)
- M6: Created `packages/shared/src/utils/encrypt.ts` — AES-256-GCM encrypt/decrypt stub
- M7: Updated File List to include migrations 0001/0002 and meta/ directory files

### File List

- `packages/db/package.json` — added `@playground/shared` dep, `./client` + `./schema` exports, `test` script; removed `"type": "module"`
- `packages/db/tsconfig.json` — changed to `module: Node16, moduleResolution: Node16`
- `packages/db/drizzle.config.ts` — updated schema path to `./src/schema/index.ts`
- `packages/db/src/schema/tenants.ts` — created: 3 enums + 3 tables with `pgPolicy` RLS
- `packages/db/src/schema/index.ts` — created: barrel re-export
- `packages/db/src/client.ts` — created: postgres.js client, drizzle instance, `withTenantContext()`
- `packages/db/src/index.ts` — updated: exports db, withTenantContext, schema
- `packages/db/src/schema/tenants.test.ts` — created: 14 Vitest tests (all pass)
- `packages/db/vitest.config.ts` — created: node environment config
- `packages/db/migrations/0000_flaky_hellion.sql` — auto-generated by drizzle-kit (tables + RLS + policies)
- `packages/db/migrations/0001_tranquil_spirit.sql` — auto-generated: UNIQUE constraints on oauth_tokens(tenant_id,provider) + users(tenant_id,twitch_id)
- `packages/db/migrations/0002_force_rls_and_updated_at_triggers.sql` — manual: FORCE ROW LEVEL SECURITY + updated_at trigger function + triggers for all 3 tables
- `packages/db/migrations/meta/_journal.json` — drizzle-kit migration journal (updated with 0002 entry)
- `packages/db/migrations/meta/0000_snapshot.json` — drizzle-kit schema snapshot
- `packages/shared/src/utils/encrypt.ts` — created: AES-256-GCM encrypt/decrypt for OAuth tokens
- `packages/shared/package.json` — added `./utils/encrypt` export condition
