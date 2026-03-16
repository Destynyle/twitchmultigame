-- Allow INSERT on provisioning tables without tenant context.
-- Needed because Render's DB user is subject to FORCE ROW LEVEL SECURITY
-- (unlike local postgres superuser which bypasses RLS entirely).
-- INSERT policies are permissive — the app layer enforces authorization.

CREATE POLICY tenants_insert ON "tenants"
  FOR INSERT WITH CHECK (true);

CREATE POLICY users_insert ON "users"
  FOR INSERT WITH CHECK (true);

CREATE POLICY oauth_tokens_insert ON "oauth_tokens"
  FOR INSERT WITH CHECK (true);

CREATE POLICY game_configs_insert ON "game_configs"
  FOR INSERT WITH CHECK (true);

CREATE POLICY sessions_insert ON "sessions"
  FOR INSERT WITH CHECK (true);

CREATE POLICY session_scores_insert ON "session_scores"
  FOR INSERT WITH CHECK (true);

CREATE POLICY playlists_insert ON "playlists"
  FOR INSERT WITH CHECK (true);

CREATE POLICY tracks_insert ON "tracks"
  FOR INSERT WITH CHECK (true);
