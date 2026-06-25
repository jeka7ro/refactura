CREATE TABLE `emittedInvoiceLines` (
	`id` int AUTO_INCREMENT NOT NULL,
	`emittedInvoiceId` int NOT NULL,
	`description` varchar(500) NOT NULL,
	`quantity` decimal(10,2) NOT NULL,
	`unitPrice` decimal(12,2) NOT NULL,
	`unit` varchar(20) DEFAULT 'buc',
	`vatRate` decimal(5,2) DEFAULT '19.00',
	`total` decimal(12,2) NOT NULL,
	`lineOrder` int DEFAULT 0,
	CONSTRAINT `emittedInvoiceLines_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `emittedInvoices` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`number` varchar(100) NOT NULL,
	`series` varchar(20) DEFAULT 'FACT',
	`clientId` int,
	`clientName` varchar(255) NOT NULL,
	`clientCUI` varchar(20),
	`clientRegCom` varchar(50),
	`clientAddress` text,
	`clientCity` varchar(100),
	`clientCountry` varchar(2) DEFAULT 'RO',
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
	`spvIndex` varchar(100),
	`spvStatus` enum('nesincronizat','in_procesare','validat','eroare') DEFAULT 'nesincronizat',
	`spvError` text,
	`rawXml` text,
	`pdfUrl` varchar(512),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `emittedInvoices_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `nir` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`nirNumber` varchar(50) NOT NULL,
	`invoiceArchiveId` int,
	`invoiceNumber` varchar(100),
	`supplierName` varchar(255),
	`supplierCUI` varchar(20),
	`receiptDate` varchar(20) NOT NULL,
	`status` enum('draft','finalizat') DEFAULT 'draft',
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `nir_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `nirLines` (
	`id` int AUTO_INCREMENT NOT NULL,
	`nirId` int NOT NULL,
	`description` varchar(512) NOT NULL,
	`unit` varchar(50) DEFAULT 'buc',
	`cantitateComanda` decimal(12,2) NOT NULL,
	`cantitateReceptionata` decimal(12,2) NOT NULL,
	`unitPrice` decimal(12,2),
	`vatRate` decimal(5,2),
	`total` decimal(12,2),
	`observations` text,
	`lineOrder` int DEFAULT 0,
	CONSTRAINT `nirLines_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `products` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`unit` varchar(20) DEFAULT 'buc',
	`defaultPrice` decimal(12,2) DEFAULT '0.00',
	`defaultVatRate` int DEFAULT 21,
	`currency` varchar(3) DEFAULT 'RON',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `products_id` PRIMARY KEY(`id`)
);
