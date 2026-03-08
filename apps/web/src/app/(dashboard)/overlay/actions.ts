'use server'

import { auth } from '../../../../server/auth'
import { eq } from 'drizzle-orm'
import { db } from '@playground/db'
import { tenants } from '@playground/db/schema'
import { customAlphabet } from 'nanoid'

const nanoid = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 6)

export async function getOrCreateOverlayTokenAction(): Promise<
  { success: true; token: string } | { success: false; error: string }
> {
  const session = await auth()
  if (!session?.user?.tenantId) return { success: false, error: 'Unauthorized' }

  const tenantId = session.user.tenantId
  const [tenant] = await db
    .select({ overlayToken: tenants.overlayToken })
    .from(tenants)
    .where(eq(tenants.id, tenantId))

  if (!tenant) return { success: false, error: 'Tenant not found' }
  if (tenant.overlayToken) return { success: true, token: tenant.overlayToken }

  const token = nanoid()
  await db
    .update(tenants)
    .set({ overlayToken: token })
    .where(eq(tenants.id, tenantId))

  return { success: true, token }
}
