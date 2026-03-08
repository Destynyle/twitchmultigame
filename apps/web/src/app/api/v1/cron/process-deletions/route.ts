import { NextRequest, NextResponse } from 'next/server'
import { lt, and, isNotNull } from 'drizzle-orm'
import { db } from '@playground/db'
import { tenants } from '@playground/db/schema'
import { env } from '@playground/shared/env'

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000

/**
 * POST /api/v1/cron/process-deletions
 *
 * Permanently deletes tenants whose soft-delete grace period (30 days) has expired.
 * Cascading FK constraints handle deletion of users, oauth_tokens, and other
 * tenant-scoped rows automatically.
 *
 * AC2: Secured via Authorization header bearing the CRON_SECRET.
 * Must be called by Railway / Vercel cron — never by public users.
 */
export async function POST(req: NextRequest) {
  // Authenticate the cron caller
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const cutoff = new Date(Date.now() - THIRTY_DAYS_MS)

  // Find and permanently delete tenants past the grace period.
  // ON DELETE CASCADE on users and oauth_tokens handles related rows.
  const deleted = await db
    .delete(tenants)
    .where(and(isNotNull(tenants.deletedAt), lt(tenants.deletedAt, cutoff)))
    .returning({ id: tenants.id })

  return NextResponse.json({
    deleted: deleted.length,
    deletedIds: deleted.map((t) => t.id),
  })
}
