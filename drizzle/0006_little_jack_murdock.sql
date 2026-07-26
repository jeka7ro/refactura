CREATE TABLE `apiKeys` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`name` varchar(100) NOT NULL,
	`keyHash` varchar(255) NOT NULL,
	`keyPrefix` varchar(12) NOT NULL,
	`isActive` int NOT NULL DEFAULT 1,
	`lastUsedAt` timestamp,
	`expiresAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `apiKeys_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `costCenterCategories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`name` varchar(100) NOT NULL,
	`color` varchar(7) DEFAULT '#6366f1',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `costCenterCategories_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `costCenterRules` MODIFY COLUMN `conditionType` varchar(50) NOT NULL DEFAULT 'MULTI';--> statement-breakpoint
ALTER TABLE `costCenterRules` MODIFY COLUMN `conditionValue` varchar(255) NOT NULL DEFAULT '';--> statement-breakpoint
ALTER TABLE `accounts` ADD `phone` varchar(30);--> statement-breakpoint
ALTER TABLE `costCenterRules` ADD `matchName` varchar(255);--> statement-breakpoint
ALTER TABLE `costCenterRules` ADD `addressKeyword` varchar(255);--> statement-breakpoint
ALTER TABLE `costCenterRules` ADD `lineKeyword` varchar(255);--> statement-breakpoint
ALTER TABLE `costCenters` ADD `categoryId` int;--> statement-breakpoint
ALTER TABLE `nirLines` ADD `accountingType` varchar(50) DEFAULT 'Marfa';--> statement-breakpoint
ALTER TABLE `nirLines` ADD `accountingAccount` varchar(20) DEFAULT '371';--> statement-breakpoint
ALTER TABLE `users` ADD `phone` varchar(30);