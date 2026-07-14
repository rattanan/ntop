-- MariaDB 5.5 compatibility counterpart for
-- migrations/20260714120000_add_lead_workflow/migration.sql.
ALTER TABLE `Lead`
  ADD COLUMN `version` INTEGER NOT NULL DEFAULT 1,
  ADD KEY `Lead_ownerId_updatedAt_id_idx` (`ownerId`, `updatedAt`, `id`),
  ADD KEY `Lead_status_updatedAt_id_idx` (`status`, `updatedAt`, `id`);

CREATE TABLE `LeadCommandReceipt` (
  `id` VARCHAR(191) NOT NULL,
  `actorId` VARCHAR(191) NOT NULL,
  `idempotencyKey` VARCHAR(191) NOT NULL,
  `command` VARCHAR(100) NOT NULL,
  `leadId` VARCHAR(191) NOT NULL,
  `customerId` VARCHAR(191) NULL,
  `resultVersion` INTEGER NOT NULL,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `LeadCommandReceipt_actor_key_command_key` (`actorId`, `idempotencyKey`, `command`),
  KEY `LeadCommandReceipt_leadId_createdAt_idx` (`leadId`, `createdAt`),
  KEY `LeadCommandReceipt_customerId_createdAt_idx` (`customerId`, `createdAt`),
  CONSTRAINT `LeadCommandReceipt_actorId_fkey` FOREIGN KEY (`actorId`) REFERENCES `User` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `LeadCommandReceipt_leadId_fkey` FOREIGN KEY (`leadId`) REFERENCES `Lead` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

INSERT INTO `LegacySchemaMigration` (`id`, `appliedAt`)
VALUES ('20260714120000_add_lead_workflow', UTC_TIMESTAMP());
