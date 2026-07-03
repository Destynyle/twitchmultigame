// Client for the battle room backend (apps/room-worker — Cloudflare Worker +
// Durable Objects). Wire types mirror apps/room-worker/src/types.ts.

export interface RoomTrackHit {
  trackId: string
  title: string
  artist: string | null
  cover?: string
}

export interface RoomSubmission {
  id: string
  trackId: string
  title: string
  artist: string | null
  cover?: string
  name: string
  clientId: string
  at: number
}

export interface RoomView {
  code: string
  open: boolean
  theme: string
  maxPerUser: number
  count: number
  maxTotal: number
  mine: Array<Pick<RoomSubmission, 'id' | 'title' | 'artist' | 'cover'>>
}

export type RoomEvent =
  | { type: 'state'; open: boolean; subs: RoomSubmission[] }
  | { type: 'submission'; sub: RoomSubmission }
  | { type: 'open'; open: boolean }
  | { type: 'expired' }

// Deployed worker origin. Baked into the bundle so viewers (who configure
// nothing) can reach the room. Overridable per-browser for dev via localStorage.
const DEFAULT_WORKER_URL = (import.meta.env.VITE_ROOM_WORKER_URL as string | undefined) ?? ''
const URL_KEY = 'battle:workerUrl'
const CLIENT_KEY = 'room:clientId'
const NAME_KEY = 'room:name'

export function getWorkerUrl(): string {
  return (localStorage.getItem(URL_KEY) || DEFAULT_WORKER_URL).replace(/\/+$/, '')
}

export function setWorkerUrl(url: string): void {
  const v = url.trim().replace(/\/+$/, '')
  if (v) localStorage.setItem(URL_KEY, v)
  else localStorage.removeItem(URL_KEY)
}

/** Stable anonymous id for this browser (per-user submission cap server-side). */
export function roomClientId(): string {
  let id = localStorage.getItem(CLIENT_KEY)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(CLIENT_KEY, id)
  }
  return id
}

export function getViewerName(): string {
  return localStorage.getItem(NAME_KEY) ?? ''
}

export function setViewerName(name: string): void {
  localStorage.setItem(NAME_KEY, name.trim())
}

/** Shareable viewer URL for a room code. */
export function roomLink(code: string): string {
  return `${window.location.origin}${import.meta.env.BASE_URL}room/${code}`
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const base = getWorkerUrl()
  if (!base) throw new Error('Room non configurée (URL du worker manquante)')
  const res = await fetch(`${base}${path}`, init)
  const body = (await res.json().catch(() => null)) as ({ error?: string } & T) | null
  if (!res.ok) throw new Error(body?.error ?? `Erreur room (${res.status})`)
  if (!body) throw new Error('Réponse room invalide')
  return body
}

export function createRoom(
  password: string,
  config: { theme: string; maxPerUser: number; maxTotal: number },
): Promise<{ code: string; adminKey: string }> {
  return req('/rooms', { method: 'POST', body: JSON.stringify({ password, config }) })
}

export function fetchRoom(code: string): Promise<RoomView> {
  return req(`/rooms/${code}?clientId=${encodeURIComponent(roomClientId())}`)
}

export function searchRoom(code: string, q: string): Promise<{ hits: RoomTrackHit[] }> {
  const params = new URLSearchParams({ q, clientId: roomClientId() })
  return req(`/rooms/${code}/search?${params}`)
}

export function submitToRoom(
  code: string,
  hit: RoomTrackHit,
  name: string,
): Promise<{ ok: true; count: number }> {
  return req(`/rooms/${code}/submit`, {
    method: 'POST',
    body: JSON.stringify({ ...hit, name, clientId: roomClientId() }),
  })
}

export function roomAdmin(
  code: string,
  key: string,
  action: 'close' | 'reopen' | 'remove',
  id?: string,
): Promise<{ ok: true }> {
  return req(`/rooms/${code}/admin`, {
    method: 'POST',
    body: JSON.stringify({ key, action, ...(id ? { id } : {}) }),
  })
}

/** Admin live feed. Auto-reconnects until close() is called. */
export function openRoomSocket(
  code: string,
  adminKey: string,
  onEvent: (ev: RoomEvent) => void,
  onStatus?: (s: 'connected' | 'reconnecting' | 'closed') => void,
): { close: () => void } {
  let ws: WebSocket | null = null
  let closed = false
  let delay = 1000

  const open = () => {
    const base = getWorkerUrl().replace(/^http/, 'ws')
    ws = new WebSocket(`${base}/rooms/${code}/ws?key=${encodeURIComponent(adminKey)}`)
    ws.onopen = () => {
      delay = 1000
      onStatus?.('connected')
    }
    ws.onmessage = (e) => {
      try {
        onEvent(JSON.parse(e.data as string) as RoomEvent)
      } catch {
        // ignore non-JSON (pong)
      }
    }
    ws.onclose = () => {
      if (closed) {
        onStatus?.('closed')
        return
      }
      onStatus?.('reconnecting')
      setTimeout(open, delay)
      delay = Math.min(delay * 2, 15000)
    }
    ws.onerror = () => ws?.close()
  }
  open()

  return {
    close: () => {
      closed = true
      ws?.close()
    },
  }
}
