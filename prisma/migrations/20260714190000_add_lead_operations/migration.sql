CREATE TABLE `LeadSavedView` (
  `id` VARCHAR(191) NOT NULL, `userId` VARCHAR(191) NOT NULL, `name` VARCHAR(100) NOT NULL,
  `query` JSON NOT NULL, `columns` JSON NULL, `isDefault` BOOLEAN NOT NULL DEFAULT false,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`), UNIQUE INDEX `LeadSavedView_userId_name_key` (`userId`,`name`),
  INDEX `LeadSavedView_userId_isDefault_idx` (`userId`,`isDefault`),
  CONSTRAINT `LeadSavedView_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `LeadAssignmentRule` (
  `id` VARCHAR(191) NOT NULL, `name` VARCHAR(191) NOT NULL, `priority` INTEGER NOT NULL DEFAULT 100,
  `active` BOOLEAN NOT NULL DEFAULT true, `strategy` ENUM('OWNER','ROUND_ROBIN') NOT NULL,
  `criteria` JSON NOT NULL, `targetOwnerId` VARCHAR(191) NULL, `organizationUnitId` VARCHAR(191) NULL,
  `lastAssignedUserId` VARCHAR(191) NULL, `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`), INDEX `LeadAssignmentRule_active_priority_idx` (`active`,`priority`),
  INDEX `LeadAssignmentRule_organizationUnitId_active_idx` (`organizationUnitId`,`active`),
  CONSTRAINT `LeadAssignmentRule_targetOwnerId_fkey` FOREIGN KEY (`targetOwnerId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `LeadAssignmentRule_organizationUnitId_fkey` FOREIGN KEY (`organizationUnitId`) REFERENCES `OrganizationUnit`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
