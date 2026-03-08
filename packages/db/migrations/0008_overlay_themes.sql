CREATE TABLE "overlay_themes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "slug" text NOT NULL,
  "tier" text NOT NULL DEFAULT 'free',
  "css_variables" jsonb NOT NULL DEFAULT '{}',
  "preview_color" text NOT NULL DEFAULT '#1a1a2e',
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "selected_theme_id" uuid;
--> statement-breakpoint
ALTER TABLE "tenants" ADD CONSTRAINT "tenants_selected_theme_id_fkey"
  FOREIGN KEY ("selected_theme_id") REFERENCES "overlay_themes"("id") ON DELETE SET NULL;
--> statement-breakpoint
INSERT INTO "overlay_themes" ("name", "slug", "tier", "css_variables", "preview_color") VALUES
  ('Dark', 'dark', 'free', '{"--overlay-bg":"rgba(0,0,0,0.85)","--overlay-text":"#ffffff","--overlay-accent":"#a855f7","--overlay-card":"rgba(30,30,30,0.9)","--overlay-border":"rgba(255,255,255,0.1)"}', '#0d0d0d'),
  ('Light', 'light', 'free', '{"--overlay-bg":"rgba(255,255,255,0.92)","--overlay-text":"#1a1a1a","--overlay-accent":"#7c3aed","--overlay-card":"rgba(245,245,245,0.95)","--overlay-border":"rgba(0,0,0,0.1)"}', '#f5f5f5'),
  ('Neon', 'neon', 'pro', '{"--overlay-bg":"rgba(5,0,30,0.9)","--overlay-text":"#00ffff","--overlay-accent":"#ff00ff","--overlay-card":"rgba(0,20,40,0.85)","--overlay-border":"rgba(0,255,255,0.3)"}', '#050014'),
  ('Minimal', 'minimal', 'pro', '{"--overlay-bg":"rgba(18,18,18,0.7)","--overlay-text":"#e0e0e0","--overlay-accent":"#64748b","--overlay-card":"rgba(30,30,30,0.6)","--overlay-border":"rgba(100,116,139,0.2)"}', '#121212'),
  ('Retro', 'retro', 'pro', '{"--overlay-bg":"rgba(20,10,0,0.9)","--overlay-text":"#ffd700","--overlay-accent":"#ff6600","--overlay-card":"rgba(40,20,0,0.85)","--overlay-border":"rgba(255,215,0,0.3)"}', '#140a00');
