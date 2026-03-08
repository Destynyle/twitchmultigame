import { NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { db } from '@playground/db'
import { oauthTokens } from '@playground/db/schema'
import { auth } from '~/server/auth'

export async function POST() {
  const session = await auth()
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  await db
    .delete(oauthTokens)
    .where(
      and(
        eq(oauthTokens.tenantId, session.user.tenantId),
        eq(oauthTokens.provider, 'spotify')
      )
    )

  return NextResponse.json({ success: true })
}
