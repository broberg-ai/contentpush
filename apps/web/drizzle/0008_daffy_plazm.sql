CREATE TABLE `video_scenes` (
	`id` text PRIMARY KEY NOT NULL,
	`script_id` text NOT NULL,
	`scene_order` integer NOT NULL,
	`role` text NOT NULL,
	`visual_type` text DEFAULT 'ai-broll' NOT NULL,
	`visual_prompt` text,
	`flow_ref` text,
	`media_id` text,
	`voiceover_da` text,
	`voiceover_en` text,
	`on_screen_text` text,
	`transition` text DEFAULT 'cut' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`script_id`) REFERENCES `video_scripts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`media_id`) REFERENCES `media_library`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `video_scripts` (
	`id` text PRIMARY KEY NOT NULL,
	`brand_id` text NOT NULL,
	`title` text NOT NULL,
	`aspect` text DEFAULT '16:9' NOT NULL,
	`languages` text,
	`target_duration_sec` integer DEFAULT 60 NOT NULL,
	`music_enabled` integer DEFAULT false NOT NULL,
	`music_track_id` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`brand_id`) REFERENCES `brand_profiles`(`id`) ON UPDATE no action ON DELETE no action
);
