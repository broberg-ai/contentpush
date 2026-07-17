ALTER TABLE `video_scripts` ADD `render_status` text DEFAULT 'idle' NOT NULL;--> statement-breakpoint
ALTER TABLE `video_scripts` ADD `render_media_id` text REFERENCES media_library(id);--> statement-breakpoint
ALTER TABLE `video_scripts` ADD `render_lang` text;