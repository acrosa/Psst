ALTER TABLE `canvases` ADD `share_token` text;--> statement-breakpoint
CREATE UNIQUE INDEX `canvases_share_token_unique` ON `canvases` (`share_token`);