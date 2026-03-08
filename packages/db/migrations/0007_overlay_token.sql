ALTER TABLE "tenants" ADD COLUMN "overlay_token" text;--> statement-breakpoint
ALTER TABLE "tenants" ADD CONSTRAINT "tenants_overlay_token_unique" UNIQUE("overlay_token");
