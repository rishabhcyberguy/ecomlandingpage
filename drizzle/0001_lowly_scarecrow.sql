CREATE TABLE IF NOT EXISTS `polina_admin_accounts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`email` varchar(320) NOT NULL,
	`name` varchar(160),
	`passwordHash` varchar(255) NOT NULL,
	`active` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`lastSignedIn` timestamp,
	CONSTRAINT `polina_admin_accounts_id` PRIMARY KEY(`id`),
	CONSTRAINT `polina_admin_accounts_email_unique` UNIQUE(`email`)
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS `polina_admin_sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`adminId` int NOT NULL,
	`tokenHash` varchar(64) NOT NULL,
	`csrfHash` varchar(64) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`expiresAt` timestamp NOT NULL,
	`revokedAt` timestamp,
	CONSTRAINT `polina_admin_sessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `polina_admin_sessions_token_uq` UNIQUE(`tokenHash`)
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS `polina_auth_rate_limits` (
	`bucketKey` varchar(128) NOT NULL,
	`attempts` int NOT NULL DEFAULT 0,
	`windowStartedAt` timestamp NOT NULL,
	`blockedUntil` timestamp,
	CONSTRAINT `polina_auth_rate_limits_bucketKey` PRIMARY KEY(`bucketKey`)
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS `polina_categories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(120) NOT NULL,
	`slug` varchar(160) NOT NULL,
	`sortOrder` int NOT NULL DEFAULT 0,
	`active` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `polina_categories_id` PRIMARY KEY(`id`),
	CONSTRAINT `polina_categories_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS `polina_content_edits` (
	`id` int AUTO_INCREMENT NOT NULL,
	`entityType` varchar(40) NOT NULL,
	`entityId` varchar(80) NOT NULL,
	`entityLabel` varchar(200) NOT NULL,
	`action` varchar(40) NOT NULL,
	`editorEmail` varchar(320) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `polina_content_edits_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS `polina_password_reset_tokens` (
	`id` int AUTO_INCREMENT NOT NULL,
	`adminId` int NOT NULL,
	`tokenHash` varchar(64) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`expiresAt` timestamp NOT NULL,
	`usedAt` timestamp,
	CONSTRAINT `polina_password_reset_tokens_id` PRIMARY KEY(`id`),
	CONSTRAINT `polina_reset_tokens_token_uq` UNIQUE(`tokenHash`)
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS `polina_product_images` (
	`id` int AUTO_INCREMENT NOT NULL,
	`productId` int NOT NULL,
	`storageKey` varchar(512) NOT NULL,
	`url` varchar(1024) NOT NULL,
	`altText` varchar(400) NOT NULL,
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `polina_product_images_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS `polina_products` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(200) NOT NULL,
	`slug` varchar(180) NOT NULL,
	`description` text NOT NULL,
	`categoryId` int,
	`featured` boolean NOT NULL DEFAULT false,
	`informationalOnly` boolean NOT NULL DEFAULT false,
	`status` enum('draft','published','archived') NOT NULL DEFAULT 'draft',
	`hasDraftChanges` boolean NOT NULL DEFAULT false,
	`publishedSlug` varchar(180),
	`publishedData` json,
	`amazonUrl` text,
	`flipkartUrl` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`createdBy` int,
	`updatedBy` int,
	`publishedAt` timestamp,
	CONSTRAINT `polina_products_id` PRIMARY KEY(`id`),
	CONSTRAINT `polina_products_slug_unique` UNIQUE(`slug`),
	CONSTRAINT `polina_products_published_slug_uq` UNIQUE(`publishedSlug`)
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS `polina_site_pages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`pageKey` varchar(64) NOT NULL,
	`draftContent` json NOT NULL,
	`publishedContent` json,
	`status` enum('draft','published') NOT NULL DEFAULT 'draft',
	`version` int NOT NULL DEFAULT 1,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`updatedBy` int,
	`publishedAt` timestamp,
	CONSTRAINT `polina_site_pages_id` PRIMARY KEY(`id`),
	CONSTRAINT `polina_site_pages_pageKey_unique` UNIQUE(`pageKey`)
);
--> statement-breakpoint
ALTER TABLE `polina_admin_sessions` ADD CONSTRAINT `polina_admin_sessions_adminId_polina_admin_accounts_id_fk` FOREIGN KEY (`adminId`) REFERENCES `polina_admin_accounts`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `polina_password_reset_tokens` ADD CONSTRAINT `polina_password_reset_tokens_adminId_polina_admin_accounts_id_fk` FOREIGN KEY (`adminId`) REFERENCES `polina_admin_accounts`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `polina_product_images` ADD CONSTRAINT `polina_product_images_productId_polina_products_id_fk` FOREIGN KEY (`productId`) REFERENCES `polina_products`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `polina_products` ADD CONSTRAINT `polina_products_categoryId_polina_categories_id_fk` FOREIGN KEY (`categoryId`) REFERENCES `polina_categories`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `polina_products` ADD CONSTRAINT `polina_products_createdBy_polina_admin_accounts_id_fk` FOREIGN KEY (`createdBy`) REFERENCES `polina_admin_accounts`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `polina_products` ADD CONSTRAINT `polina_products_updatedBy_polina_admin_accounts_id_fk` FOREIGN KEY (`updatedBy`) REFERENCES `polina_admin_accounts`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `polina_site_pages` ADD CONSTRAINT `polina_site_pages_updatedBy_polina_admin_accounts_id_fk` FOREIGN KEY (`updatedBy`) REFERENCES `polina_admin_accounts`(`id`) ON DELETE set null ON UPDATE no action;
