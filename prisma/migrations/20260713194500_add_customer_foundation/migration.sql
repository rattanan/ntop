-- Customer Foundation expand migration. Forward-only; do not apply to MariaDB 5.5.
ALTER TABLE `Customer`
  ADD COLUMN `version` INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN `mergedIntoCustomerId` VARCHAR(191) NULL,
  ADD INDEX `Customer_status_updatedAt_id_idx`(`status`, `updatedAt`, `id`),
  ADD INDEX `Customer_segment_updatedAt_id_idx`(`segment`, `updatedAt`, `id`),
  ADD INDEX `Customer_mergedIntoCustomerId_idx`(`mergedIntoCustomerId`);

ALTER TABLE `Contact`
  ADD COLUMN `purpose` VARCHAR(100) NULL,
  ADD COLUMN `isPrimary` BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE `CustomerExternalId` (
  `id` VARCHAR(191) NOT NULL,
  `customerId` VARCHAR(191) NOT NULL,
  `sourceSystem` VARCHAR(100) NOT NULL,
  `externalId` VARCHAR(255) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `CustomerExternalId_sourceSystem_externalId_key`(`sourceSystem`, `externalId`),
  INDEX `CustomerExternalId_customerId_sourceSystem_idx`(`customerId`, `sourceSystem`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `CustomerRelationship` (
  `id` VARCHAR(191) NOT NULL,
  `parentCustomerId` VARCHAR(191) NOT NULL,
  `childCustomerId` VARCHAR(191) NOT NULL,
  `relationshipType` VARCHAR(100) NOT NULL,
  `effectiveFrom` DATETIME(3) NOT NULL,
  `effectiveTo` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `CustomerRelationship_parent_child_type_from_key`(`parentCustomerId`, `childCustomerId`, `relationshipType`, `effectiveFrom`),
  INDEX `CustomerRelationship_parentCustomerId_effectiveTo_idx`(`parentCustomerId`, `effectiveTo`),
  INDEX `CustomerRelationship_childCustomerId_effectiveTo_idx`(`childCustomerId`, `effectiveTo`),
  PRIMARY KEY (`id`),
  CONSTRAINT `CustomerRelationship_not_self_chk` CHECK (`parentCustomerId` <> `childCustomerId`),
  CONSTRAINT `CustomerRelationship_period_chk` CHECK (`effectiveTo` IS NULL OR `effectiveTo` > `effectiveFrom`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `CustomerOwnershipAssignment` (
  `id` VARCHAR(191) NOT NULL,
  `customerId` VARCHAR(191) NOT NULL,
  `ownerId` VARCHAR(191) NOT NULL,
  `organizationUnitId` VARCHAR(191) NULL,
  `validFrom` DATETIME(3) NOT NULL,
  `validTo` DATETIME(3) NULL,
  `assignedById` VARCHAR(191) NOT NULL,
  `reason` VARCHAR(1000) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `CustomerOwnershipAssignment_customer_period_idx`(`customerId`, `validFrom`, `validTo`),
  INDEX `CustomerOwnershipAssignment_ownerId_validTo_idx`(`ownerId`, `validTo`),
  INDEX `CustomerOwnershipAssignment_orgUnit_validTo_idx`(`organizationUnitId`, `validTo`),
  PRIMARY KEY (`id`),
  CONSTRAINT `CustomerOwnershipAssignment_period_chk` CHECK (`validTo` IS NULL OR `validTo` > `validFrom`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `CustomerMergeHistory` (
  `id` VARCHAR(191) NOT NULL,
  `sourceCustomerId` VARCHAR(191) NOT NULL,
  `targetCustomerId` VARCHAR(191) NOT NULL,
  `mergedById` VARCHAR(191) NOT NULL,
  `reason` VARCHAR(1000) NOT NULL,
  `sourceSnapshot` JSON NOT NULL,
  `mergedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `CustomerMergeHistory_sourceCustomerId_key`(`sourceCustomerId`),
  INDEX `CustomerMergeHistory_targetCustomerId_mergedAt_idx`(`targetCustomerId`, `mergedAt`),
  PRIMARY KEY (`id`),
  CONSTRAINT `CustomerMergeHistory_not_self_chk` CHECK (`sourceCustomerId` <> `targetCustomerId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `CustomerDuplicateCandidate` (
  `id` VARCHAR(191) NOT NULL,
  `customerAId` VARCHAR(191) NOT NULL,
  `customerBId` VARCHAR(191) NOT NULL,
  `matchScore` DECIMAL(5,4) NOT NULL,
  `matchSignals` JSON NOT NULL,
  `detectedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `resolvedAt` DATETIME(3) NULL,
  `resolutionReason` VARCHAR(1000) NULL,
  `mergedIntoCustomerId` VARCHAR(191) NULL,
  UNIQUE INDEX `CustomerDuplicateCandidate_customerAId_customerBId_key`(`customerAId`, `customerBId`),
  INDEX `CustomerDuplicateCandidate_customerAId_resolvedAt_idx`(`customerAId`, `resolvedAt`),
  INDEX `CustomerDuplicateCandidate_customerBId_resolvedAt_idx`(`customerBId`, `resolvedAt`),
  PRIMARY KEY (`id`),
  CONSTRAINT `CustomerDuplicateCandidate_not_self_chk` CHECK (`customerAId` <> `customerBId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `CustomerCommandReceipt` (
  `id` VARCHAR(191) NOT NULL,
  `actorId` VARCHAR(191) NOT NULL,
  `idempotencyKey` VARCHAR(191) NOT NULL,
  `command` VARCHAR(100) NOT NULL,
  `targetId` VARCHAR(191) NOT NULL,
  `targetVersion` INTEGER NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `CustomerCommandReceipt_actor_key_command_key`(`actorId`, `idempotencyKey`, `command`),
  INDEX `CustomerCommandReceipt_createdAt_idx`(`createdAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `RolePermissionGrant` (
  `id` VARCHAR(191) NOT NULL,
  `roleCode` VARCHAR(100) NOT NULL,
  `permissionCode` VARCHAR(191) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `RolePermissionGrant_roleCode_permissionCode_key`(`roleCode`, `permissionCode`),
  INDEX `RolePermissionGrant_permissionCode_roleCode_idx`(`permissionCode`, `roleCode`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO `CustomerOwnershipAssignment`
  (`id`, `customerId`, `ownerId`, `organizationUnitId`, `validFrom`, `validTo`, `assignedById`, `reason`, `createdAt`)
SELECT CONCAT('own_', SHA2(`id`, 256)), `id`, `ownerId`, `organizationUnitId`, `createdAt`, NULL, `ownerId`, 'Migration bootstrap from Customer.ownerId', CURRENT_TIMESTAMP(3)
FROM `Customer`;

ALTER TABLE `Customer` ADD CONSTRAINT `Customer_mergedIntoCustomerId_fkey`
  FOREIGN KEY (`mergedIntoCustomerId`) REFERENCES `Customer`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `CustomerExternalId` ADD CONSTRAINT `CustomerExternalId_customerId_fkey`
  FOREIGN KEY (`customerId`) REFERENCES `Customer`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `CustomerRelationship` ADD CONSTRAINT `CustomerRelationship_parentCustomerId_fkey`
  FOREIGN KEY (`parentCustomerId`) REFERENCES `Customer`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `CustomerRelationship` ADD CONSTRAINT `CustomerRelationship_childCustomerId_fkey`
  FOREIGN KEY (`childCustomerId`) REFERENCES `Customer`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `CustomerOwnershipAssignment` ADD CONSTRAINT `CustomerOwnershipAssignment_customerId_fkey`
  FOREIGN KEY (`customerId`) REFERENCES `Customer`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `CustomerOwnershipAssignment` ADD CONSTRAINT `CustomerOwnershipAssignment_ownerId_fkey`
  FOREIGN KEY (`ownerId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `CustomerOwnershipAssignment` ADD CONSTRAINT `CustomerOwnershipAssignment_organizationUnitId_fkey`
  FOREIGN KEY (`organizationUnitId`) REFERENCES `OrganizationUnit`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `CustomerOwnershipAssignment` ADD CONSTRAINT `CustomerOwnershipAssignment_assignedById_fkey`
  FOREIGN KEY (`assignedById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `CustomerMergeHistory` ADD CONSTRAINT `CustomerMergeHistory_sourceCustomerId_fkey`
  FOREIGN KEY (`sourceCustomerId`) REFERENCES `Customer`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `CustomerMergeHistory` ADD CONSTRAINT `CustomerMergeHistory_targetCustomerId_fkey`
  FOREIGN KEY (`targetCustomerId`) REFERENCES `Customer`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `CustomerMergeHistory` ADD CONSTRAINT `CustomerMergeHistory_mergedById_fkey`
  FOREIGN KEY (`mergedById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `CustomerDuplicateCandidate` ADD CONSTRAINT `CustomerDuplicateCandidate_customerAId_fkey`
  FOREIGN KEY (`customerAId`) REFERENCES `Customer`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `CustomerDuplicateCandidate` ADD CONSTRAINT `CustomerDuplicateCandidate_customerBId_fkey`
  FOREIGN KEY (`customerBId`) REFERENCES `Customer`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `CustomerDuplicateCandidate` ADD CONSTRAINT `CustomerDuplicateCandidate_mergedIntoCustomerId_fkey`
  FOREIGN KEY (`mergedIntoCustomerId`) REFERENCES `Customer`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `CustomerCommandReceipt` ADD CONSTRAINT `CustomerCommandReceipt_actorId_fkey`
  FOREIGN KEY (`actorId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
