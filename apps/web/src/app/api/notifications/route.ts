import { NextResponse } from 'next/server'
import { auth } from '~/server/auth'
import { getRedisPublisher } from '~/server/redis'

export const runtime = 'nodejs'

export async function GET() {
  const session = await auth()
  if (!session?.user?.tenantId) {
    return NextResponse.json({ notification: null })
  }

  const redis = getRedisPublisher()
  const key = `admin:notification:${session.user.tenantId}`
  const raw = await redis.get(key)

  if (!raw) return NextResponse.json({ notification: null })

  // Consume the notification (one-shot delivery)
  await redis.del(key)

  try {
    return NextResponse.json({ notification: JSON.parse(raw) as { message: string; sessionId: string } })
  } catch {
    return NextResponse.json({ notification: null })
  }
}
