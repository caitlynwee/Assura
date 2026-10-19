ALTER TABLE "insurers" ADD COLUMN "country" text NOT NULL DEFAULT 'SG';--> statement-breakpoint
ALTER TABLE "plans" ADD COLUMN "country" text NOT NULL DEFAULT 'SG';--> statement-breakpoint
ALTER TABLE "sources" ADD COLUMN "country" text NOT NULL DEFAULT 'SG';
