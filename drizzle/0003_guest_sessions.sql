CREATE TABLE `guest_sessions` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`network_key` text NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `guest_sessions_user_id_unique` ON `guest_sessions` (`user_id`);--> statement-breakpoint
CREATE INDEX `guest_sessions_network_time` ON `guest_sessions` (`network_key`,`created_at`);--> statement-breakpoint
CREATE INDEX `guest_sessions_expiry` ON `guest_sessions` (`expires_at`);