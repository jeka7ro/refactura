CREATE TABLE `costCenters` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`address` text,
	`cui` varchar(20),
	`email` varchar(320),
	`phone` varchar(20),
	`city` varchar(100),
	`country` varchar(2) DEFAULT 'RO',
	`isActive` int DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `costCenters_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `inventoryItems` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`costCenterId` int,
	`serialNumber` varchar(255) NOT NULL,
	`description` varchar(500) NOT NULL,
	`quantity` int NOT NULL DEFAULT 1,
	`unitPrice` decimal(12,2) NOT NULL,
	`totalPrice` decimal(12,2) NOT NULL,
	`currency` varchar(3) DEFAULT 'RON',
	`category` varchar(100),
	`status` enum('active','inactive','damaged','lost') DEFAULT 'active',
	`importedInvoiceId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `inventoryItems_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `quotationLines` (
	`id` int AUTO_INCREMENT NOT NULL,
	`quotationId` int NOT NULL,
	`description` varchar(500) NOT NULL,
	`quantity` decimal(10,2) NOT NULL,
	`unitPrice` decimal(12,2) NOT NULL,
	`total` decimal(12,2) NOT NULL,
	`lineOrder` int NOT NULL,
	CONSTRAINT `quotationLines_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `quotations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`costCenterId` int,
	`quotationNumber` varchar(100) NOT NULL,
	`clientName` varchar(255) NOT NULL,
	`clientEmail` varchar(320),
	`quotationDate` timestamp DEFAULT (now()),
	`validUntil` timestamp,
	`subtotal` decimal(12,2) NOT NULL,
	`vat` decimal(12,2) NOT NULL,
	`total` decimal(12,2) NOT NULL,
	`currency` varchar(3) DEFAULT 'RON',
	`status` enum('draft','sent','accepted','rejected','expired') DEFAULT 'draft',
	`pdfUrl` varchar(512),
	`notes` text,
	`sentAt` timestamp,
	`acceptedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `quotations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `subscriptionPlans` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`description` text,
	`monthlyPrice` int NOT NULL,
	`maxCostCenters` int NOT NULL DEFAULT 1,
	`maxUsers` int NOT NULL DEFAULT 1,
	`features` text,
	`isActive` int DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `subscriptionPlans_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `tenants` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`email` varchar(320) NOT NULL,
	`phone` varchar(20),
	`address` text,
	`cui` varchar(20),
	`subscriptionPlanId` int,
	`subscriptionStatus` enum('active','inactive','cancelled','expired') DEFAULT 'active',
	`subscriptionStartDate` timestamp,
	`subscriptionEndDate` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `tenants_id` PRIMARY KEY(`id`),
	CONSTRAINT `tenants_cui_unique` UNIQUE(`cui`)
);
--> statement-breakpoint
CREATE TABLE `userTenants` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`tenantId` int NOT NULL,
	`role` enum('superadmin','admin','user','viewer') NOT NULL DEFAULT 'user',
	`isActive` int DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `userTenants_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('user','admin','superadmin') NOT NULL DEFAULT 'user';