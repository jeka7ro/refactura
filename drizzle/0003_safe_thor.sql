CREATE TABLE `bonuri_consum` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`devizId` int,
	`number` varchar(50) NOT NULL,
	`date` timestamp NOT NULL,
	`gestiune` varchar(255),
	`status` enum('draft','final') DEFAULT 'draft',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `bonuri_consum_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `bonuri_consum_lines` (
	`id` int AUTO_INCREMENT NOT NULL,
	`bonId` int NOT NULL,
	`materialCode` varchar(100),
	`description` text NOT NULL,
	`quantity` decimal(12,2) NOT NULL,
	`unitPrice` decimal(12,2) NOT NULL,
	`total` decimal(12,2) NOT NULL,
	`lineOrder` int DEFAULT 0,
	CONSTRAINT `bonuri_consum_lines_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `devize` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`invoiceId` int,
	`number` varchar(50) NOT NULL,
	`date` timestamp NOT NULL,
	`totalMaterials` decimal(12,2) DEFAULT '0',
	`totalLabor` decimal(12,2) DEFAULT '0',
	`total` decimal(12,2) DEFAULT '0',
	`status` enum('draft','final') DEFAULT 'draft',
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `devize_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `devizeLines` (
	`id` int AUTO_INCREMENT NOT NULL,
	`devizId` int NOT NULL,
	`type` enum('MATERIAL','MANOPERA','UTILAJ','NORMA') NOT NULL,
	`code` varchar(100),
	`description` text NOT NULL,
	`quantity` decimal(12,2) NOT NULL,
	`unitPrice` decimal(12,2) NOT NULL,
	`total` decimal(12,2) NOT NULL,
	`lineOrder` int DEFAULT 0,
	CONSTRAINT `devizeLines_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `emittedInvoiceLines` ADD `devizCode` varchar(100);--> statement-breakpoint
ALTER TABLE `emittedInvoiceLines` ADD `devizType` varchar(50);--> statement-breakpoint
ALTER TABLE `nir` ADD `avizNumber` varchar(100);--> statement-breakpoint
ALTER TABLE `nir` ADD `supplierAddress` text;--> statement-breakpoint
ALTER TABLE `nir` ADD `gestiune` varchar(255);--> statement-breakpoint
ALTER TABLE `nir` ADD `member1Name` varchar(150);--> statement-breakpoint
ALTER TABLE `nir` ADD `member1Function` varchar(100);--> statement-breakpoint
ALTER TABLE `nir` ADD `member2Name` varchar(150);--> statement-breakpoint
ALTER TABLE `nir` ADD `member2Function` varchar(100);--> statement-breakpoint
ALTER TABLE `nir` ADD `member3Name` varchar(150);--> statement-breakpoint
ALTER TABLE `nir` ADD `member3Function` varchar(100);--> statement-breakpoint
ALTER TABLE `nir` ADD `hasDifferences` int DEFAULT 0;--> statement-breakpoint
ALTER TABLE `nir` ADD `differenceNotes` text;--> statement-breakpoint
ALTER TABLE `nirLines` ADD `consumedQty` decimal(12,2) DEFAULT '0';