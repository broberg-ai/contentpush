CREATE TABLE `music_tracks` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`mood` text,
	`url` text NOT NULL,
	`duration_sec` integer,
	`credit` text,
	`created_at` integer NOT NULL
);
