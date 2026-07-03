CREATE TABLE `brand_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`site_url` text,
	`company_context` text,
	`brand_voice` text,
	`platforms` text,
	`posting_interval_days` integer DEFAULT 14 NOT NULL,
	`persona_policy` text DEFAULT 'brand-only' NOT NULL,
	`lora_id` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `media_library` (
	`id` text PRIMARY KEY NOT NULL,
	`url` text NOT NULL,
	`type` text NOT NULL,
	`tags` text,
	`description` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `posts` (
	`id` text PRIMARY KEY NOT NULL,
	`brand_id` text NOT NULL,
	`headline` text NOT NULL,
	`linkedin_text` text,
	`instagram_text` text,
	`facebook_text` text,
	`hashtags` text,
	`media_type` text,
	`media_id` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`scheduled_date` integer,
	`posted_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`brand_id`) REFERENCES `brand_profiles`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`media_id`) REFERENCES `media_library`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text
);
