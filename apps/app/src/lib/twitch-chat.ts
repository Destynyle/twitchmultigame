// Anonymous read-only Twitch chat reader.
// Connects via WSS with a `justinfan` login — no token, no auth, no scopes.
// Spec: https://dev.twitch.tv/docs/irc/

export interface IncomingChat {
  username: string
  displayName: string
  text: string
  timestamp: Date
}

type Handlers = {
  onMessage: (msg: IncomingChat) => void
  onStatus?: (status: 'connecting' | 'connected' | 'reconnecting' | 'closed') => void
}

const WS_URL = 'wss://irc-ws.chat.twitch.tv:443'

export class TwitchChatReader {
  private ws: WebSocket | null = null
  private channel: string
  private handlers: Handlers
  private closedByUser = false
  private reconnectDelay = 1000
  private lastActivity = 0
  private watchdog: ReturnType<typeof setInterval> | null = null

  // Twitch sends a server PING every few minutes; we treat ANY inbound line as a
  // liveness signal. If nothing arrives for this long the socket is silently dead
  // (no close event) so we force a reconnect.
  private static readonly STALE_MS = 360000

  constructor(channel: string, handlers: Handlers) {
    this.channel = channel.trim().toLowerCase().replace(/^#/, '')
    this.handlers = handlers
  }

  connect(): void {
    this.closedByUser = false
    this.handlers.onStatus?.('connecting')
    this.open()
  }

  private open(): void {
    const ws = new WebSocket(WS_URL)
    this.ws = ws

    ws.onopen = () => {
      // Anonymous login: any justinfan<random> nick, no PASS needed.
      const nick = `justinfan${Math.floor(Math.random() * 100000)}`
      ws.send('CAP REQ :twitch.tv/tags twitch.tv/commands')
      ws.send(`NICK ${nick}`)
      ws.send(`JOIN #${this.channel}`)
      this.reconnectDelay = 1000
      this.lastActivity = Date.now()
      this.startWatchdog()
      this.handlers.onStatus?.('connected')
    }

    ws.onmessage = (ev) => {
      this.lastActivity = Date.now()
      const data = typeof ev.data === 'string' ? ev.data : ''
      for (const line of data.split('\r\n')) {
        if (!line) continue
        if (line.startsWith('PING')) {
          ws.send('PONG :tmi.twitch.tv')
          continue
        }
        const parsed = parsePrivmsg(line)
        if (parsed) this.handlers.onMessage(parsed)
      }
    }

    ws.onclose = () => {
      this.stopWatchdog()
      if (this.closedByUser) {
        this.handlers.onStatus?.('closed')
        return
      }
      this.handlers.onStatus?.('reconnecting')
      setTimeout(() => this.open(), this.reconnectDelay)
      this.reconnectDelay = Math.min(this.reconnectDelay * 2, 15000)
    }

    ws.onerror = () => {
      // onclose fires after onerror — reconnect handled there.
      ws.close()
    }
  }

  private startWatchdog(): void {
    this.stopWatchdog()
    this.watchdog = setInterval(() => {
      if (Date.now() - this.lastActivity > TwitchChatReader.STALE_MS) {
        // Force a close → triggers the reconnect path in onclose.
        this.ws?.close()
      }
    }, 30000)
  }

  private stopWatchdog(): void {
    if (this.watchdog) clearInterval(this.watchdog)
    this.watchdog = null
  }

  disconnect(): void {
    this.closedByUser = true
    this.stopWatchdog()
    this.ws?.close()
    this.ws = null
  }
}

// ─── Authenticated sender ────────────────────────────────────────────────────
// Separate socket from the anonymous reader: needs PASS/NICK with the streamer's
// token (chat:edit). Only SENDS — incoming PRIVMSGs keep flowing via the reader.

export type SenderStatus = 'connecting' | 'connected' | 'reconnecting' | 'closed' | 'auth-failed'

// Twitch rate limit is 20 msgs/30s for a regular user in someone else's channel;
// 1.6s spacing stays under it even if the streamer reads a channel they don't mod.
const SEND_SPACING_MS = 1600
const QUEUE_MAX = 10

export class TwitchChatSender {
  private ws: WebSocket | null = null
  private channel: string
  private login: string
  private token: string
  private onStatus: ((s: SenderStatus) => void) | undefined
  private closedByUser = false
  private authFailed = false
  private reconnectDelay = 1000
  private queue: string[] = []
  private lastSentAt = 0
  private flushTimer: ReturnType<typeof setTimeout> | null = null

  constructor(
    channel: string,
    creds: { login: string; token: string },
    onStatus?: (s: SenderStatus) => void,
  ) {
    this.channel = channel.trim().toLowerCase().replace(/^#/, '')
    this.login = creds.login
    this.token = creds.token
    this.onStatus = onStatus
  }

  connect(): void {
    this.closedByUser = false
    this.onStatus?.('connecting')
    this.open()
  }

  /** Queue a message (dropped when the queue is full or auth failed). */
  say(text: string): void {
    if (this.authFailed || this.queue.length >= QUEUE_MAX) return
    this.queue.push(text)
    this.flush()
  }

  private flush(): void {
    if (this.flushTimer || this.queue.length === 0) return
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return
    const wait = Math.max(0, this.lastSentAt + SEND_SPACING_MS - Date.now())
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null
      const msg = this.queue.shift()
      if (msg && this.ws?.readyState === WebSocket.OPEN) {
        // Strip CR/LF — a raw newline in the payload would inject IRC commands.
        this.ws.send(`PRIVMSG #${this.channel} :${msg.replace(/[\r\n]+/g, ' ')}`)
        this.lastSentAt = Date.now()
      }
      this.flush()
    }, wait)
  }

  private open(): void {
    const ws = new WebSocket(WS_URL)
    this.ws = ws

    ws.onopen = () => {
      ws.send(`PASS oauth:${this.token}`)
      ws.send(`NICK ${this.login}`)
      ws.send(`JOIN #${this.channel}`)
      this.reconnectDelay = 1000
      this.onStatus?.('connected')
      this.flush()
    }

    ws.onmessage = (ev) => {
      const data = typeof ev.data === 'string' ? ev.data : ''
      for (const line of data.split('\r\n')) {
        if (!line) continue
        if (line.startsWith('PING')) {
          ws.send('PONG :tmi.twitch.tv')
          continue
        }
        // Expired/revoked token — reconnecting would loop forever, so stop.
        if (line.includes('Login authentication failed')) {
          this.authFailed = true
          this.closedByUser = true
          this.onStatus?.('auth-failed')
          ws.close()
        }
      }
    }

    ws.onclose = () => {
      if (this.flushTimer) clearTimeout(this.flushTimer)
      this.flushTimer = null
      if (this.closedByUser) {
        if (!this.authFailed) this.onStatus?.('closed')
        return
      }
      this.onStatus?.('reconnecting')
      setTimeout(() => this.open(), this.reconnectDelay)
      this.reconnectDelay = Math.min(this.reconnectDelay * 2, 15000)
    }

    ws.onerror = () => {
      ws.close()
    }
  }

  disconnect(): void {
    this.closedByUser = true
    if (this.flushTimer) clearTimeout(this.flushTimer)
    this.flushTimer = null
    this.queue = []
    this.ws?.close()
    this.ws = null
  }
}

// Parses an IRC line, returning the chat message if it's a PRIVMSG.
function parsePrivmsg(line: string): IncomingChat | null {
  let rest = line
  let tags: Record<string, string> = {}

  if (rest.startsWith('@')) {
    const sp = rest.indexOf(' ')
    tags = parseTags(rest.slice(1, sp))
    rest = rest.slice(sp + 1)
  }

  // rest: :user!user@user.tmi.twitch.tv PRIVMSG #channel :text
  if (!rest.startsWith(':')) return null
  const sp2 = rest.indexOf(' ')
  const prefix = rest.slice(1, sp2)
  rest = rest.slice(sp2 + 1)

  if (!rest.startsWith('PRIVMSG')) return null
  const colon = rest.indexOf(' :')
  if (colon === -1) return null
  const text = rest.slice(colon + 2)

  const username = prefix.split('!')[0] ?? 'unknown'
  const displayName = tags['display-name'] || username

  return { username, displayName, text, timestamp: new Date() }
}

function parseTags(raw: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const pair of raw.split(';')) {
    const eq = pair.indexOf('=')
    if (eq === -1) continue
    out[pair.slice(0, eq)] = pair.slice(eq + 1)
  }
  return out
}
