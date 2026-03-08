import { NextRequest, NextResponse } from 'next/server'
import { db } from '@playground/db'
import { tenants, overlayThemes } from '@playground/db/schema'
import { eq } from 'drizzle-orm'

const DEFAULT_CSS: Record<string, string> = {
  '--overlay-bg': 'rgba(0,0,0,0.85)',
  '--overlay-text': '#ffffff',
  '--overlay-accent': '#a855f7',
  '--overlay-card': 'rgba(30,30,30,0.9)',
  '--overlay-border': 'rgba(255,255,255,0.1)',
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
): Promise<NextResponse> {
  const { token } = await params

  const [tenant] = await db
    .select({ selectedThemeId: tenants.selectedThemeId })
    .from(tenants)
    .where(eq(tenants.overlayToken, token))

  if (!tenant) return NextResponse.json({ cssVariables: DEFAULT_CSS })

  if (!tenant.selectedThemeId) return NextResponse.json({ cssVariables: DEFAULT_CSS })

  const [theme] = await db
    .select({ cssVariables: overlayThemes.cssVariables })
    .from(overlayThemes)
    .where(eq(overlayThemes.id, tenant.selectedThemeId))

  return NextResponse.json({ cssVariables: (theme?.cssVariables as Record<string, string>) ?? DEFAULT_CSS })
}
