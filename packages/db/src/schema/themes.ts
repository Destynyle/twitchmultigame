import { pgTable, uuid, text, jsonb, timestamp } from 'drizzle-orm/pg-core'

export const overlayThemes = pgTable('overlay_themes', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  tier: text('tier').notNull().default('free'),
  cssVariables: jsonb('css_variables').notNull().default({}),
  previewColor: text('preview_color').notNull().default('#1a1a2e'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export type OverlayTheme = typeof overlayThemes.$inferSelect
