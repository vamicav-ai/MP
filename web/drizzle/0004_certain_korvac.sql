DROP TABLE "password_reset_tokens" CASCADE;--> statement-breakpoint
DROP TABLE "verification_tokens" CASCADE;--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "email_verified";