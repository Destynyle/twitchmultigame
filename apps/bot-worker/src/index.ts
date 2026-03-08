import { env } from '@playground/shared/env'
import { logger } from './logger'
import { SessionRunner } from './session-runner'

logger.info({ env: env.NODE_ENV }, 'bot-worker starting')

const runner = new SessionRunner()
void runner.start()

process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM, shutting down gracefully')
  runner.stop()
  process.exit(0)
})
