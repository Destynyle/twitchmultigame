import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    alias: {
      'drizzle-orm': path.resolve(__dirname, 'src/__mocks__/drizzle-orm.ts'),
      '@playground/db/schema': path.resolve(__dirname, 'src/__mocks__/@playground/db-schema.ts'),
      '@playground/db': path.resolve(__dirname, 'src/__mocks__/@playground/db.ts'),
    },
  },
})
