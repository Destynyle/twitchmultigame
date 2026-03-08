DROP INDEX "idx_oauth_tokens_tenant_provider";--> statement-breakpoint
ALTER TABLE "oauth_tokens" ADD CONSTRAINT "oauth_tokens_tenant_provider_unique" UNIQUE("tenant_id","provider");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_tenant_twitch_unique" UNIQUE("tenant_id","twitch_id");