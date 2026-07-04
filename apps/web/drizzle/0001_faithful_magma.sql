CREATE TABLE `ideas` (
	`id` text PRIMARY KEY NOT NULL,
	`brand_id` text,
	`raw_text` text NOT NULL,
	`status` text DEFAULT 'captured' NOT NULL,
	`suggested_date` integer,
	`used_by_post_id` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`brand_id`) REFERENCES `brand_profiles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
ALTER TABLE `posts` ADD `idea_id` text;