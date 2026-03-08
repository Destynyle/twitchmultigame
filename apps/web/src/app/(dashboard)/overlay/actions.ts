'use server'

import { auth } from '../../../../server/auth'
import { eq, asc } from 'drizzle-orm'
import { db } from '@playground/db'
import { tenants, overlayThemes } from '@playground/db/schema'
import type { OverlayTheme } from '@playground/db/schema'
import { customAlphabet } from 'nanoid'

const nanoid = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 6)

export async function getOrCreateOverlayTokenAction(): Promise<
  { success: true; token: string; selectedThemeId: string | null } | { success: false; error: string }
> {
  const session = await auth()
  if (!session?.user?.tenantId) return { success: false, error: 'Unauthorized' }

  const tenantId = session.user.tenantId
  const [tenant] = await db
    .select({ overlayToken: tenants.overlayToken, selectedThemeId: tenants.selectedThemeId })
    .from(tenants)
    .where(eq(tenants.id, tenantId))

  if (!tenant) return { success: false, error: 'Tenant not found' }
  if (tenant.overlayToken) return { success: true, token: tenant.overlayToken, selectedThemeId: tenant.selectedThemeId }

  const token = nanoid()
  await db
    .update(tenants)
    .set({ overlayToken: token })
    .where(eq(tenants.id, tenantId))

  return { success: true, token, selectedThemeId: null }
}

export async function getThemesAction(): Promise<
  { themes: OverlayTheme[] } | { error: string }
> {
  try {
    const themes = await db
      .select()
      .from(overlayThemes)
      .orderBy(asc(overlayThemes.tier), asc(overlayThemes.name))
    return { themes }
  } catch {
    return { error: 'Failed to fetch themes' }
  }
}

export async function selectThemeAction(themeId: string): Promise<
  { success: true } | { error: string }
> {
  const session = await auth()
  if (!session?.user?.tenantId) return { error: 'Unauthorized' }

  const tenantId = session.user.tenantId

  try {
    await db
      .update(tenants)
      .set({ selectedThemeId: themeId })
      .where(eq(tenants.id, tenantId))
    return { success: true }
  } catch {
    return { error: 'Failed to update theme' }
  }
}
