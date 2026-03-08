export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@playground/db'
import { tenants } from '@playground/db/schema'
import { createRedisSubscriber, overlayChannel } from '../../../../../server/redis'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params

  // Resolve tenant by overlay token (public — no auth required)
  const [tenant] = await db
    .select({ id: tenants.id })
    .from(tenants)
    .where(eq(tenants.overlayToken, token))

  if (!tenant) {
    return NextResponse.json({ error: 'Overlay not found' }, { status: 404 })
  }

  const channel = overlayChannel(tenant.id)
  const subscriber = createRedisSubscriber()

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder()

      function send(data: string) {
        controller.enqueue(encoder.encode(`data: ${data}\n\n`))
      }

      // Send a heartbeat immediately so OBS browser source knows it's alive
      send(JSON.stringify({ type: 'connected', tenantId: tenant.id }))

      subscriber.subscribe(channel, (err) => {
        if (err) {
          send(JSON.stringify({ type: 'error', message: 'Redis subscribe failed' }))
          controller.close()
        }
      })

      subscriber.on('message', (_ch: string, message: string) => {
        send(message)
      })

      // Keep-alive ping every 25 seconds to prevent proxy timeouts
      const ping = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': ping\n\n'))
        } catch {
          clearInterval(ping)
        }
      }, 25_000)

      // Cleanup on stream close
      return () => {
        clearInterval(ping)
        subscriber.unsubscribe(channel).catch(() => {})
        subscriber.quit().catch(() => {})
      }
    },
    cancel() {
      subscriber.unsubscribe(channel).catch(() => {})
      subscriber.quit().catch(() => {})
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no', // disable nginx buffering
    },
  })
}
