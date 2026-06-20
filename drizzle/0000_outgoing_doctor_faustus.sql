CREATE TABLE `accounts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`email` varchar(320) NOT NULL,
	`passwordHash` varchar(255) NOT NULL,
	`tenantId` int,
	`role` enum('superadmin','admin','user') NOT NULL DEFAULT 'user',
	`isActive` int DEFAULT 1,
	`lastLoginAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `accounts_id` PRIMARY KEY(`id`),
	CONSTRAINT `accounts_email_unique` UNIQUE(`email`)
);
--> statement-breakpoint
CREATE TABLE `clients` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`cui` varchar(20),
	`regCom` varchar(50),
	`tva` int DEFAULT 0,
	`address` text,
	`city` varchar(100),
	`country` varchar(100) DEFAULT 'RO',
	`email` varchar(320),
	`phone` varchar(20),
	`currency` varchar(3) DEFAULT 'RON',
	`totalInvoiced` decimal(12,2) DEFAULT '0.00',
	`invoiceCount` int DEFAULT 0,
	`reInvoiceCount` int DEFAULT 0,
	`isActive` int DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `clients_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
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
CREATE TABLE `invoiceArchive` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`fileKey` varchar(512),
	`fileUrl` varchar(512),
	`fileName` varchar(255),
	`fileType` enum('pdf','xml','efactura','other') DEFAULT 'pdf',
	`fileSize` int,
	`invoiceNumber` varchar(100),
	`supplierName` varchar(255),
	`supplierCUI` varchar(20),
	`issueDate` varchar(20),
	`dueDate` varchar(20),
	`total` decimal(12,2),
	`totalVAT` decimal(12,2),
	`currency` varchar(3) DEFAULT 'RON',
	`source` enum('smartbill','oblio','fgo','spv_anaf','efactura','pdf_manual','xml_manual','other') DEFAULT 'pdf_manual',
	`status` enum('pending','processed','refactured','archived') DEFAULT 'pending',
	`reInvoiceId` int,
	`notes` text,
	`tags` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `invoiceArchive_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `invoiceArchiveLines` (
	`id` int AUTO_INCREMENT NOT NULL,
	`invoiceArchiveId` int NOT NULL,
	`description` varchar(512) NOT NULL,
	`quantity` decimal(12,2) NOT NULL,
	`unitPrice` decimal(12,2) NOT NULL,
	`unit` varchar(50) NOT NULL DEFAULT 'buc',
	`vatRate` decimal(5,2),
	`total` decimal(12,2),
	`currency` varchar(3) DEFAULT 'RON',
	CONSTRAINT `invoiceArchiveLines_id` PRIMARY KEY(`id`)
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
CREATE TABLE `reInvoiceLines` (
	`id` int AUTO_INCREMENT NOT NULL,
	`reInvoiceId` int NOT NULL,
	`description` varchar(500) NOT NULL,
	`quantity` decimal(10,2) NOT NULL,
	`originalUnitPrice` decimal(12,2),
	`unitPrice` decimal(12,2) NOT NULL,
	`unit` varchar(20) DEFAULT 'buc',
	`vatRate` decimal(5,2) DEFAULT '21.00',
	`markupPercent` decimal(7,2),
	`total` decimal(12,2) NOT NULL,
	`lineOrder` int DEFAULT 0,
	CONSTRAINT `reInvoiceLines_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `reInvoices` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`number` varchar(100) NOT NULL,
	`sourceInvoiceId` varchar(100),
	`sourceInvoiceNumber` varchar(100),
	`sourceSupplierName` varchar(255),
	`clientId` int,
	`clientName` varchar(255) NOT NULL,
	`clientCUI` varchar(20),
	`clientAddress` text,
	`clientCity` varchar(100),
	`clientEmail` varchar(320),
	`clientPhone` varchar(20),
	`issueDate` varchar(20) NOT NULL,
	`dueDate` varchar(20),
	`subtotal` decimal(12,2) NOT NULL,
	`totalVAT` decimal(12,2) NOT NULL,
	`total` decimal(12,2) NOT NULL,
	`currency` varchar(3) DEFAULT 'RON',
	`status` enum('draft','sent','paid','overdue','cancelled') DEFAULT 'draft',
	`notes` text,
	`pdfUrl` varchar(512),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `reInvoices_id` PRIMARY KEY(`id`)
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
CREATE TABLE `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`openId` varchar(64) NOT NULL,
	`name` text,
	`email` varchar(320),
	`loginMethod` varchar(64),
	`role` enum('user','admin','superadmin') NOT NULL DEFAULT 'user',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`lastSignedIn` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_openId_unique` UNIQUE(`openId`)
);
