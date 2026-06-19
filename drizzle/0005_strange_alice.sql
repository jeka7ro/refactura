CREATE TABLE `modulePricing` (
	`id` int AUTO_INCREMENT NOT NULL,
	`moduleId` int NOT NULL,
	`currency` varchar(3) NOT NULL DEFAULT 'RON',
	`monthlyPrice` decimal(10,2) NOT NULL,
	`yearlyPrice` decimal(10,2),
	`trialDays` int DEFAULT 7,
	`isActive` int DEFAULT 1,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `modulePricing_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `modules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`slug` varchar(100) NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`icon` varchar(100),
	`color` varchar(50),
	`isCombo` int DEFAULT 0,
	`comboModules` text,
	`sortOrder` int DEFAULT 0,
	`isActive` int DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `modules_id` PRIMARY KEY(`id`),
	CONSTRAINT `modules_slug_unique` UNIQUE(`slug`)
);
