ALTER TABLE "batches" ALTER COLUMN "is_free" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "batches" ALTER COLUMN "is_free" SET DATA TYPE integer USING "is_free"::integer;--> statement-breakpoint
ALTER TABLE "batches" ALTER COLUMN "is_free" SET DEFAULT 1;--> statement-breakpoint
ALTER TABLE "batches" ALTER COLUMN "published" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "batches" ALTER COLUMN "published" SET DATA TYPE integer USING "published"::integer;--> statement-breakpoint
ALTER TABLE "batches" ALTER COLUMN "published" SET DEFAULT 1;--> statement-breakpoint
ALTER TABLE "classes" ALTER COLUMN "published" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "classes" ALTER COLUMN "published" SET DATA TYPE integer USING "published"::integer;--> statement-breakpoint
ALTER TABLE "classes" ALTER COLUMN "published" SET DEFAULT 0;--> statement-breakpoint
ALTER TABLE "reel_progress" ALTER COLUMN "completed" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "reel_progress" ALTER COLUMN "completed" SET DATA TYPE integer USING "completed"::integer;--> statement-breakpoint
ALTER TABLE "reel_progress" ALTER COLUMN "completed" SET DEFAULT 0;--> statement-breakpoint
ALTER TABLE "reel_series" ALTER COLUMN "published" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "reel_series" ALTER COLUMN "published" SET DATA TYPE integer USING "published"::integer;--> statement-breakpoint
ALTER TABLE "reel_series" ALTER COLUMN "published" SET DEFAULT 0;--> statement-breakpoint
ALTER TABLE "reels" ALTER COLUMN "published" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "reels" ALTER COLUMN "published" SET DATA TYPE integer USING "published"::integer;--> statement-breakpoint
ALTER TABLE "reels" ALTER COLUMN "published" SET DEFAULT 0;--> statement-breakpoint
ALTER TABLE "subjects" ALTER COLUMN "active" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "subjects" ALTER COLUMN "active" SET DATA TYPE integer USING "active"::integer;--> statement-breakpoint
ALTER TABLE "subjects" ALTER COLUMN "active" SET DEFAULT 1;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "active" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "active" SET DATA TYPE integer USING "active"::integer;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "active" SET DEFAULT 1;