-- Remove FORCE ROW LEVEL SECURITY so the table owner (playground role) bypasses RLS.
-- The playground role is the sole DB user in this app. FORCE RLS was preventing the
-- owner from bypassing policies, breaking admin queries (auth callbacks, provisioning).
-- RLS policies remain active and apply to any other DB user.

ALTER TABLE "tenants" NO FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "users" NO FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "oauth_tokens" NO FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "playlists" NO FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "tracks" NO FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "sessions" NO FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "session_scores" NO FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "game_configs" NO FORCE ROW LEVEL SECURITY;
