ALTER TABLE "video_generation_jobs"
  ADD COLUMN IF NOT EXISTS "lease_owner" varchar(128),
  ADD COLUMN IF NOT EXISTS "lease_expires_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "attempt_count" integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "last_heartbeat_at" timestamp with time zone;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "video_jobs_lease_idx"
  ON "video_generation_jobs" USING btree ("status", "lease_expires_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "video_jobs_lease_owner_idx"
  ON "video_generation_jobs" USING btree ("lease_owner");
