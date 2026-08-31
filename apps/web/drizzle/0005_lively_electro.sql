ALTER TABLE "canvases" ADD COLUMN "share_token" text;--> statement-breakpoint
ALTER TABLE "canvases" ADD CONSTRAINT "canvases_share_token_unique" UNIQUE("share_token");