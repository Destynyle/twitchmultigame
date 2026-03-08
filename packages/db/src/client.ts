import { drizzle } from 'drizzle-orm/postgres-js'
import { sql, type ExtractTablesWithRelations } from 'drizzle-orm'
import type { PgTransaction } from 'drizzle-orm/pg-core'
import type { PostgresJsQueryResultHKT } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { env } from '@playground/shared/env'
import * as schema from './schema/index'

const client = postgres(env.DATABASE_URL, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
})

export const db = drizzle(client, { schema })

export type Database = typeof db

export type Transaction = PgTransaction<
  PostgresJsQueryResultHKT,
  typeof schema,
  ExtractTablesWithRelations<typeof schema>
>

/**
 * Wraps a callback in a transaction with the tenant context set via
 * `SET LOCAL app.current_tenant_id`. MUST be used for all queries on
 * tenant-scoped tables (users, oauth_tokens, and all future scoped tables).
 *
 * @example
 * const results = await withTenantContext(tenantId, async (tx) => {
 *   return tx.select().from(schema.users)
 * })
 */
export async function withTenantContext<T>(
  tenantId: string,
  callback: (tx: Transaction) => Promise<T>
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`SELECT set_config('app.current_tenant_id', ${tenantId}, true)`
    )
    return callback(tx)
  })
}
