ALTER TABLE `Product`
  ADD COLUMN `version` INT NOT NULL DEFAULT 1,
  ADD COLUMN `deletedAt` DATETIME NULL,
  ADD COLUMN `deletedById` VARCHAR(191) NULL,
  ADD INDEX `Product_deletedAt_active_category_name_idx` (`deletedAt`, `active`, `category`(50), `name`(100));

ALTER TABLE `CoverageCheck`
  ADD COLUMN `version` INT NOT NULL DEFAULT 1,
  ADD COLUMN `deletedAt` DATETIME NULL,
  ADD COLUMN `deletedById` VARCHAR(191) NULL,
  ADD INDEX `CoverageCheck_opportunityId_deletedAt_createdAt_idx` (`opportunityId`(100), `deletedAt`, `createdAt`);

CREATE TABLE `ActivityCommandReceipt` (
  `id` VARCHAR(191) NOT NULL,
  `actorId` VARCHAR(191) NOT NULL,
  `idempotencyKey` VARCHAR(191) NOT NULL,
  `command` VARCHAR(100) NOT NULL,
  `receiptHash` CHAR(64) NULL,
  `requestHash` CHAR(64) NOT NULL,
  `targetId` VARCHAR(191) NOT NULL,
  `targetVersion` INT NOT NULL,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `ActivityCommandReceipt_receiptHash_key` (`receiptHash`),
  KEY `ActivityCommandReceipt_targetId_createdAt_idx` (`targetId`, `createdAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `PresalesCommandReceipt` (
  `id` VARCHAR(191) NOT NULL,
  `actorId` VARCHAR(191) NOT NULL,
  `idempotencyKey` VARCHAR(191) NOT NULL,
  `command` VARCHAR(100) NOT NULL,
  `receiptHash` CHAR(64) NULL,
  `requestHash` CHAR(64) NOT NULL,
  `targetType` VARCHAR(100) NOT NULL,
  `targetId` VARCHAR(191) NOT NULL,
  `targetVersion` INT NOT NULL,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `PresalesCommandReceipt_receiptHash_key` (`receiptHash`),
  KEY `PresalesCommandReceipt_targetType_targetId_createdAt_idx` (`targetType`, `targetId`, `createdAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TRIGGER `ActivityCommandReceipt_hash_insert`
BEFORE INSERT ON `ActivityCommandReceipt` FOR EACH ROW
SET NEW.`receiptHash` = SHA2(CONCAT(NEW.`actorId`, '|', NEW.`idempotencyKey`, '|', NEW.`command`), 256);

CREATE TRIGGER `ActivityCommandReceipt_hash_update`
BEFORE UPDATE ON `ActivityCommandReceipt` FOR EACH ROW
SET NEW.`receiptHash` = SHA2(CONCAT(NEW.`actorId`, '|', NEW.`idempotencyKey`, '|', NEW.`command`), 256);

CREATE TRIGGER `PresalesCommandReceipt_hash_insert`
BEFORE INSERT ON `PresalesCommandReceipt` FOR EACH ROW
SET NEW.`receiptHash` = SHA2(CONCAT(NEW.`actorId`, '|', NEW.`idempotencyKey`, '|', NEW.`command`), 256);

CREATE TRIGGER `PresalesCommandReceipt_hash_update`
BEFORE UPDATE ON `PresalesCommandReceipt` FOR EACH ROW
SET NEW.`receiptHash` = SHA2(CONCAT(NEW.`actorId`, '|', NEW.`idempotencyKey`, '|', NEW.`command`), 256);
