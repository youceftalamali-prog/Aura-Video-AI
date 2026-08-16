CREATE TABLE IF NOT EXISTS "agent_conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"title" varchar(200) DEFAULT 'New conversation' NOT NULL,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"selected_product_id" uuid,
	"selected_template_id" uuid,
	"active_video_job_id" uuid,
	"language" varchar(20),
	"pending_confirmation" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "agent_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"role" varchar(20) NOT NULL,
	"content" text,
	"tool_name" varchar(120),
	"tool_args" jsonb,
	"tool_result" jsonb,
	"model_info" jsonb,
	"step" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "agent_conversations" ADD CONSTRAINT "agent_conversations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "agent_conversations" ADD CONSTRAINT "agent_conversations_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "agent_conversations" ADD CONSTRAINT "agent_conversations_selected_product_id_products_id_fk" FOREIGN KEY ("selected_product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "agent_conversations" ADD CONSTRAINT "agent_conversations_selected_template_id_templates_id_fk" FOREIGN KEY ("selected_template_id") REFERENCES "public"."templates"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "agent_conversations" ADD CONSTRAINT "agent_conversations_active_video_job_id_video_generation_jobs_id_fk" FOREIGN KEY ("active_video_job_id") REFERENCES "public"."video_generation_jobs"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "agent_messages" ADD CONSTRAINT "agent_messages_conversation_id_agent_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."agent_conversations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agent_conversations_user_id_idx" ON "agent_conversations" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agent_conversations_workspace_id_idx" ON "agent_conversations" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agent_messages_conversation_idx" ON "agent_messages" USING btree ("conversation_id","created_at");