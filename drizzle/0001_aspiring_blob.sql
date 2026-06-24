CREATE TABLE `integrations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`provider` enum('smartbill','spv','oblio') NOT NULL,
	`apiKey` text,
	`apiSecret` text,
	`tokenExpiresAt` timestamp,
	`config` text,
	`status` enum('active','inactive','error') DEFAULT 'inactive',
	`lastSyncAt` timestamp,
	`syncCount` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `integrations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `clients` ADD `isSupplier` int DEFAULT 0;--> statement-breakpoint
ALTER TABLE `invoiceArchive` ADD `direction` enum('in','out') DEFAULT 'in';--> statement-breakpoint
ALTER TABLE `invoiceArchive` ADD `rawXml` text;--> statement-breakpoint
ALTER TABLE `reInvoices` ADD `spvIndex` varchar(100);--> statement-breakpoint
ALTER TABLE `reInvoices` ADD `spvStatus` enum('nesincronizat','in_procesare','validat','eroare') DEFAULT 'nesincronizat';--> statement-breakpoint
ALTER TABLE `reInvoices` ADD `spvError` text;--> statement-breakpoint
ALTER TABLE `reInvoices` ADD `rawXml` text;--> statement-breakpoint
ALTER TABLE `tenants` ADD `settings` text;