CREATE TABLE `campaigns` (
	`id` text PRIMARY KEY NOT NULL,
	`version` integer DEFAULT 0 NOT NULL,
	`data` text NOT NULL,
	`updated_at` text NOT NULL
);
