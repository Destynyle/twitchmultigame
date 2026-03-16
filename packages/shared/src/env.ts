import { z } from 'zod'

// Vars required by ALL services (web + bot-worker)
const sharedSchema = z.object({
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  TOKEN_ENCRYPTION_KEY: z
    .string()
    .length(64)
    .regex(/^[0-9a-fA-F]{64}$/, 'Must be exactly 64 hex characters'),
  NODE_ENV: z.enum(['development', 'test', 'production']),
})

// Vars required by the web app only
const webSchema = sharedSchema.extend({
  AUTH_SECRET: z.string().min(32),
  TWITCH_CLIENT_ID: z.string().min(1),
  TWITCH_CLIENT_SECRET: z.string().min(1),
  SPOTIFY_CLIENT_ID: z.string().min(1),
  SPOTIFY_CLIENT_SECRET: z.string().min(1),
  CRON_SECRET: z.string().min(32),
})

export type SharedEnv = z.infer<typeof sharedSchema>
export type Env = z.infer<typeof webSchema>

function buildEnv(): Env {
  if (process.env.SKIP_ENV_VALIDATION) {
    return process.env as unknown as Env
  }
  const shared = sharedSchema.parse(process.env)
  return {
    ...shared,
    // Web-only vars: read from process.env, validated separately via validateWebEnv()
    AUTH_SECRET: process.env.AUTH_SECRET ?? '',
    TWITCH_CLIENT_ID: process.env.TWITCH_CLIENT_ID ?? '',
    TWITCH_CLIENT_SECRET: process.env.TWITCH_CLIENT_SECRET ?? '',
    SPOTIFY_CLIENT_ID: process.env.SPOTIFY_CLIENT_ID ?? '',
    SPOTIFY_CLIENT_SECRET: process.env.SPOTIFY_CLIENT_SECRET ?? '',
    CRON_SECRET: process.env.CRON_SECRET ?? '',
  }
}

export const env: Env = buildEnv()

/** Call once at web app startup to ensure all web-only vars are present. */
export function validateWebEnv(): Env {
  return webSchema.parse(process.env)
}
