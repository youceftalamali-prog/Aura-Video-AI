CREATE TABLE IF NOT EXISTS "product_intelligence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"status" varchar(20) DEFAULT 'ready' NOT NULL,
	"intelligence" jsonb,
	"extracted" jsonb,
	"error_code" varchar(80),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "product_intelligence_product_fk" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "product_intelligence_product_idx" ON "product_intelligence" USING btree ("product_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "product_intelligence_status_idx" ON "product_intelligence" USING btree ("status");
