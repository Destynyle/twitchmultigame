import pino from 'pino'

export const logger = pino({
  base: { runtime: 'bot-worker' },
  ...(process.env.NODE_ENV === 'development'
    ? { transport: { target: 'pino-pretty' } }
    : {}),
})
