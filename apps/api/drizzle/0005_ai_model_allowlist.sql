CREATE TABLE IF NOT EXISTS "ai_model_allowlist" (
	"provider_id" varchar(40) NOT NULL,
	"model_id" varchar(200) NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_model_allowlist_pk" PRIMARY KEY("provider_id", "model_id")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_model_allowlist_provider_idx" ON "ai_model_allowlist" USING btree ("provider_id");
