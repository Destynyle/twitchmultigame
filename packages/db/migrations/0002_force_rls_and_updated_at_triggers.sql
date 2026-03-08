-- Force RLS on all tenant tables so even the table owner cannot bypass policies (ADR-06)
ALTER TABLE "tenants" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "users" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "oauth_tokens" FORCE ROW LEVEL SECURITY;--> statement-breakpoint

-- Trigger function: auto-update updated_at on every UPDATE
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint

CREATE TRIGGER update_tenants_updated_at
  BEFORE UPDATE ON "tenants"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();--> statement-breakpoint

CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON "users"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();--> statement-breakpoint

CREATE TRIGGER update_oauth_tokens_updated_at
  BEFORE UPDATE ON "oauth_tokens"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
