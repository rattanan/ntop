-- MySQL 8 production-target forward migration. Do not apply to legacy MariaDB 5.5.
ALTER TABLE `Lead`
  ADD COLUMN `version` INTEGER NOT NULL DEFAULT 1,
  ADD INDEX `Lead_ownerId_updatedAt_id_idx` (`ownerId`, `updatedAt`, `id`),
  ADD INDEX `Lead_status_updatedAt_id_idx` (`status`, `updatedAt`, `id`);

CREATE TABLE `LeadCommandReceipt` (
  `id` VARCHAR(191) NOT NULL,
  `actorId` VARCHAR(191) NOT NULL,
  `idempotencyKey` VARCHAR(191) NOT NULL,
  `command` VARCHAR(100) NOT NULL,
  `leadId` VARCHAR(191) NOT NULL,
  `customerId` VARCHAR(191) NULL,
  `resultVersion` INTEGER NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `LeadCommandReceipt_actorId_idempotencyKey_command_key` (`actorId`, `idempotencyKey`, `command`),
  INDEX `LeadCommandReceipt_leadId_createdAt_idx` (`leadId`, `createdAt`),
  INDEX `LeadCommandReceipt_customerId_createdAt_idx` (`customerId`, `createdAt`),
  CONSTRAINT `LeadCommandReceipt_actorId_fkey` FOREIGN KEY (`actorId`) REFERENCES `User` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `LeadCommandReceipt_leadId_fkey` FOREIGN KEY (`leadId`) REFERENCES `Lead` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
