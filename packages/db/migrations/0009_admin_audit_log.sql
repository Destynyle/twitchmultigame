-- Add 'quarantined' to user_role enum
ALTER TYPE "user_role" ADD VALUE 'quarantined';
--> statement-breakpoint

-- Admin audit log — platform-wide, immutable, insert-only
CREATE TABLE "admin_audit_log" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "actor_id" uuid NOT NULL,
  "action" text NOT NULL,
  "target_type" text,
  "target_id" text,
  "metadata" jsonb DEFAULT '{}',
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE INDEX "idx_audit_actor_id" ON "admin_audit_log" ("actor_id");
--> statement-breakpoint
CREATE INDEX "idx_audit_action" ON "admin_audit_log" ("action");
--> statement-breakpoint
CREATE INDEX "idx_audit_target_id" ON "admin_audit_log" ("target_id");
--> statement-breakpoint
CREATE INDEX "idx_audit_created_at" ON "admin_audit_log" ("created_at" DESC);
--> statement-breakpoint

-- Immutability enforced at DB level: block UPDATE and DELETE
ALTER TABLE "admin_audit_log" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "audit_log_no_update" ON "admin_audit_log"
  AS RESTRICTIVE FOR UPDATE TO public USING (false);
--> statement-breakpoint
CREATE POLICY "audit_log_no_delete" ON "admin_audit_log"
  AS RESTRICTIVE FOR DELETE TO public USING (false);
--> statement-breakpoint
CREATE POLICY "audit_log_insert" ON "admin_audit_log"
  AS PERMISSIVE FOR INSERT TO public WITH CHECK (true);
--> statement-breakpoint
CREATE POLICY "audit_log_select" ON "admin_audit_log"
  AS PERMISSIVE FOR SELECT TO public USING (true);
