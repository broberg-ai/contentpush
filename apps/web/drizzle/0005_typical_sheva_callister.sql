CREATE TABLE `activities` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`type` text NOT NULL,
	`period_start` integer NOT NULL,
	`period_end` integer NOT NULL,
	`brand_ids` text,
	`channels` text,
	`cadence_per_brand` integer DEFAULT 1 NOT NULL,
	`tone_instruks` text,
	`generate_policy` text DEFAULT 'auto' NOT NULL,
	`created_at` integer NOT NULL
);
