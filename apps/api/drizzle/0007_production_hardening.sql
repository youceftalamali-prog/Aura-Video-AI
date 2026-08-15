CREATE UNIQUE INDEX IF NOT EXISTS "subscriptions_one_active_workspace_idx"
ON "subscriptions" USING btree ("workspace_id")
WHERE "status" IN ('active', 'created', 'approved', 'pending', 'past_due');
--> statement-breakpoint
