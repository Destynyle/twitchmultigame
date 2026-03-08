'use server'

import { redirect } from 'next/navigation'
import { and, eq } from 'drizzle-orm'
import { db } from '@playground/db'
import { tenants, oauthTokens } from '@playground/db/schema'
import { auth, signOut } from '~/server/auth'

/**
 * Server Action: soft-delete the authenticated tenant account.
 * Sets deleted_at = NOW(), destroys the session, and redirects to /.
 * AC1: soft-delete + session destruction + redirect to landing page.
 */
export async function deleteAccountAction() {
  const session = await auth()
  if (!session?.user?.tenantId) redirect('/signin')

  const tenantId = session.user.tenantId

  await db
    .update(tenants)
    .set({ deletedAt: new Date() })
    .where(eq(tenants.id, tenantId))

  await signOut({ redirect: false })
  redirect('/')
}

/**
 * Server Action: disconnect Spotify from the authenticated tenant.
 */
export async function disconnectSpotifyAction() {
  const session = await auth()
  if (!session?.user?.tenantId) redirect('/signin')

  await db
    .delete(oauthTokens)
    .where(
      and(
        eq(oauthTokens.tenantId, session.user.tenantId),
        eq(oauthTokens.provider, 'spotify')
      )
    )

  redirect('/settings?spotify=disconnected')
}
