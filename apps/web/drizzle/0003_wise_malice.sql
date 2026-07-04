ALTER TABLE `brand_profiles` ADD `status` text DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE `brand_profiles` ADD `source_brand_id` text;--> statement-breakpoint
ALTER TABLE `brand_profiles` ADD `autodoc_slug` text;--> statement-breakpoint
ALTER TABLE `brand_profiles` ADD `brand_signals` text;--> statement-breakpoint
ALTER TABLE `brand_profiles` ADD `analyzed_at` integer;