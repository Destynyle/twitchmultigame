import Redis from 'ioredis'

const REDIS_URL = process.env['REDIS_URL'] ?? 'redis://localhost:6379'

/** Singleton publisher client (shared across requests) */
let _publisher: Redis | null = null
export function getRedisPublisher(): Redis {
  if (!_publisher) _publisher = new Redis(REDIS_URL, { lazyConnect: false })
  return _publisher
}

/** Creates a fresh subscriber client (must be dedicated — not shared with publisher) */
export function createRedisSubscriber(): Redis {
  return new Redis(REDIS_URL, { lazyConnect: false })
}

/** Redis pub/sub channel for a given tenant's overlay */
export function overlayChannel(tenantId: string): string {
  return `overlay:${tenantId}`
}

/** Redis pub/sub channel for session commands (web → bot) */
export const SESSION_CMD_CHANNEL = (sessionId: string): string => `session:cmd:${sessionId}`

/** Redis pub/sub channel for session lifecycle events (web → bot-worker) */
export const SESSIONS_EVENTS_CHANNEL = 'sessions:events'
