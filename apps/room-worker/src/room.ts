import { DurableObject } from 'cloudflare:workers'
import { searchTracks } from './spotify'
import { validateTwitchToken, type TwitchIdentity } from './twitch'
import type { Env, RoomConfig, RoomSubmission, RoomView, SubmissionSource } from './types'

// One Durable Object = one ephemeral submission room. The streamer's admin tab
// connects over WebSocket to receive submissions live; viewers use plain REST.
// Rooms self-destruct via alarm — nothing is meant to outlive the stream.

interface Meta {
  code: string
  adminKey: string
  config: RoomConfig
  open: boolean
  createdAt: number
}

const TTL_MS = 12 * 60 * 60 * 1000
const SEARCH_PER_MIN = 10
const SUBMIT_PER_MIN = 5
// Room-wide caps: clientId is client-chosen, so rotating ids bypasses the
// per-client buckets — these bound the damage (Spotify quota, storage writes).
const ROOM_SEARCH_PER_MIN = 60
const ROOM_SUBMIT_PER_MIN = 30

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })
const err = (message: string, status: number) => json({ error: message }, status)

function sanitizeName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const name = raw.replace(/[\u0000-\u001f\u007f]/gu, "").trim().slice(0, 25)
  return name.length >= 1 ? name : null
}

// Album art / thumbnail hosts we accept — never an arbitrary viewer URL.
const COVER_HOSTS = ['https://i.scdn.co/', 'https://i.ytimg.com/', 'https://img.youtube.com/']

function subKey(s: SubmissionSource): string {
  return s.kind === 'spotify' ? `sp:${s.trackId}` : `yt:${s.videoId}`
}

export class BattleRoom extends DurableObject<Env> {
  // In-memory rate buckets (clientId → recent call timestamps). Lost on
  // hibernation/eviction, which only ever makes limits more permissive.
  private rate = new Map<string, number[]>()

  private allow(clientId: string, op: string, perMin: number): boolean {
    const key = `${op}:${clientId}`
    const now = Date.now()
    const hits = (this.rate.get(key) ?? []).filter((t) => now - t < 60000)
    if (hits.length >= perMin) return false
    hits.push(now)
    this.rate.set(key, hits)
    return true
  }

  private async meta(): Promise<Meta | null> {
    return (await this.ctx.storage.get<Meta>('meta')) ?? null
  }

  private async subs(): Promise<RoomSubmission[]> {
    return (await this.ctx.storage.get<RoomSubmission[]>('subs')) ?? []
  }

  private broadcast(msg: unknown): void {
    const data = JSON.stringify(msg)
    for (const ws of this.ctx.getWebSockets('admin')) {
      try {
        ws.send(data)
      } catch {
        // socket already gone — hibernation API cleans it up
      }
    }
  }

  override async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)
    switch (url.pathname) {
      case '/create':
        return this.create(request)
      case '/view':
        return this.view(url)
      case '/search':
        return this.search(url)
      case '/submit':
        return this.submit(request)
      case '/admin':
        return this.admin(request)
      case '/ws':
        return this.adminSocket(request, url)
      default:
        return err('not found', 404)
    }
  }

  private async create(request: Request): Promise<Response> {
    if (await this.meta()) return err('code collision', 409)
    const body = (await request.json()) as { code: string; config: Partial<RoomConfig> }
    const meta: Meta = {
      code: body.code,
      adminKey: crypto.randomUUID(),
      config: {
        theme: String(body.config.theme ?? '').slice(0, 80),
        maxPerUser: Math.min(20, Math.max(1, Number(body.config.maxPerUser) || 2)),
        maxTotal: Math.min(64, Math.max(2, Number(body.config.maxTotal) || 16)),
        requireTwitch: body.config.requireTwitch === true && !!this.env.TWITCH_CLIENT_ID,
      },
      open: true,
      createdAt: Date.now(),
    }
    await this.ctx.storage.put('meta', meta)
    await this.ctx.storage.setAlarm(Date.now() + TTL_MS)
    return json({ code: meta.code, adminKey: meta.adminKey })
  }

  private async view(url: URL): Promise<Response> {
    const meta = await this.meta()
    if (!meta) return err('room introuvable ou expirée', 404)
    const clientId = url.searchParams.get('clientId') ?? ''
    const subs = await this.subs()
    const view: RoomView = {
      code: meta.code,
      open: meta.open,
      theme: meta.config.theme,
      maxPerUser: meta.config.maxPerUser,
      count: subs.length,
      maxTotal: meta.config.maxTotal,
      twitchClientId: this.env.TWITCH_CLIENT_ID ?? null,
      requireTwitch: meta.config.requireTwitch ?? false,
      mine: subs
        .filter((s) => s.clientId === clientId)
        .map(({ id, title, artist, cover }) => ({ id, title, artist, ...(cover ? { cover } : {}) })),
    }
    return json(view)
  }

  private async search(url: URL): Promise<Response> {
    const meta = await this.meta()
    if (!meta) return err('room introuvable ou expirée', 404)
    if (!meta.open) return err('les soumissions sont fermées', 409)
    const clientId = (url.searchParams.get('clientId') ?? '').slice(0, 64)
    if (!clientId) return err('clientId requis', 400)
    if (!this.allow(clientId, 'search', SEARCH_PER_MIN)) return err('doucement — réessaie dans une minute', 429)
    if (!this.allow('*', 'search-room', ROOM_SEARCH_PER_MIN)) return err('la room est surchargée — réessaie dans une minute', 429)
    try {
      return json({ hits: await searchTracks(this.env, url.searchParams.get('q') ?? '') })
    } catch {
      return err('recherche Spotify indisponible', 502)
    }
  }

  private async submit(request: Request): Promise<Response> {
    const meta = await this.meta()
    if (!meta) return err('room introuvable ou expirée', 404)
    if (!meta.open) return err('les soumissions sont fermées', 409)

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
    if (!body) return err('requête invalide', 400)
    const clientId = String(body.clientId ?? '').slice(0, 64)
    const trackId = String(body.trackId ?? '')
    const videoId = String(body.videoId ?? '')
    const title = String(body.title ?? '').trim().slice(0, 120)
    const artist = body.artist == null ? null : String(body.artist).trim().slice(0, 120) || null
    const cover = String(body.cover ?? '')

    // Verified Twitch identity beats (and replaces) the self-chosen pseudo.
    const twitchToken = String(body.twitchToken ?? '')
    let twitch: TwitchIdentity | null = null
    if (twitchToken) {
      twitch = await validateTwitchToken(twitchToken, this.env.TWITCH_CLIENT_ID)
      if (!twitch) return err('session Twitch invalide — reconnecte-toi', 401)
    }
    if (meta.config.requireTwitch && !twitch) return err('connexion Twitch requise', 403)
    const name = twitch ? sanitizeName(twitch.displayName) : sanitizeName(body.name)

    if (!clientId || !name || !title) return err('pseudo ou titre manquant', 400)
    let source: SubmissionSource
    if (/^[A-Za-z0-9]{22}$/.test(trackId)) source = { kind: 'spotify', trackId }
    else if (/^[A-Za-z0-9_-]{11}$/.test(videoId)) source = { kind: 'youtube', videoId }
    else return err('track invalide', 400)
    // Rate-limit and cap by Twitch account when verified (stronger than a
    // per-browser id, which clearing localStorage resets).
    const ownerKey = twitch ? `tw:${twitch.userId}` : clientId
    if (!this.allow(ownerKey, 'submit', SUBMIT_PER_MIN)) return err('doucement — réessaie dans une minute', 429)
    if (!this.allow('*', 'submit-room', ROOM_SUBMIT_PER_MIN)) return err('la room est surchargée — réessaie dans une minute', 429)

    const subs = await this.subs()
    if (subs.length >= meta.config.maxTotal) return err('room pleine', 409)
    if (subs.some((s) => subKey(s.source) === subKey(source))) return err('déjà proposé par quelqu’un', 409)
    const mine = subs.filter((s) =>
      twitch ? s.twitchId === twitch.userId : !s.twitchId && s.clientId === clientId,
    )
    if (mine.length >= meta.config.maxPerUser) {
      return err(`limite atteinte (${meta.config.maxPerUser} max par personne)`, 409)
    }

    const sub: RoomSubmission = {
      id: crypto.randomUUID(),
      source,
      title,
      artist,
      ...(COVER_HOSTS.some((h) => cover.startsWith(h)) ? { cover } : {}),
      name,
      clientId,
      ...(twitch ? { twitchId: twitch.userId } : {}),
      at: Date.now(),
    }
    subs.push(sub)
    await this.ctx.storage.put('subs', subs)
    this.broadcast({ type: 'submission', sub })
    return json({ ok: true, count: subs.length })
  }

  /** Admin REST ops (close/reopen/remove) — authenticated by the adminKey. */
  private async admin(request: Request): Promise<Response> {
    const meta = await this.meta()
    if (!meta) return err('room introuvable ou expirée', 404)
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
    if (!body || body.key !== meta.adminKey) return err('clé admin invalide', 403)
    if (body.action === 'close' || body.action === 'reopen') {
      meta.open = body.action === 'reopen'
      await this.ctx.storage.put('meta', meta)
      this.broadcast({ type: 'open', open: meta.open })
      return json({ ok: true })
    }
    if (body.action === 'remove' && typeof body.id === 'string') {
      const subs = await this.subs()
      await this.ctx.storage.put('subs', subs.filter((s) => s.id !== body.id))
      return json({ ok: true })
    }
    return err('action inconnue', 400)
  }

  private async adminSocket(request: Request, url: URL): Promise<Response> {
    const meta = await this.meta()
    if (!meta) return err('room introuvable ou expirée', 404)
    if (url.searchParams.get('key') !== meta.adminKey) return err('clé admin invalide', 403)
    if (request.headers.get('Upgrade') !== 'websocket') return err('websocket attendu', 426)
    const pair = new WebSocketPair()
    // Hibernation API — the DO can be evicted while the socket stays open.
    this.ctx.acceptWebSocket(pair[1], ['admin'])
    pair[1].send(JSON.stringify({ type: 'state', open: meta.open, subs: await this.subs() }))
    return new Response(null, { status: 101, webSocket: pair[0] })
  }

  override async webSocketMessage(ws: WebSocket, message: ArrayBuffer | string): Promise<void> {
    if (message === 'ping') ws.send('pong')
  }

  override async alarm(): Promise<void> {
    this.broadcast({ type: 'expired' })
    for (const ws of this.ctx.getWebSockets()) ws.close(1000, 'room expirée')
    await this.ctx.storage.deleteAll()
  }
}
