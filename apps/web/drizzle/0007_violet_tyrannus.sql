CREATE TABLE `marker_days` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`kind` text NOT NULL,
	`month` integer NOT NULL,
	`day` integer NOT NULL,
	`brand_id` text,
	`note` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `posting_windows` (
	`id` text PRIMARY KEY NOT NULL,
	`brand_id` text,
	`platform` text NOT NULL,
	`weekdays` text NOT NULL,
	`best_weekday` integer,
	`start_min` integer NOT NULL,
	`end_min` integer NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE `posts` ADD `moved_from` integer;--> statement-breakpoint
ALTER TABLE `posts` ADD `moved_reason` text;