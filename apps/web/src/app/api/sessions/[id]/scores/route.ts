import { NextRequest, NextResponse } from 'next/server'
import { auth } from '~/server/auth'
import { withTenantContext } from '@playground/db'
import { sessionScores } from '@playground/db/schema'
import { eq, and, desc } from 'drizzle-orm'

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(
  _req: NextRequest,
  ctx: RouteContext
): Promise<NextResponse> {
  const session = await auth()
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: sessionId } = await ctx.params
  const tenantId = session.user.tenantId

  const scores = await withTenantContext(tenantId, async (tx) => {
    return tx
      .select()
      .from(sessionScores)
      .where(eq(sessionScores.sessionId, sessionId))
      .orderBy(desc(sessionScores.score))
  })

  const body = JSON.stringify({
    sessionId,
    exportedAt: new Date().toISOString(),
    scores,
  })

  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="session-${sessionId}-scores.json"`,
    },
  })
}

interface ImportScore {
  viewerUsername: string
  viewerDisplayName: string
  gameType: 'blindtest' | 'quiz'
  score: number
  correctAnswers: number
}

export async function POST(
  req: NextRequest,
  ctx: RouteContext
): Promise<NextResponse> {
  const session = await auth()
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: sessionId } = await ctx.params
  const tenantId = session.user.tenantId

  let body: { scores: ImportScore[] }
  try {
    body = (await req.json()) as { scores: ImportScore[] }
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!Array.isArray(body.scores)) {
    return NextResponse.json({ error: 'scores must be an array' }, { status: 400 })
  }

  let imported = 0

  await withTenantContext(tenantId, async (tx) => {
    for (const s of body.scores) {
      // Check if a score row already exists for this viewer+gameType
      const existing = await tx
        .select()
        .from(sessionScores)
        .where(
          and(
            eq(sessionScores.sessionId, sessionId),
            eq(sessionScores.viewerUsername, s.viewerUsername),
            eq(sessionScores.gameType, s.gameType)
          )
        )

      if (existing.length > 0 && existing[0]) {
        const current = existing[0]
        // Take the max score
        if (s.score > current.score) {
          await tx
            .update(sessionScores)
            .set({
              score: s.score,
              correctAnswers: s.correctAnswers,
              viewerDisplayName: s.viewerDisplayName,
              updatedAt: new Date(),
            })
            .where(eq(sessionScores.id, current.id))
        }
      } else {
        await tx.insert(sessionScores).values({
          sessionId,
          tenantId,
          viewerUsername: s.viewerUsername,
          viewerDisplayName: s.viewerDisplayName,
          gameType: s.gameType,
          score: s.score,
          correctAnswers: s.correctAnswers,
        })
        imported++
      }
    }
  })

  return NextResponse.json({ imported })
}
