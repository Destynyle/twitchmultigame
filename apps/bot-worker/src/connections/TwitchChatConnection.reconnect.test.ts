import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MockChatConnection } from './MockChatConnection'

// ─── MockChatConnection reconnect contract ───────────────────────────────────
//
// TwitchChatConnection wraps tmi.js (hard to unit-test without a live server).
// MockChatConnection mirrors the exact same reconnect contract, so we verify
// queue + flush behaviour in isolation here.

describe('MockChatConnection — reconnect contract', () => {
  let conn: MockChatConnection

  beforeEach(() => {
    conn = new MockChatConnection()
  })

  it('delivers messages normally while connected', async () => {
    await conn.connect()
    const received: string[] = []
    conn.onMessage((_ch, _u, _d, text) => received.push(text))

    conn.simulateMessage('ch', 'u1', 'U1', 'hello')
    conn.simulateMessage('ch', 'u2', 'U2', 'world')

    expect(received).toEqual(['hello', 'world'])
  })

  it('queues messages during reconnection window', async () => {
    await conn.connect()
    const received: string[] = []
    conn.onMessage((_ch, _u, _d, text) => received.push(text))

    conn.simulateDisconnect()
    expect(conn.isConnected()).toBe(false)

    conn.simulateMessage('ch', 'u1', 'U1', 'msg-during-drop-1')
    conn.simulateMessage('ch', 'u2', 'U2', 'msg-during-drop-2')

    expect(received).toEqual([]) // not delivered yet
  })

  it('flushes queued messages in order after reconnect', async () => {
    await conn.connect()
    const received: string[] = []
    conn.onMessage((_ch, _u, _d, text) => received.push(text))

    conn.simulateDisconnect()
    conn.simulateMessage('ch', 'u1', 'U1', 'first')
    conn.simulateMessage('ch', 'u2', 'U2', 'second')
    conn.simulateMessage('ch', 'u3', 'U3', 'third')
    conn.simulateReconnect()

    expect(received).toEqual(['first', 'second', 'third'])
  })

  it('fires onReconnect handler after reconnect', async () => {
    await conn.connect()
    const reconnected = vi.fn()
    conn.onReconnect(reconnected)

    conn.simulateDisconnect()
    conn.simulateReconnect()

    expect(reconnected).toHaveBeenCalledOnce()
  })

  it('does not fire onReconnect on initial connect', async () => {
    const reconnected = vi.fn()
    conn.onReconnect(reconnected)
    await conn.connect()
    expect(reconnected).not.toHaveBeenCalled()
  })

  it('resumes normal delivery after reconnect', async () => {
    await conn.connect()
    const received: string[] = []
    conn.onMessage((_ch, _u, _d, text) => received.push(text))

    conn.simulateDisconnect()
    conn.simulateReconnect()

    conn.simulateMessage('ch', 'u1', 'U1', 'after-reconnect')
    expect(received).toContain('after-reconnect')
  })
})
