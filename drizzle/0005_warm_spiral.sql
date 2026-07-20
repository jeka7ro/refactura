CREATE TABLE `costCenterRules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`costCenterId` int NOT NULL,
	`conditionType` varchar(50) NOT NULL,
	`conditionValue` varchar(255) NOT NULL,
	`isActive` int DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `costCenterRules_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `invoiceArchive` ADD `costCenterId` int;