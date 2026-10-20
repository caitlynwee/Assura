UPDATE "insurers" SET "country" = 'Singapore' WHERE "country" = 'SG';--> statement-breakpoint
UPDATE "plans" SET "country" = 'Singapore' WHERE "country" = 'SG';--> statement-breakpoint
UPDATE "sources" SET "country" = 'Singapore' WHERE "country" = 'SG';--> statement-breakpoint
ALTER TABLE "insurers" ALTER COLUMN "country" SET DEFAULT 'Singapore';--> statement-breakpoint
ALTER TABLE "plans" ALTER COLUMN "country" SET DEFAULT 'Singapore';--> statement-breakpoint
ALTER TABLE "sources" ALTER COLUMN "country" SET DEFAULT 'Singapore';
