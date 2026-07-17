CREATE TABLE `post_videos` (
	`id` text PRIMARY KEY NOT NULL,
	`post_id` text NOT NULL,
	`aspect` text NOT NULL,
	`media_id` text NOT NULL,
	`technique` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`media_id`) REFERENCES `media_library`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
ALTER TABLE `posts` ADD `video_status` text DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE `posts` ADD `video_technique` text;