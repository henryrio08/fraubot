CREATE TABLE `direct_messages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`sender_id` text NOT NULL,
	`recipient_id` text NOT NULL,
	`client_id` text NOT NULL,
	`text` text NOT NULL,
	`created_at` integer NOT NULL,
	`read_at` integer,
	FOREIGN KEY (`sender_id`) REFERENCES `class_profiles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`recipient_id`) REFERENCES `class_profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `direct_messages_sender_time` ON `direct_messages` (`sender_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `direct_messages_recipient_time` ON `direct_messages` (`recipient_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `direct_messages_pair` ON `direct_messages` (`sender_id`,`recipient_id`,`id`);--> statement-breakpoint
CREATE INDEX `direct_messages_time` ON `direct_messages` (`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `direct_messages_retry` ON `direct_messages` (`sender_id`,`recipient_id`,`client_id`);