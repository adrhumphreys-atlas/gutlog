CREATE TABLE `auth_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`token` text NOT NULL,
	`expires_at` text NOT NULL,
	`used_at` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `auth_tokens_token_unique` ON `auth_tokens` (`token`);--> statement-breakpoint
CREATE TABLE `correlations` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`trigger_type` text NOT NULL,
	`trigger_value` text NOT NULL,
	`symptom_type` text NOT NULL,
	`confidence` real NOT NULL,
	`relative_risk` real NOT NULL,
	`consistency_ratio` real NOT NULL,
	`occurrences` integer NOT NULL,
	`total_opportunities` integer NOT NULL,
	`window_hours` integer DEFAULT 6 NOT NULL,
	`created_at` text NOT NULL,
	`last_updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `entries` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`timestamp` text NOT NULL,
	`type` text NOT NULL,
	`notes` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`meal_type` text,
	`foods` text,
	`portion_size` text,
	`symptom_type` text,
	`severity` integer,
	`location` text,
	`duration` integer,
	`bristol_type` integer,
	`urgency` text,
	`blood` integer,
	`mucus` integer,
	`mood` integer,
	`stress_level` integer,
	`sleep_quality` integer,
	`anxiety_level` integer,
	`impact_severity` text,
	`affected_activities` text,
	`description` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `experiments` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`status` text DEFAULT 'active' NOT NULL,
	`eliminated_foods` text NOT NULL,
	`start_date` text NOT NULL,
	`end_date` text,
	`duration_days` integer NOT NULL,
	`baseline_symptom_rate` real,
	`current_symptom_rate` real,
	`result` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`settings` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);