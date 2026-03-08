import { describe, it, expect } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'
import {
  tenants,
  users,
  oauthTokens,
  userRoleEnum,
  subscriptionStatusEnum,
  oauthProviderEnum,
} from './tenants'

describe('tenants schema — table exports', () => {
  it('exports tenants table', () => {
    expect(tenants).toBeDefined()
  })

  it('exports users table', () => {
    expect(users).toBeDefined()
  })

  it('exports oauthTokens table', () => {
    expect(oauthTokens).toBeDefined()
  })

  it('exports all three enums', () => {
    expect(userRoleEnum).toBeDefined()
    expect(subscriptionStatusEnum).toBeDefined()
    expect(oauthProviderEnum).toBeDefined()
  })
})

describe('tenants schema — column structure', () => {
  it('tenants has id, twitch_id, twitch_login, display_name, deleted_at, created_at, updated_at', () => {
    const cols = Object.keys(tenants)
    expect(cols).toContain('id')
    expect(cols).toContain('twitchId')
    expect(cols).toContain('twitchLogin')
    expect(cols).toContain('displayName')
    expect(cols).toContain('deletedAt')
    expect(cols).toContain('createdAt')
    expect(cols).toContain('updatedAt')
  })

  it('users has tenant_id column', () => {
    expect(Object.keys(users)).toContain('tenantId')
  })

  it('oauth_tokens has tenant_id and encrypted_access_token columns', () => {
    const cols = Object.keys(oauthTokens)
    expect(cols).toContain('tenantId')
    expect(cols).toContain('encryptedAccessToken')
    expect(cols).toContain('encryptedRefreshToken')
  })
})

describe('migration SQL validation (AC4)', () => {
  const migrationsDir = path.join(__dirname, '../../migrations')

  it('migrations directory exists with at least one SQL file', () => {
    expect(fs.existsSync(migrationsDir)).toBe(true)
    const sqlFiles = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql'))
    expect(sqlFiles.length).toBeGreaterThan(0)
  })

  it('migration SQL contains CREATE TABLE for all three tables', () => {
    const sqlFiles = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
    const combinedSql = sqlFiles
      .map((f) => fs.readFileSync(path.join(migrationsDir, f), 'utf-8'))
      .join('\n')

    expect(combinedSql).toContain('CREATE TABLE "tenants"')
    expect(combinedSql).toContain('CREATE TABLE "users"')
    expect(combinedSql).toContain('CREATE TABLE "oauth_tokens"')
  })

  it('migration SQL enables RLS on all tenant-scoped tables', () => {
    const sqlFiles = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
    const combinedSql = sqlFiles
      .map((f) => fs.readFileSync(path.join(migrationsDir, f), 'utf-8'))
      .join('\n')

    expect(combinedSql).toContain('ALTER TABLE "tenants" ENABLE ROW LEVEL SECURITY')
    expect(combinedSql).toContain('ALTER TABLE "users" ENABLE ROW LEVEL SECURITY')
    expect(combinedSql).toContain('ALTER TABLE "oauth_tokens" ENABLE ROW LEVEL SECURITY')
  })

  it('migration SQL contains CREATE POLICY with app.current_tenant_id', () => {
    const sqlFiles = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
    const combinedSql = sqlFiles
      .map((f) => fs.readFileSync(path.join(migrationsDir, f), 'utf-8'))
      .join('\n')

    expect(combinedSql).toContain('CREATE POLICY')
    expect(combinedSql).toContain("current_setting('app.current_tenant_id', true)::uuid")
    // All three policies present
    expect(combinedSql).toContain('tenants_self_isolation')
    expect(combinedSql).toContain('users_tenant_isolation')
    expect(combinedSql).toContain('oauth_tokens_tenant_isolation')
  })

  it('migration SQL uses snake_case column names (AC1)', () => {
    const sqlFiles = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
    const combinedSql = sqlFiles
      .map((f) => fs.readFileSync(path.join(migrationsDir, f), 'utf-8'))
      .join('\n')

    expect(combinedSql).toContain('"tenant_id"')
    expect(combinedSql).toContain('"twitch_id"')
    expect(combinedSql).toContain('"created_at"')
    expect(combinedSql).toContain('"updated_at"')
    expect(combinedSql).toContain('"encrypted_access_token"')
  })

  it('migration SQL uses uuid type for primary keys (not integers)', () => {
    const sqlFiles = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
    const combinedSql = sqlFiles
      .map((f) => fs.readFileSync(path.join(migrationsDir, f), 'utf-8'))
      .join('\n')

    expect(combinedSql).toContain('"id" uuid PRIMARY KEY DEFAULT gen_random_uuid()')
    // Must not use SERIAL or integer PK
    expect(combinedSql).not.toContain('SERIAL')
    expect(combinedSql).not.toContain('integer PRIMARY KEY')
  })

  it('migration SQL contains UNIQUE constraint on oauth_tokens(tenant_id, provider)', () => {
    const sqlFiles = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
    const combinedSql = sqlFiles
      .map((f) => fs.readFileSync(path.join(migrationsDir, f), 'utf-8'))
      .join('\n')

    expect(combinedSql).toContain('"oauth_tokens_tenant_provider_unique"')
  })

  it('migration SQL contains UNIQUE constraint on users(tenant_id, twitch_id)', () => {
    const sqlFiles = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
    const combinedSql = sqlFiles
      .map((f) => fs.readFileSync(path.join(migrationsDir, f), 'utf-8'))
      .join('\n')

    expect(combinedSql).toContain('"users_tenant_twitch_unique"')
  })

  it('migration SQL applies FORCE ROW LEVEL SECURITY on all tables', () => {
    const sqlFiles = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
    const combinedSql = sqlFiles
      .map((f) => fs.readFileSync(path.join(migrationsDir, f), 'utf-8'))
      .join('\n')

    expect(combinedSql).toContain('ALTER TABLE "tenants" FORCE ROW LEVEL SECURITY')
    expect(combinedSql).toContain('ALTER TABLE "users" FORCE ROW LEVEL SECURITY')
    expect(combinedSql).toContain('ALTER TABLE "oauth_tokens" FORCE ROW LEVEL SECURITY')
  })

  it('migration SQL creates updated_at triggers for all tables', () => {
    const sqlFiles = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
    const combinedSql = sqlFiles
      .map((f) => fs.readFileSync(path.join(migrationsDir, f), 'utf-8'))
      .join('\n')

    expect(combinedSql).toContain('update_updated_at_column')
    expect(combinedSql).toContain('update_tenants_updated_at')
    expect(combinedSql).toContain('update_users_updated_at')
    expect(combinedSql).toContain('update_oauth_tokens_updated_at')
  })

  it('migration SQL uses timestamp with time zone (not plain timestamp)', () => {
    const sqlFiles = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
    const combinedSql = sqlFiles
      .map((f) => fs.readFileSync(path.join(migrationsDir, f), 'utf-8'))
      .join('\n')

    expect(combinedSql).toContain('timestamp with time zone')
    expect(combinedSql).not.toMatch(/"created_at" timestamp(?! with time zone)/)
  })
})
