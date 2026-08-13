CREATE TABLE IF NOT EXISTS "ai_provider_configs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid,
	"provider_id" varchar(40) NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"base_url" varchar(500),
	"encrypted_api_key" text,
	"default_model_id" varchar(200),
	"capabilities" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ai_provider_configs" ADD CONSTRAINT "ai_provider_configs_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "ai_provider_configs_workspace_provider_idx" ON "ai_provider_configs" USING btree ("workspace_id","provider_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "ai_provider_configs_system_provider_idx" ON "ai_provider_configs" USING btree ("provider_id") WHERE "ai_provider_configs"."workspace_id" is null;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_provider_configs_workspace_idx" ON "ai_provider_configs" USING btree ("workspace_id");