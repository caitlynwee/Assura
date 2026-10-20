-- Plan Q&A chat history + "Recently deleted" bin.
-- Written to be idempotent: some databases (incl. the shared Supabase one) may
-- already have these tables from the earlier 0002_chat_history /
-- 0003_chat_trash migrations on the feature branch, which this replaces.
CREATE TABLE IF NOT EXISTS "chat_conversations" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"title" text NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	"deleted_at" text
);
--> statement-breakpoint
ALTER TABLE "chat_conversations" ADD COLUMN IF NOT EXISTS "deleted_at" text;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "chat_messages" (
	"id" text PRIMARY KEY NOT NULL,
	"conversation_id" text NOT NULL,
	"ordering" integer NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"citations" jsonb,
	"timestamp" text NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
	IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chat_conversations_user_id_users_id_fk') THEN
		ALTER TABLE "chat_conversations" ADD CONSTRAINT "chat_conversations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
	END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
	IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chat_messages_conversation_id_chat_conversations_id_fk') THEN
		ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_conversation_id_chat_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."chat_conversations"("id") ON DELETE cascade ON UPDATE no action;
	END IF;
END $$;
--> statement-breakpoint
-- Catch-up for databases that recorded the old branch migrations (dated
-- 1792600000000 / 1792610000000) BEFORE main's 0002/0003 (dated 1792598400001
-- / 1792598400002): Drizzle skips those as "older", so re-apply them here.
-- Each statement is a no-op where it has already run.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "profile" jsonb DEFAULT '{}'::jsonb NOT NULL;
--> statement-breakpoint
UPDATE "users"
SET "masked_inbox" = regexp_replace("masked_inbox", '@relay\.fineprint\.local$', '@relay.assura.local')
WHERE "masked_inbox" LIKE '%@relay.fineprint.local';
--> statement-breakpoint
UPDATE "users"
SET "email" = 'demo@assura.local'
WHERE "id" = 'user_demo'
  AND "email" = 'demo@fineprint.local';
