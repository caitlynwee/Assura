CREATE TABLE IF NOT EXISTS "plan_brochures" (
	"id" text PRIMARY KEY NOT NULL,
	"filename" text NOT NULL,
	"content_type" text NOT NULL,
	"size" integer NOT NULL,
	"data" "bytea" NOT NULL,
	"uploaded_by" text NOT NULL,
	"uploaded_at" text NOT NULL
);
