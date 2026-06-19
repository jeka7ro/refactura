CREATE TABLE `cmsSettings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`key` varchar(100) NOT NULL,
	`value` text,
	`label` varchar(255),
	`group` varchar(100) DEFAULT 'general',
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `cmsSettings_id` PRIMARY KEY(`id`),
	CONSTRAINT `cmsSettings_key_unique` UNIQUE(`key`)
);
--> statement-breakpoint
CREATE TABLE `leads` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255),
	`email` varchar(320) NOT NULL,
	`phone` varchar(20),
	`company` varchar(255),
	`message` text,
	`planId` int,
	`source` varchar(100) DEFAULT 'landing',
	`status` enum('new','contacted','converted','lost') DEFAULT 'new',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `leads_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `pageVisits` (
	`id` int AUTO_INCREMENT NOT NULL,
	`path` varchar(500) NOT NULL,
	`referrer` varchar(500),
	`userAgent` text,
	`ip` varchar(45),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `pageVisits_id` PRIMARY KEY(`id`)
);
