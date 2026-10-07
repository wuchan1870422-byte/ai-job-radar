CREATE TABLE `jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`source` text NOT NULL,
	`company` text NOT NULL,
	`title` text NOT NULL,
	`location` text NOT NULL,
	`team` text NOT NULL,
	`apply_url` text NOT NULL,
	`description` text NOT NULL,
	`posted_at` integer,
	`first_seen` integer NOT NULL,
	`last_seen` integer NOT NULL,
	`salary` text NOT NULL,
	`skills` text NOT NULL,
	`score` integer NOT NULL,
	`fit` text NOT NULL,
	`reasons` text NOT NULL,
	`active` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_jobs_active_score` ON `jobs` (`active`,`score`);--> statement-breakpoint
CREATE INDEX `idx_jobs_source_last` ON `jobs` (`source`,`last_seen`);--> statement-breakpoint
CREATE TABLE `runs` (
	`id` text PRIMARY KEY NOT NULL,
	`at` integer NOT NULL,
	`found` integer NOT NULL,
	`sources` text NOT NULL,
	`report` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_runs_at` ON `runs` (`at`);