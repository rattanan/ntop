-- Phase 1 expansion: lead and activity / meeting management for MariaDB 5.5.
CREATE TABLE `Lead` (
  `id` VARCHAR(191) NOT NULL,
  `company` VARCHAR(191) NOT NULL,
  `contactName` VARCHAR(191) NOT NULL,
  `contactEmail` VARCHAR(191) NULL,
  `contactPhone` VARCHAR(191) NULL,
  `source` ENUM('IMPORT','WEBSITE','EVENT','PARTNER','REFERRAL','EXISTING_CUSTOMER') NOT NULL,
  `status` ENUM('NEW','CONTACTED','QUALIFIED','NURTURING','CONVERTED','DISQUALIFIED') NOT NULL DEFAULT 'NEW',
  `score` INTEGER NOT NULL DEFAULT 0,
  `recommendedProducts` TEXT NULL,
  `notes` TEXT NULL,
  `ownerId` VARCHAR(191) NOT NULL,
  `customerId` VARCHAR(191) NULL,
  `createdAt` DATETIME NOT NULL,
  `updatedAt` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  CONSTRAINT `Lead_ownerId_fkey` FOREIGN KEY (`ownerId`) REFERENCES `User` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `Lead_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `Customer` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE `Activity` (
  `id` VARCHAR(191) NOT NULL,
  `subject` VARCHAR(191) NOT NULL,
  `type` ENUM('CALL','MEETING','FOLLOW_UP','TASK') NOT NULL,
  `dueAt` DATETIME NULL,
  `notes` TEXT NULL,
  `aiSummary` TEXT NULL,
  `actionItems` TEXT NULL,
  `ownerId` VARCHAR(191) NOT NULL,
  `customerId` VARCHAR(191) NULL,
  `opportunityId` VARCHAR(191) NULL,
  `createdAt` DATETIME NOT NULL,
  `updatedAt` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  CONSTRAINT `Activity_ownerId_fkey` FOREIGN KEY (`ownerId`) REFERENCES `User` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `Activity_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `Customer` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `Activity_opportunityId_fkey` FOREIGN KEY (`opportunityId`) REFERENCES `Opportunity` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
