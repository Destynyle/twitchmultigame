import { describe, it, expect } from 'vitest'
import { MockChatConnection } from './connections/MockChatConnection'

describe('smoke', () => {
  it('passes basic arithmetic', () => {
    expect(1 + 1).toBe(2)
  })
})

// Test IChatConnection + MockChatConnection (pure logic, no Redis/Twitch)
describe('IChatConnection contract', () => {
  it('MockChatConnection implements IChatConnection', async () => {
    const mock = new MockChatConnection()
    expect(mock.isConnected()).toBe(false)
    await mock.connect()
    expect(mock.isConnected()).toBe(true)
    await mock.sendMessage('#channel', 'hello')
    expect(mock.sentMessages).toContain('#channel:hello')
    await mock.disconnect()
    expect(mock.isConnected()).toBe(false)
  })

  it('MockChatConnection can simulate incoming messages', () => {
    const mock = new MockChatConnection()
    const received: string[] = []
    mock.onMessage((_ch, _user, _display, text) => received.push(text))
    mock.simulateMessage('#test', 'user1', 'User1', 'answer text')
    expect(received).toContain('answer text')
  })
})
