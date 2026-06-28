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
