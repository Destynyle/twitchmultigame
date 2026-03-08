import { describe, it, expect, vi, beforeEach } from 'vitest'
import { BotSession } from './bot-session'
import { BlindtestPlugin } from '@playground/game-engine'
import { MockChatConnection } from './connections/MockChatConnection'

// ─── Mock data ───────────────────────────────────────────────────────────────

const mockSessionRow = {
  id: 'session-1',
  tenantId: 'tenant-1',
  playlistId: 'playlist-1',
  gameType: 'blindtest' as const,
  status: 'active' as const,
  isTestMode: 'true',
  currentTrackIndex: 0,
  startedAt: null,
  endedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
}

const mockTracks = [
  { title: 'Bohemian Rhapsody', artist: 'Queen', position: 0 },
  { title: 'Stairway to Heaven', artist: 'Led Zeppelin', position: 1 },
]

// ─── Shared state across mock instances ──────────────────────────────────────

// These are shared by reference so all mock instances modify the same arrays
const sharedState = {
  publishedMessages: [] as Array<{ channel: string; message: string }>,
  messageHandlers: [] as Array<(channel: string, message: string) => void>,
}

// ─── Chainable query builder helper ─────────────────────────────────────────

function makeChainableQuery(result: unknown) {
  const builder: Record<string, unknown> = {}
  const returnSelf = () => builder
  builder.from = vi.fn(returnSelf)
  builder.where = vi.fn(returnSelf)
  builder.orderBy = vi.fn(returnSelf)
  builder.limit = vi.fn(returnSelf)
  builder.then = (
    onFulfilled: (value: unknown) => unknown,
    onRejected?: (reason: unknown) => unknown
  ) => Promise.resolve(result).then(onFulfilled, onRejected)
  return builder
}

// ─── Query sequence state ─────────────────────────────────────────────────────

const queryState = {
  sequence: [] as unknown[],
  index: 0,
  nextResult() {
    const r = this.sequence[this.index]
    this.index++
    return r ?? []
  },
  reset(...results: unknown[]) {
    this.sequence = results
    this.index = 0
  },
}

// ─── Mock tx ─────────────────────────────────────────────────────────────────

const mockTx = {
  select: vi.fn(() => makeChainableQuery(queryState.nextResult())),
  insert: vi.fn(() => ({
    values: vi.fn(() => Promise.resolve()),
  })),
  update: vi.fn(() => ({
    set: vi.fn(() => ({
      where: vi.fn(() => Promise.resolve()),
    })),
  })),
}

// ─── Mock @playground/db ─────────────────────────────────────────────────────

vi.mock('@playground/db', () => ({
  db: {},
  withTenantContext: vi.fn(),
}))

// ─── Mock ioredis — all instances share sharedState ─────────────────────────

vi.mock('ioredis', () => ({
  default: vi.fn(() => {
    const instance = {
      publish: vi.fn(async (channel: string, message: string) => {
        sharedState.publishedMessages.push({ channel, message })
        return 1
      }),
      subscribe: vi.fn(async () => {}),
      unsubscribe: vi.fn(async () => {}),
      disconnect: vi.fn(),
      on: vi.fn((event: string, handler: (channel: string, msg: string) => void) => {
        if (event === 'message') sharedState.messageHandlers.push(handler)
      }),
    }
    return instance
  }),
}))

// ─── Import the mocked db module ──────────────────────────────────────────────

import * as dbModule from '@playground/db'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function setupTx(...results: unknown[]) {
  queryState.reset(...results)

  mockTx.select.mockImplementation(() => makeChainableQuery(queryState.nextResult()))
  mockTx.insert.mockReturnValue({ values: vi.fn(() => Promise.resolve()) })
  mockTx.update.mockReturnValue({
    set: vi.fn(() => ({ where: vi.fn(() => Promise.resolve()) })),
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vi.mocked(dbModule.withTenantContext).mockImplementation(async (_tenantId: string, callback: any) => {
    return (callback as (tx: typeof mockTx) => Promise<unknown>)(mockTx)
  })
}

function fireMessage(message: string) {
  for (const handler of sharedState.messageHandlers) {
    handler('session:cmd:session-1', message)
  }
}

function createBotSession() {
  const plugin = new BlindtestPlugin()
  const connection = new MockChatConnection()
  const session = new BotSession({
    sessionId: 'session-1',
    tenantId: 'tenant-1',
    twitchLogin: 'testchannel',
    plugin,
    connection,
    redisUrl: 'redis://localhost:6379',
  })
  return { session, plugin, connection }
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('BotSession', () => {
  beforeEach(() => {
    sharedState.publishedMessages.length = 0
    sharedState.messageHandlers.length = 0
  })

  it('starts and publishes initial state', async () => {
    setupTx([mockSessionRow], mockTracks)

    const { session } = createBotSession()
    await session.start()

    const stateEvents = sharedState.publishedMessages.filter((m) => {
      const parsed = JSON.parse(m.message) as { type: string }
      return parsed.type === 'state'
    })

    expect(stateEvents.length).toBeGreaterThan(0)

    const lastState = JSON.parse(stateEvents[stateEvents.length - 1]!.message) as {
      type: string
      status: string
      trackTitle: string
    }
    expect(lastState.status).toBe('active')
    expect(lastState.trackTitle).toBe('Bohemian Rhapsody')

    await session.stop()
  })

  it('onChatMessage triggers a scoring event when correct answer given', async () => {
    // start(): session, tracks
    // upsertScore: existing scores [] → insert path
    // getLeaderboard: []
    setupTx([mockSessionRow], mockTracks, [], [])

    const { session, connection } = createBotSession()
    await session.start()

    sharedState.publishedMessages.length = 0

    connection.simulateMessage('testchannel', 'viewer1', 'Viewer One', 'Queen')

    await new Promise((resolve) => setTimeout(resolve, 50))

    const scoringEvents = sharedState.publishedMessages.filter((m) => {
      const parsed = JSON.parse(m.message) as { type: string }
      return parsed.type === 'scoring'
    })

    expect(scoringEvents.length).toBeGreaterThan(0)

    const event = JSON.parse(scoringEvents[0]!.message) as {
      type: string
      viewerUsername: string
      points: number
    }
    expect(event.viewerUsername).toBe('viewer1')
    expect(event.points).toBeGreaterThan(0)

    await session.stop()
  })

  it('handles next command and loads next track', async () => {
    // start(): session, tracks
    // handleNext(): session for index, tracks for new track, leaderboard
    setupTx([mockSessionRow], mockTracks, [mockSessionRow], mockTracks, [])

    const { session } = createBotSession()
    await session.start()

    sharedState.publishedMessages.length = 0

    fireMessage(JSON.stringify({ action: 'next' }))

    await new Promise((resolve) => setTimeout(resolve, 50))

    const stateEvents = sharedState.publishedMessages.filter((m) => {
      const parsed = JSON.parse(m.message) as { type: string }
      return parsed.type === 'state'
    })
    expect(stateEvents.length).toBeGreaterThan(0)

    await session.stop()
  })

  it('handles end command and stops the session', async () => {
    const endedSession = { ...mockSessionRow, status: 'ended' as const }
    // start(): session, tracks
    // handleEnd(): re-fetch session after update
    setupTx([mockSessionRow], mockTracks, [endedSession])

    const { session } = createBotSession()
    await session.start()

    sharedState.publishedMessages.length = 0

    fireMessage(JSON.stringify({ action: 'end' }))

    await new Promise((resolve) => setTimeout(resolve, 100))

    const endedEvents = sharedState.publishedMessages.filter((m) => {
      const parsed = JSON.parse(m.message) as { type: string; status?: string }
      return parsed.type === 'state' && parsed.status === 'ended'
    })
    expect(endedEvents.length).toBeGreaterThan(0)
  })

  it('publishes system/reconnected event and processes queued messages after reconnect', async () => {
    // start(): session + tracks; upsertScore insert path: []; getLeaderboard: []
    setupTx([mockSessionRow], mockTracks, [], [])

    const { session, connection } = createBotSession()
    await session.start()

    sharedState.publishedMessages.length = 0

    // Simulate drop — messages arriving during reconnect window must be queued
    connection.simulateDisconnect()
    connection.simulateMessage('testchannel', 'viewer1', 'Viewer1', 'Queen')

    // Nothing processed yet
    expect(sharedState.publishedMessages.filter((m) => {
      const p = JSON.parse(m.message) as { type: string }
      return p.type === 'scoring'
    }).length).toBe(0)

    // Reconnect — queued message flushed, scoring fires, system event fires
    connection.simulateReconnect()

    await new Promise((resolve) => setTimeout(resolve, 50))

    const systemEvents = sharedState.publishedMessages.filter((m) => {
      const p = JSON.parse(m.message) as { type: string; event?: string }
      return p.type === 'system' && p.event === 'reconnected'
    })
    expect(systemEvents.length).toBeGreaterThan(0)

    const scoringEvents = sharedState.publishedMessages.filter((m) => {
      const p = JSON.parse(m.message) as { type: string }
      return p.type === 'scoring'
    })
    expect(scoringEvents.length).toBeGreaterThan(0)

    await session.stop()
  })
})
