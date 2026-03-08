CREATE TABLE "playlists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"source_type" text DEFAULT 'manual' NOT NULL,
	"source_id" text,
	"track_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "playlists" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "tracks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"playlist_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"title" text NOT NULL,
	"artist" text,
	"duration_seconds" integer,
	"source_type" text,
	"source_id" text,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tracks" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "playlists" ADD CONSTRAINT "playlists_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tracks" ADD CONSTRAINT "tracks_playlist_id_playlists_id_fk" FOREIGN KEY ("playlist_id") REFERENCES "public"."playlists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tracks" ADD CONSTRAINT "tracks_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_playlists_tenant_id" ON "playlists" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_tracks_playlist_id" ON "tracks" USING btree ("playlist_id");--> statement-breakpoint
CREATE INDEX "idx_tracks_tenant_id" ON "tracks" USING btree ("tenant_id");--> statement-breakpoint
CREATE POLICY "playlists_tenant_isolation" ON "playlists" AS PERMISSIVE FOR ALL TO public USING ("playlists"."tenant_id" = current_setting('app.current_tenant_id', true)::uuid);--> statement-breakpoint
CREATE POLICY "tracks_tenant_isolation" ON "tracks" AS PERMISSIVE FOR ALL TO public USING ("tracks"."tenant_id" = current_setting('app.current_tenant_id', true)::uuid);--> statement-breakpoint

-- Force RLS so even the table owner cannot bypass policies (consistent with ADR-06)
ALTER TABLE "playlists" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "tracks" FORCE ROW LEVEL SECURITY;--> statement-breakpoint

-- updated_at triggers for new tables (update_updated_at_column function already exists from migration 0002)
CREATE TRIGGER update_playlists_updated_at
  BEFORE UPDATE ON "playlists"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();--> statement-breakpoint

CREATE TRIGGER update_tracks_updated_at
  BEFORE UPDATE ON "tracks"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();