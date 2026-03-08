'use server'

import { redirect } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { db } from '@playground/db'
import { tenants } from '@playground/db/schema'
import { auth } from '~/server/auth'

/**
 * Server Action: reactivate a soft-deleted account.
 * Clears deleted_at and redirects to the dashboard.
 * AC4: set deleted_at = null and restore all features.
 */
export async function reactivateAccountAction() {
  const session = await auth()
  if (!session?.user?.tenantId) redirect('/signin')

  const tenantId = session.user.tenantId

  await db
    .update(tenants)
    .set({ deletedAt: null })
    .where(eq(tenants.id, tenantId))

  redirect('/sessions')
}
