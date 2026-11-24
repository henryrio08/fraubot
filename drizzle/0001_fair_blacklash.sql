CREATE TABLE `ai_usage` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`day` text NOT NULL,
	`kind` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `ai_usage_day_kind_user` ON `ai_usage` (`day`,`kind`,`user_id`);--> statement-breakpoint
CREATE TABLE `class_messages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`member_id` text NOT NULL,
	`client_id` text NOT NULL,
	`nickname` text NOT NULL,
	`text` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`member_id`) REFERENCES `class_profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `class_messages_time` ON `class_messages` (`created_at`);--> statement-breakpoint
CREATE INDEX `class_messages_sender_time` ON `class_messages` (`member_id`,`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `class_messages_retry` ON `class_messages` (`member_id`,`client_id`);--> statement-breakpoint
CREATE TABLE `class_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`nickname` text NOT NULL,
	`nickname_key` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `class_profiles_user_id_unique` ON `class_profiles` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `class_profiles_nickname_key_unique` ON `class_profiles` (`nickname_key`);