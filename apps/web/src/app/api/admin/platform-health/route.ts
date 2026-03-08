import { NextResponse } from 'next/server'
import { auth } from '~/server/auth'
import { db } from '@playground/db'
import { sessions } from '@playground/db/schema'
import { inArray, count } from 'drizzle-orm'
import { getRedisPublisher } from '~/server/redis'

export const runtime = 'nodejs'

export async function GET() {
  const session = await auth()
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const redis = getRedisPublisher()

  // Active session count
  const [sessionCount] = await db
    .select({ total: count(sessions.id) })
    .from(sessions)
    .where(inArray(sessions.status, ['active', 'paused']))

  // Connected bots: scan bot:status:* keys with status=connected
  let connectedBots = 0
  try {
    const keys = await redis.keys('bot:status:*')
    if (keys.length > 0) {
      const values = await redis.mget(...keys)
      connectedBots = values.filter((v) => {
        if (!v) return false
        try {
          return (JSON.parse(v) as { status: string }).status === 'connected'
        } catch {
          return false
        }
      }).length
    }
  } catch {
    // Redis scan failed — non-fatal
  }

  // Redis memory usage
  let redisMemoryUsage = 'N/A'
  try {
    const info = await redis.info('memory')
    const match = info.match(/used_memory_human:(\S+)/)
    if (match?.[1]) redisMemoryUsage = match[1]
  } catch {
    // non-fatal
  }

  return NextResponse.json({
    activeSessions: sessionCount?.total ?? 0,
    connectedBots,
    redisMemoryUsage,
    deployedAt: process.env['DEPLOYED_AT'] ?? null,
  })
}
