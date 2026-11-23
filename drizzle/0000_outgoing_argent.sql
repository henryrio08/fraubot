CREATE TABLE `chat_members` (
	`id` text PRIMARY KEY NOT NULL,
	`room_id` text NOT NULL,
	`user_id` text NOT NULL,
	`nickname` text NOT NULL,
	`nickname_key` text NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	`joined_at` integer NOT NULL,
	FOREIGN KEY (`room_id`) REFERENCES `chat_rooms`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `chat_members_user` ON `chat_members` (`room_id`,`user_id`);--> statement-breakpoint
CREATE TABLE `chat_messages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`room_id` text NOT NULL,
	`member_id` text NOT NULL,
	`client_id` text NOT NULL,
	`nickname` text NOT NULL,
	`text` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`room_id`) REFERENCES `chat_rooms`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`member_id`) REFERENCES `chat_members`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `chat_messages_room` ON `chat_messages` (`room_id`,`id`);--> statement-breakpoint
CREATE INDEX `chat_messages_sender_time` ON `chat_messages` (`member_id`,`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `chat_messages_retry` ON `chat_messages` (`room_id`,`member_id`,`client_id`);--> statement-breakpoint
CREATE TABLE `chat_rooms` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `chat_rooms_code_unique` ON `chat_rooms` (`code`);--> statement-breakpoint
CREATE INDEX `chat_rooms_expiry` ON `chat_rooms` (`expires_at`);--> statement-breakpoint
CREATE INDEX `chat_rooms_creator` ON `chat_rooms` (`created_by`);