CREATE TABLE "audit_entries" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"timestamp" text NOT NULL,
	"actor" text NOT NULL,
	"action" text NOT NULL,
	"detail" text NOT NULL,
	"prev_hash" text NOT NULL,
	"hash" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "insurers" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"agent_email" text NOT NULL,
	"logo" text NOT NULL,
	"persona" text NOT NULL,
	"website" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plans" (
	"id" text PRIMARY KEY NOT NULL,
	"insurer_id" text NOT NULL,
	"insurer_name" text NOT NULL,
	"plan_name" text NOT NULL,
	"category" text NOT NULL,
	"coverage_amount" integer NOT NULL,
	"premiums" jsonb NOT NULL,
	"premium_frequency" text NOT NULL,
	"coverage_terms" jsonb NOT NULL,
	"illnesses_covered" integer NOT NULL,
	"early_stage_conditions" boolean NOT NULL,
	"payout_type" text NOT NULL,
	"key_benefits" jsonb NOT NULL,
	"exclusions" jsonb NOT NULL,
	"source_url" text NOT NULL,
	"data_as_of" text NOT NULL,
	"updated_badge" boolean NOT NULL,
	"change_notes" jsonb NOT NULL,
	"version" integer NOT NULL,
	"scraped_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scraper_runs" (
	"run_id" text PRIMARY KEY NOT NULL,
	"trigger" text NOT NULL,
	"started_at" text NOT NULL,
	"finished_at" text NOT NULL,
	"sources_checked" integer NOT NULL,
	"sources_changed" integer NOT NULL,
	"errors" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sources" (
	"id" text PRIMARY KEY NOT NULL,
	"insurer_id" text NOT NULL,
	"label" text NOT NULL,
	"url" text NOT NULL,
	"type" text NOT NULL,
	"plan_ids" jsonb NOT NULL,
	"etag" text,
	"last_modified" text,
	"content_hash" text,
	"last_checked" text,
	"last_changed" text,
	"status" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "thread_messages" (
	"id" text PRIMARY KEY NOT NULL,
	"thread_id" text NOT NULL,
	"ordering" integer NOT NULL,
	"direction" text NOT NULL,
	"from" text NOT NULL,
	"to" text NOT NULL,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"timestamp" text NOT NULL,
	"ai_generated" boolean NOT NULL,
	"flagged" boolean NOT NULL,
	"flag_reason" text
);
--> statement-breakpoint
CREATE TABLE "threads" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"insurer_id" text NOT NULL,
	"insurer_name" text NOT NULL,
	"subject" text NOT NULL,
	"status" text NOT NULL,
	"extracted_quote" jsonb,
	"risk_flags" jsonb NOT NULL,
	"added_to_comparison" boolean NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"name" text NOT NULL,
	"tier" text NOT NULL,
	"masked_inbox" text NOT NULL,
	"onboarded" boolean NOT NULL,
	"share_age" boolean NOT NULL,
	"share_gender" boolean NOT NULL,
	"share_smoker_status" boolean NOT NULL,
	"share_coverage_needs" boolean NOT NULL,
	"share_budget_range" boolean NOT NULL,
	"share_occupation" boolean NOT NULL,
	"share_health_history" boolean NOT NULL,
	"share_income" boolean NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "plans" ADD CONSTRAINT "plans_insurer_id_insurers_id_fk" FOREIGN KEY ("insurer_id") REFERENCES "public"."insurers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sources" ADD CONSTRAINT "sources_insurer_id_insurers_id_fk" FOREIGN KEY ("insurer_id") REFERENCES "public"."insurers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "thread_messages" ADD CONSTRAINT "thread_messages_thread_id_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."threads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "threads" ADD CONSTRAINT "threads_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "threads" ADD CONSTRAINT "threads_insurer_id_insurers_id_fk" FOREIGN KEY ("insurer_id") REFERENCES "public"."insurers"("id") ON DELETE no action ON UPDATE no action;