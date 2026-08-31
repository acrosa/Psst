ALTER TABLE "users" ADD COLUMN "accepted_at" timestamp;--> statement-breakpoint
UPDATE "users" SET "accepted_at" = now() WHERE "accepted_at" IS NULL;
