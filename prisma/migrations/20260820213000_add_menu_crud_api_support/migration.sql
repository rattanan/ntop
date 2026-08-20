CREATE TABLE `ActivityCommandReceipt` (
  `id` VARCHAR(191) NOT NULL,
  `actorId` VARCHAR(191) NOT NULL,
  `idempotencyKey` VARCHAR(191) NOT NULL,
  `command` VARCHAR(100) NOT NULL,
  `requestHash` CHAR(64) NOT NULL,
  `targetId` VARCHAR(191) NOT NULL,
  `targetVersion` INTEGER NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `ActivityCommandReceipt_actorId_idempotencyKey_command_key`(`actorId`, `idempotencyKey`, `command`),
  INDEX `ActivityCommandReceipt_targetId_createdAt_idx`(`targetId`, `createdAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `Product`
  ADD COLUMN `version` INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN `deletedAt` DATETIME(3) NULL,
  ADD COLUMN `deletedById` VARCHAR(191) NULL,
  ADD INDEX `Product_deletedAt_active_category_name_idx`(`deletedAt`, `active`, `category`, `name`);

ALTER TABLE `CoverageCheck`
  ADD COLUMN `version` INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN `deletedAt` DATETIME(3) NULL,
  ADD COLUMN `deletedById` VARCHAR(191) NULL,
  ADD INDEX `CoverageCheck_opportunityId_deletedAt_createdAt_idx`(`opportunityId`, `deletedAt`, `createdAt`);

CREATE TABLE `PresalesCommandReceipt` (
  `id` VARCHAR(191) NOT NULL,
  `actorId` VARCHAR(191) NOT NULL,
  `idempotencyKey` VARCHAR(191) NOT NULL,
  `command` VARCHAR(100) NOT NULL,
  `requestHash` CHAR(64) NOT NULL,
  `targetType` VARCHAR(100) NOT NULL,
  `targetId` VARCHAR(191) NOT NULL,
  `targetVersion` INTEGER NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `PresalesCommandReceipt_actorId_idempotencyKey_command_key`(`actorId`, `idempotencyKey`, `command`),
  INDEX `PresalesCommandReceipt_targetType_targetId_createdAt_idx`(`targetType`, `targetId`, `createdAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
