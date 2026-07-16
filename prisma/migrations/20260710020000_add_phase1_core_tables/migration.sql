-- Bootstrap the Phase 1 tables that pre-date the Prisma migration history.
-- IF NOT EXISTS preserves compatibility with environments initialized from
-- the documented legacy SQL scripts.
CREATE TABLE IF NOT EXISTS `Lead` (
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
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  CONSTRAINT `Lead_ownerId_fkey` FOREIGN KEY (`ownerId`) REFERENCES `User` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `Lead_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `Customer` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `Activity` (
  `id` VARCHAR(191) NOT NULL,
  `subject` VARCHAR(191) NOT NULL,
  `type` ENUM('CALL','MEETING','FOLLOW_UP','TASK') NOT NULL,
  `dueAt` DATETIME(3) NULL,
  `notes` TEXT NULL,
  `aiSummary` TEXT NULL,
  `actionItems` TEXT NULL,
  `ownerId` VARCHAR(191) NOT NULL,
  `customerId` VARCHAR(191) NULL,
  `opportunityId` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  CONSTRAINT `Activity_ownerId_fkey` FOREIGN KEY (`ownerId`) REFERENCES `User` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `Activity_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `Customer` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `Activity_opportunityId_fkey` FOREIGN KEY (`opportunityId`) REFERENCES `Opportunity` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `Product` (
  `id` VARCHAR(191) NOT NULL,
  `code` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `category` VARCHAR(191) NOT NULL,
  `description` TEXT NULL,
  `listPrice` DECIMAL(15,2) NOT NULL,
  `active` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `Product_code_key` (`code`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `Quote` (
  `id` VARCHAR(191) NOT NULL,
  `quoteNo` VARCHAR(191) NOT NULL,
  `customerId` VARCHAR(191) NOT NULL,
  `opportunityId` VARCHAR(191) NULL,
  `status` ENUM('DRAFT','PENDING_APPROVAL','APPROVED','REJECTED','SENT','ACCEPTED','EXPIRED') NOT NULL DEFAULT 'DRAFT',
  `discountPct` INTEGER NOT NULL DEFAULT 0,
  `subtotal` DECIMAL(15,2) NOT NULL,
  `discountValue` DECIMAL(15,2) NOT NULL DEFAULT 0,
  `total` DECIMAL(15,2) NOT NULL,
  `validUntil` DATETIME(3) NULL,
  `notes` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `Quote_quoteNo_key` (`quoteNo`),
  CONSTRAINT `Quote_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `Customer` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `Quote_opportunityId_fkey` FOREIGN KEY (`opportunityId`) REFERENCES `Opportunity` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `QuoteItem` (
  `id` VARCHAR(191) NOT NULL,
  `quoteId` VARCHAR(191) NOT NULL,
  `productId` VARCHAR(191) NOT NULL,
  `quantity` INTEGER NOT NULL DEFAULT 1,
  `unitPrice` DECIMAL(15,2) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  CONSTRAINT `QuoteItem_quoteId_fkey` FOREIGN KEY (`quoteId`) REFERENCES `Quote` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `QuoteItem_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `Approval` (
  `id` VARCHAR(191) NOT NULL,
  `quoteId` VARCHAR(191) NOT NULL,
  `level` INTEGER NOT NULL,
  `status` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
  `comment` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  CONSTRAINT `Approval_quoteId_fkey` FOREIGN KEY (`quoteId`) REFERENCES `Quote` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `CoverageCheck` (
  `id` VARCHAR(191) NOT NULL,
  `opportunityId` VARCHAR(191) NOT NULL,
  `siteAddress` TEXT NOT NULL,
  `circuitCount` INTEGER NOT NULL DEFAULT 1,
  `status` ENUM('DRAFT','REQUESTED','CONFIRMED','UNAVAILABLE','RETURNED') NOT NULL DEFAULT 'DRAFT',
  `fiberAvailable` BOOLEAN NULL,
  `olt` VARCHAR(191) NULL,
  `distanceKm` DECIMAL(10,2) NULL,
  `capacityMbps` INTEGER NULL,
  `availablePorts` INTEGER NULL,
  `expectedInstallDate` DATETIME(3) NULL,
  `confirmedCost` DECIMAL(15,2) NULL,
  `responderNotes` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  CONSTRAINT `CoverageCheck_opportunityId_fkey` FOREIGN KEY (`opportunityId`) REFERENCES `Opportunity` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `SolutionDesign` (
  `id` VARCHAR(191) NOT NULL,
  `opportunityId` VARCHAR(191) NOT NULL,
  `ntWorkValue` DECIMAL(15,2) NOT NULL,
  `partnerCost` DECIMAL(15,2) NOT NULL DEFAULT 0,
  `estimatedCost` DECIMAL(15,2) NOT NULL,
  `estimatedPrice` DECIMAL(15,2) NOT NULL,
  `marginPct` DECIMAL(6,2) NOT NULL,
  `riskNotes` TEXT NULL,
  `assumptions` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `SolutionDesign_opportunityId_key` (`opportunityId`),
  CONSTRAINT `SolutionDesign_opportunityId_fkey` FOREIGN KEY (`opportunityId`) REFERENCES `Opportunity` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `InternalOrder` (
  `id` VARCHAR(191) NOT NULL,
  `orderNo` VARCHAR(191) NOT NULL,
  `quoteId` VARCHAR(191) NOT NULL,
  `status` ENUM('DRAFT','READY_FOR_HANDOFF','SENT','ACKNOWLEDGED','RETURNED','COMPLETED') NOT NULL DEFAULT 'DRAFT',
  `omReference` VARCHAR(191) NULL,
  `crmReference` VARCHAR(191) NULL,
  `billingReference` VARCHAR(191) NULL,
  `handoffNotes` TEXT NULL,
  `sentAt` DATETIME(3) NULL,
  `acknowledgedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `InternalOrder_orderNo_key` (`orderNo`),
  UNIQUE INDEX `InternalOrder_quoteId_key` (`quoteId`),
  CONSTRAINT `InternalOrder_quoteId_fkey` FOREIGN KEY (`quoteId`) REFERENCES `Quote` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
