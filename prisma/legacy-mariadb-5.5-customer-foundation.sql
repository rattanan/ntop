-- Customer Foundation release migration for the legacy MariaDB 5.5 runtime.
-- This is the compatible counterpart of
-- migrations/20260713194500_add_customer_foundation/migration.sql.
-- JSON is stored as LONGTEXT because MariaDB 5.5 has no native JSON type.
-- Hash-backed unique keys avoid the legacy InnoDB 767-byte index limit while
-- retaining exact logical uniqueness for the composite business keys.

CREATE TABLE `LegacySchemaMigration` (
  `id` VARCHAR(191) NOT NULL,
  `appliedAt` DATETIME NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `AuditLedger` (
  `id` VARCHAR(64) NOT NULL,
  `lastSequence` BIGINT NOT NULL DEFAULT 0,
  `lastHash` CHAR(64) NOT NULL,
  `revision` INTEGER NOT NULL DEFAULT 0,
  `updatedAt` DATETIME NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

INSERT INTO `AuditLedger`
  (`id`, `lastSequence`, `lastHash`, `revision`, `updatedAt`)
VALUES ('default', 0, REPEAT('0', 64), 0, UTC_TIMESTAMP());

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
  `data` LONGTEXT NULL,
  `previousHash` CHAR(64) NOT NULL,
  `eventHash` CHAR(64) NOT NULL,
  `recordedAt` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `AuditEvent_sequence_key` (`sequence`),
  KEY `AuditEvent_target_idx` (`targetType`(64), `targetId`(64), `recordedAt`),
  KEY `AuditEvent_actor_idx` (`actorId`(100), `recordedAt`),
  KEY `AuditEvent_correlationId_idx` (`correlationId`(100))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

ALTER TABLE `Customer`
  ADD COLUMN `version` INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN `mergedIntoCustomerId` VARCHAR(191) NULL,
  ADD KEY `Customer_status_updatedAt_id_idx` (`status`, `updatedAt`),
  ADD KEY `Customer_segment_updatedAt_id_idx` (`segment`(64), `updatedAt`),
  ADD KEY `Customer_mergedIntoCustomerId_idx` (`mergedIntoCustomerId`),
  ADD CONSTRAINT `Customer_mergedIntoCustomerId_fkey`
    FOREIGN KEY (`mergedIntoCustomerId`) REFERENCES `Customer` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `Contact`
  ADD COLUMN `purpose` VARCHAR(100) NULL,
  ADD COLUMN `isPrimary` TINYINT(1) NOT NULL DEFAULT 0;

CREATE TABLE `CustomerExternalId` (
  `id` VARCHAR(191) NOT NULL,
  `customerId` VARCHAR(191) NOT NULL,
  `sourceSystem` VARCHAR(100) NOT NULL,
  `externalId` VARCHAR(255) NOT NULL,
  `identityHash` CHAR(64) NOT NULL,
  `createdAt` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `CustomerExternalId_sourceSystem_externalId_key` (`identityHash`),
  KEY `CustomerExternalId_customerId_sourceSystem_idx` (`customerId`),
  CONSTRAINT `CustomerExternalId_customerId_fkey`
    FOREIGN KEY (`customerId`) REFERENCES `Customer` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TRIGGER `CustomerExternalId_hash_insert`
BEFORE INSERT ON `CustomerExternalId` FOR EACH ROW
SET NEW.`identityHash` = SHA2(CONCAT(CHAR_LENGTH(NEW.`sourceSystem`), ':', NEW.`sourceSystem`, '|', NEW.`externalId`), 256);

CREATE TRIGGER `CustomerExternalId_hash_update`
BEFORE UPDATE ON `CustomerExternalId` FOR EACH ROW
SET NEW.`identityHash` = SHA2(CONCAT(CHAR_LENGTH(NEW.`sourceSystem`), ':', NEW.`sourceSystem`, '|', NEW.`externalId`), 256);

CREATE TABLE `CustomerRelationship` (
  `id` VARCHAR(191) NOT NULL,
  `parentCustomerId` VARCHAR(191) NOT NULL,
  `childCustomerId` VARCHAR(191) NOT NULL,
  `relationshipType` VARCHAR(100) NOT NULL,
  `effectiveFrom` DATETIME NOT NULL,
  `effectiveTo` DATETIME NULL,
  `relationshipHash` CHAR(64) NOT NULL,
  `createdAt` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `CustomerRelationship_parent_child_type_from_key` (`relationshipHash`),
  KEY `CustomerRelationship_parentCustomerId_effectiveTo_idx` (`parentCustomerId`),
  KEY `CustomerRelationship_childCustomerId_effectiveTo_idx` (`childCustomerId`),
  CONSTRAINT `CustomerRelationship_parentCustomerId_fkey`
    FOREIGN KEY (`parentCustomerId`) REFERENCES `Customer` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `CustomerRelationship_childCustomerId_fkey`
    FOREIGN KEY (`childCustomerId`) REFERENCES `Customer` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TRIGGER `CustomerRelationship_hash_insert`
BEFORE INSERT ON `CustomerRelationship` FOR EACH ROW
SET NEW.`relationshipHash` = SHA2(CONCAT(NEW.`parentCustomerId`, '|', NEW.`childCustomerId`, '|', NEW.`relationshipType`, '|', DATE_FORMAT(NEW.`effectiveFrom`, '%Y-%m-%dT%H:%i:%s')), 256);

CREATE TRIGGER `CustomerRelationship_hash_update`
BEFORE UPDATE ON `CustomerRelationship` FOR EACH ROW
SET NEW.`relationshipHash` = SHA2(CONCAT(NEW.`parentCustomerId`, '|', NEW.`childCustomerId`, '|', NEW.`relationshipType`, '|', DATE_FORMAT(NEW.`effectiveFrom`, '%Y-%m-%dT%H:%i:%s')), 256);

CREATE TABLE `CustomerOwnershipAssignment` (
  `id` VARCHAR(191) NOT NULL,
  `customerId` VARCHAR(191) NOT NULL,
  `ownerId` VARCHAR(191) NOT NULL,
  `organizationUnitId` VARCHAR(191) NULL,
  `validFrom` DATETIME NOT NULL,
  `validTo` DATETIME NULL,
  `assignedById` VARCHAR(191) NOT NULL,
  `reason` VARCHAR(1000) NULL,
  `createdAt` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  KEY `CustomerOwnershipAssignment_customer_period_idx` (`customerId`),
  KEY `CustomerOwnershipAssignment_ownerId_validTo_idx` (`ownerId`),
  KEY `CustomerOwnershipAssignment_orgUnit_validTo_idx` (`organizationUnitId`),
  CONSTRAINT `CustomerOwnershipAssignment_customerId_fkey`
    FOREIGN KEY (`customerId`) REFERENCES `Customer` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `CustomerOwnershipAssignment_ownerId_fkey`
    FOREIGN KEY (`ownerId`) REFERENCES `User` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `CustomerOwnershipAssignment_organizationUnitId_fkey`
    FOREIGN KEY (`organizationUnitId`) REFERENCES `OrganizationUnit` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `CustomerOwnershipAssignment_assignedById_fkey`
    FOREIGN KEY (`assignedById`) REFERENCES `User` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `CustomerMergeHistory` (
  `id` VARCHAR(191) NOT NULL,
  `sourceCustomerId` VARCHAR(191) NOT NULL,
  `targetCustomerId` VARCHAR(191) NOT NULL,
  `mergedById` VARCHAR(191) NOT NULL,
  `reason` VARCHAR(1000) NOT NULL,
  `sourceSnapshot` LONGTEXT NOT NULL,
  `mergedAt` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `CustomerMergeHistory_sourceCustomerId_key` (`sourceCustomerId`),
  KEY `CustomerMergeHistory_targetCustomerId_mergedAt_idx` (`targetCustomerId`),
  CONSTRAINT `CustomerMergeHistory_sourceCustomerId_fkey`
    FOREIGN KEY (`sourceCustomerId`) REFERENCES `Customer` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `CustomerMergeHistory_targetCustomerId_fkey`
    FOREIGN KEY (`targetCustomerId`) REFERENCES `Customer` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `CustomerMergeHistory_mergedById_fkey`
    FOREIGN KEY (`mergedById`) REFERENCES `User` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `CustomerDuplicateCandidate` (
  `id` VARCHAR(191) NOT NULL,
  `customerAId` VARCHAR(191) NOT NULL,
  `customerBId` VARCHAR(191) NOT NULL,
  `matchScore` DECIMAL(5,4) NOT NULL,
  `matchSignals` LONGTEXT NOT NULL,
  `detectedAt` DATETIME NOT NULL,
  `resolvedAt` DATETIME NULL,
  `resolutionReason` VARCHAR(1000) NULL,
  `mergedIntoCustomerId` VARCHAR(191) NULL,
  `pairHash` CHAR(64) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `CustomerDuplicateCandidate_customerAId_customerBId_key` (`pairHash`),
  KEY `CustomerDuplicateCandidate_customerAId_resolvedAt_idx` (`customerAId`),
  KEY `CustomerDuplicateCandidate_customerBId_resolvedAt_idx` (`customerBId`),
  CONSTRAINT `CustomerDuplicateCandidate_customerAId_fkey`
    FOREIGN KEY (`customerAId`) REFERENCES `Customer` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `CustomerDuplicateCandidate_customerBId_fkey`
    FOREIGN KEY (`customerBId`) REFERENCES `Customer` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `CustomerDuplicateCandidate_mergedIntoCustomerId_fkey`
    FOREIGN KEY (`mergedIntoCustomerId`) REFERENCES `Customer` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TRIGGER `CustomerDuplicateCandidate_hash_insert`
BEFORE INSERT ON `CustomerDuplicateCandidate` FOR EACH ROW
SET NEW.`pairHash` = SHA2(CONCAT(NEW.`customerAId`, '|', NEW.`customerBId`), 256);

CREATE TRIGGER `CustomerDuplicateCandidate_hash_update`
BEFORE UPDATE ON `CustomerDuplicateCandidate` FOR EACH ROW
SET NEW.`pairHash` = SHA2(CONCAT(NEW.`customerAId`, '|', NEW.`customerBId`), 256);

CREATE TABLE `CustomerCommandReceipt` (
  `id` VARCHAR(191) NOT NULL,
  `actorId` VARCHAR(191) NOT NULL,
  `idempotencyKey` VARCHAR(191) NOT NULL,
  `command` VARCHAR(100) NOT NULL,
  `targetId` VARCHAR(191) NOT NULL,
  `targetVersion` INTEGER NULL,
  `receiptHash` CHAR(64) NOT NULL,
  `createdAt` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `CustomerCommandReceipt_actor_key_command_key` (`receiptHash`),
  KEY `CustomerCommandReceipt_createdAt_idx` (`createdAt`),
  CONSTRAINT `CustomerCommandReceipt_actorId_fkey`
    FOREIGN KEY (`actorId`) REFERENCES `User` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TRIGGER `CustomerCommandReceipt_hash_insert`
BEFORE INSERT ON `CustomerCommandReceipt` FOR EACH ROW
SET NEW.`receiptHash` = SHA2(CONCAT(NEW.`actorId`, '|', NEW.`idempotencyKey`, '|', NEW.`command`), 256);

CREATE TRIGGER `CustomerCommandReceipt_hash_update`
BEFORE UPDATE ON `CustomerCommandReceipt` FOR EACH ROW
SET NEW.`receiptHash` = SHA2(CONCAT(NEW.`actorId`, '|', NEW.`idempotencyKey`, '|', NEW.`command`), 256);

CREATE TABLE `RolePermissionGrant` (
  `id` VARCHAR(191) NOT NULL,
  `roleCode` VARCHAR(100) NOT NULL,
  `permissionCode` VARCHAR(191) NOT NULL,
  `grantHash` CHAR(64) NOT NULL,
  `createdAt` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `RolePermissionGrant_roleCode_permissionCode_key` (`grantHash`),
  KEY `RolePermissionGrant_permissionCode_roleCode_idx` (`permissionCode`(100), `roleCode`(64))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TRIGGER `RolePermissionGrant_hash_insert`
BEFORE INSERT ON `RolePermissionGrant` FOR EACH ROW
SET NEW.`grantHash` = SHA2(CONCAT(NEW.`roleCode`, '|', NEW.`permissionCode`), 256);

CREATE TRIGGER `RolePermissionGrant_hash_update`
BEFORE UPDATE ON `RolePermissionGrant` FOR EACH ROW
SET NEW.`grantHash` = SHA2(CONCAT(NEW.`roleCode`, '|', NEW.`permissionCode`), 256);

INSERT INTO `CustomerOwnershipAssignment`
  (`id`, `customerId`, `ownerId`, `organizationUnitId`, `validFrom`, `validTo`, `assignedById`, `reason`, `createdAt`)
SELECT CONCAT('own_', SHA2(`id`, 256)), `id`, `ownerId`, `organizationUnitId`, `createdAt`, NULL, `ownerId`, 'Migration bootstrap from Customer.ownerId', UTC_TIMESTAMP()
FROM `Customer`;

INSERT INTO `LegacySchemaMigration` (`id`, `appliedAt`)
VALUES ('20260713194500_add_customer_foundation', UTC_TIMESTAMP());
