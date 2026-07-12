-- MySQL 8 production-target migration. Application code treats audit events as
-- append-only; production DB privileges must restrict this table to SELECT/INSERT.
CREATE TABLE `AuditLedger` (
  `id` VARCHAR(64) NOT NULL,
  `lastSequence` BIGINT NOT NULL DEFAULT 0,
  `lastHash` CHAR(64) NOT NULL,
  `revision` INTEGER NOT NULL DEFAULT 0,
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  CONSTRAINT `AuditLedger_singleton_chk` CHECK (`id` = 'default')
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO `AuditLedger` (`id`, `lastSequence`, `lastHash`, `revision`, `updatedAt`)
VALUES ('default', 0, REPEAT('0', 64), 0, CURRENT_TIMESTAMP(3));

CREATE TABLE `AuditEvent` (
  `id` VARCHAR(191) NOT NULL,
  `sequence` BIGINT NOT NULL,
  `actorId` VARCHAR(191) NOT NULL,
  `action` VARCHAR(191) NOT NULL,
  `targetType` VARCHAR(191) NOT NULL,
  `targetId` VARCHAR(191) NOT NULL,
  `targetVersion` VARCHAR(191) NULL,
  `outcome` VARCHAR(32) NOT NULL,
  `correlationId` VARCHAR(191) NOT NULL,
  `reason` VARCHAR(1000) NULL,
  `data` JSON NULL,
  `previousHash` CHAR(64) NOT NULL,
  `eventHash` CHAR(64) NOT NULL,
  `recordedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `AuditEvent_sequence_key`(`sequence`),
  INDEX `AuditEvent_targetType_targetId_recordedAt_idx`(`targetType`, `targetId`, `recordedAt`),
  INDEX `AuditEvent_actorId_recordedAt_idx`(`actorId`, `recordedAt`),
  INDEX `AuditEvent_correlationId_idx`(`correlationId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
