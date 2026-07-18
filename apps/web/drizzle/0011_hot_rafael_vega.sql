CREATE TABLE `video_script_renders` (
	`id` text PRIMARY KEY NOT NULL,
	`script_id` text NOT NULL,
	`language` text NOT NULL,
	`media_id` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`script_id`) REFERENCES `video_scripts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`media_id`) REFERENCES `media_library`(`id`) ON UPDATE no action ON DELETE no action
);
