import { z } from 'zod'

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  AUTH_SECRET: z.string().min(32),
  TOKEN_ENCRYPTION_KEY: z
    .string()
    .length(64)
    .regex(/^[0-9a-fA-F]{64}$/, 'Must be exactly 64 hex characters'),
  TWITCH_CLIENT_ID: z.string().min(1),
  TWITCH_CLIENT_SECRET: z.string().min(1),
  SPOTIFY_CLIENT_ID: z.string().min(1),
  SPOTIFY_CLIENT_SECRET: z.string().min(1),
  NODE_ENV: z.enum(['development', 'test', 'production']),
  // Cron job authentication — must be a long random string
  CRON_SECRET: z.string().min(32),
})

export const env = envSchema.parse(process.env)

export type Env = z.infer<typeof envSchema>
