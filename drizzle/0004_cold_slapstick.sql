CREATE TABLE `passwordResets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`email` varchar(320) NOT NULL,
	`token` varchar(255) NOT NULL,
	`expiresAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `passwordResets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `integrations` ADD `lastCronImported` int DEFAULT 0;--> statement-breakpoint
ALTER TABLE `integrations` ADD `lastCronAt` timestamp;