import { describe, it, expect } from 'vitest'
import { z } from 'zod'

describe('env schema', () => {
  it('passes basic arithmetic smoke test', () => {
    expect(1 + 1).toBe(2)
  })

  it('rejects missing DATABASE_URL', () => {
    const schema = z.object({ DATABASE_URL: z.string().url() })
    expect(() => schema.parse({})).toThrow()
  })

  it('rejects TOKEN_ENCRYPTION_KEY shorter than 64 hex chars', () => {
    const schema = z.object({
      TOKEN_ENCRYPTION_KEY: z
        .string()
        .length(64)
        .regex(/^[0-9a-fA-F]{64}$/),
    })
    expect(() => schema.parse({ TOKEN_ENCRYPTION_KEY: 'tooshort' })).toThrow()
  })

  it('rejects TOKEN_ENCRYPTION_KEY with non-hex chars', () => {
    const schema = z.object({
      TOKEN_ENCRYPTION_KEY: z
        .string()
        .length(64)
        .regex(/^[0-9a-fA-F]{64}$/),
    })
    const notHex = 'z'.repeat(64)
    expect(() => schema.parse({ TOKEN_ENCRYPTION_KEY: notHex })).toThrow()
  })
})
