CREATE TABLE `clients` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`cui` varchar(20),
	`address` text,
	`city` varchar(100),
	`country` varchar(2) DEFAULT 'RO',
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
