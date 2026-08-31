ALTER TABLE `users` ADD `accepted_at` integer;;
UPDATE `users` SET `accepted_at` = unixepoch() WHERE `accepted_at` IS NULL;
