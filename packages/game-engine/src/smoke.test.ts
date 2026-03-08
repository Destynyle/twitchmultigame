import { describe, it, expect } from 'vitest'
import type { GamePlugin } from '@playground/game-types'

describe('smoke', () => {
  it('passes basic arithmetic', () => {
    expect(1 + 1).toBe(2)
  })
})

describe('GamePlugin contract', () => {
  it('can implement GamePlugin interface', () => {
    const plugin: GamePlugin = {
      version: '1.0.0',
      onSessionStart: async (_ctx) => {},
      onChatMessage: async (_ctx, _msg) => null,
      onStreamerAction: async (_ctx, _action) => {},
      onReveal: async (_ctx) => {},
      onSessionEnd: async (_ctx) => {},
    }
    expect(plugin.version).toBe('1.0.0')
  })
})
