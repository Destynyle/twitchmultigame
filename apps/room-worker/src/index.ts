import type { Env } from './types'
export { BattleRoom } from './room'

// Public HTTP surface. All room state lives in the BattleRoom Durable Object;
// this router only creates rooms (password-gated) and forwards the rest.

const CORS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

function withCors(res: Response): Response {
  const out = new Response(res.body, res)
  for (const [k, v] of Object.entries(CORS)) out.headers.set(k, v)
  return out
}

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  })

// No 0/O/1/I/L — codes get read out loud on stream.
const CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'
function randomCode(len = 5): string {
  const a = new Uint8Array(len)
  crypto.getRandomValues(a)
  return Array.from(a, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('')
}

async function createRoom(request: Request, env: Env): Promise<Response> {
  const body = (await request.json().catch(() => null)) as {
    password?: string
    config?: Record<string, unknown>
  } | null
  if (!body) return json({ error: 'requête invalide' }, 400)
  if (!env.ROOM_PASSWORD || body.password !== env.ROOM_PASSWORD) {
    return json({ error: 'mot de passe invalide' }, 403)
  }
  // Codes are random; on the (rare) collision with a live room, retry.
  for (let attempt = 0; attempt < 3; attempt++) {
    const code = randomCode()
    const stub = env.ROOMS.get(env.ROOMS.idFromName(code))
    const res = await stub.fetch('https://do/create', {
      method: 'POST',
      body: JSON.stringify({ code, config: body.config ?? {} }),
    })
    if (res.status !== 409) return withCors(res)
  }
  return json({ error: 'réessaie (collision de code)' }, 500)
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS })
    const url = new URL(request.url)
    const path = url.pathname.replace(/\/+$/, '')

    if (path === '/rooms' && request.method === 'POST') return createRoom(request, env)

    // /rooms/:code[/op] → forward to the room's DO as /op (default /view).
    const m = /^\/rooms\/([A-Za-z0-9]{4,8})(?:\/(view|search|submit|admin|ws))?$/.exec(path)
    if (m) {
      const code = m[1]!.toUpperCase()
      const op = m[2] ?? 'view'
      const stub = env.ROOMS.get(env.ROOMS.idFromName(code))
      const target = `https://do/${op}${url.search}`
      // WebSocket upgrades must forward the original request untouched.
      const res =
        op === 'ws'
          ? await stub.fetch(new Request(target, request))
          : await stub.fetch(target, {
              method: request.method,
              ...(request.method === 'POST' ? { body: request.body } : {}),
            })
      return res.status === 101 ? res : withCors(res)
    }

    return json({ error: 'not found' }, 404)
  },
}
