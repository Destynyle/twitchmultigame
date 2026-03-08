-- Soft-delete support for playlists (needed for content moderation)
ALTER TABLE "playlists" ADD COLUMN "deleted_at" timestamp with time zone;
--> statement-breakpoint

-- Content reports table (cross-tenant — no RLS tenant isolation)
CREATE TABLE "content_reports" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "content_type" text NOT NULL,
  "content_id" uuid NOT NULL,
  "reporter_id" uuid NOT NULL,
  "reason" text NOT NULL,
  "status" text NOT NULL DEFAULT 'pending',
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE INDEX "idx_content_reports_content" ON "content_reports" ("content_type", "content_id");
--> statement-breakpoint
CREATE INDEX "idx_content_reports_status" ON "content_reports" ("status");
--> statement-breakpoint
CREATE INDEX "idx_content_reports_reason" ON "content_reports" ("reason");
