ALTER TABLE "projects"
  ADD COLUMN IF NOT EXISTS "video_asset_id" uuid;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "projects"
    ADD CONSTRAINT "projects_video_asset_id_assets_id_fk"
    FOREIGN KEY ("video_asset_id") REFERENCES "public"."assets"("id")
    ON DELETE SET NULL ON UPDATE NO ACTION;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "projects_video_asset_id_idx"
  ON "projects" USING btree ("video_asset_id");
--> statement-breakpoint
WITH latest_completed AS (
  SELECT DISTINCT ON ("project_id")
    "project_id",
    "asset_id"
  FROM "video_generation_jobs"
  WHERE "status" = 'completed' AND "asset_id" IS NOT NULL
  ORDER BY "project_id", "completed_at" DESC NULLS LAST, "updated_at" DESC
)
UPDATE "projects" AS p
SET "video_asset_id" = latest_completed."asset_id",
    "video_url" = NULL,
    "updated_at" = now()
FROM latest_completed
WHERE p."id" = latest_completed."project_id"
  AND p."video_asset_id" IS NULL;
--> statement-breakpoint
UPDATE "projects"
SET "video_url" = NULL
WHERE "video_url" IS NOT NULL;
