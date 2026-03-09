import { createServer } from 'node:http'
import { env } from '@playground/shared/env'
import { logger } from './logger'
import { SessionRunner } from './session-runner'

logger.info({ env: env.NODE_ENV }, 'bot-worker starting')

const runner = new SessionRunner()
void runner.start()

// Render Web Service requires a bound port — serve a minimal health endpoint
const port = process.env['PORT'] ? parseInt(process.env['PORT']) : 10000
createServer((req, res) => {
  res.writeHead(200)
  res.end('ok')
}).listen(port, () => {
  logger.info({ port }, 'health server listening')
})

process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM, shutting down gracefully')
  runner.stop()
  process.exit(0)
})
