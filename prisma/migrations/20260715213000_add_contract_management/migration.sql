-- CreateTable
CREATE TABLE IF NOT EXISTS `ContractStatusDefinition` (
    `code` VARCHAR(40) NOT NULL,
    `label` VARCHAR(100) NOT NULL,
    `sortOrder` INTEGER NOT NULL,
    `terminal` BOOLEAN NOT NULL DEFAULT false,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `reportingCategory` VARCHAR(32) NOT NULL DEFAULT 'OPEN',
    `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updatedAt` DATETIME NOT NULL,

    INDEX `ContractStatusDefinition_active_sortOrder_idx`(`active`, `sortOrder`),
    PRIMARY KEY (`code`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE IF NOT EXISTS `ContractStatusTransition` (
    `id` VARCHAR(191) NOT NULL,
    `fromStatusCode` VARCHAR(40) NOT NULL,
    `toStatusCode` VARCHAR(40) NOT NULL,
    `requiredPermission` VARCHAR(191) NULL,
    `makerChecker` BOOLEAN NOT NULL DEFAULT false,
    `requiredSignatureParties` LONGTEXT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    INDEX `ContractStatusTransition_fromStatusCode_active_idx`(`fromStatusCode`, `active`),
    UNIQUE INDEX `ContractStatusTransition_fromStatusCode_toStatusCode_key`(`fromStatusCode`, `toStatusCode`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE IF NOT EXISTS `ContractTypeDefinition` (
    `code` VARCHAR(60) NOT NULL,
    `name` VARCHAR(150) NOT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updatedAt` DATETIME NOT NULL,

    INDEX `ContractTypeDefinition_active_name_idx`(`active`, `name`),
    PRIMARY KEY (`code`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE IF NOT EXISTS `Contract` (
    `id` VARCHAR(191) NOT NULL,
    `contractNo` VARCHAR(40) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `contractTypeCode` VARCHAR(60) NOT NULL,
    `statusCode` VARCHAR(40) NOT NULL,
    `customerId` VARCHAR(191) NOT NULL,
    `customerContactId` VARCHAR(191) NULL,
    `ownerId` VARCHAR(191) NOT NULL,
    `organizationUnitId` VARCHAR(191) NULL,
    `quoteId` VARCHAR(191) NOT NULL,
    `quoteVersionId` VARCHAR(191) NOT NULL,
    `opportunityId` VARCHAR(191) NULL,
    `proposalId` VARCHAR(191) NULL,
    `boqId` VARCHAR(191) NULL,
    `siteSurveyRequestId` VARCHAR(191) NULL,
    `version` INTEGER NOT NULL DEFAULT 1,
    `currency` CHAR(3) NOT NULL DEFAULT 'THB',
    `startDate` DATETIME NULL,
    `endDate` DATETIME NULL,
    `effectiveAt` DATETIME NULL,
    `autoRenewal` BOOLEAN NOT NULL DEFAULT false,
    `nextRenewalAt` DATETIME NULL,
    `totalContractValue` DECIMAL(19, 4) NOT NULL,
    `monthlyRecurringRevenue` DECIMAL(19, 4) NOT NULL,
    `oneTimeRevenue` DECIMAL(19, 4) NOT NULL,
    `deletedAt` DATETIME NULL,
    `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updatedAt` DATETIME NOT NULL,

    UNIQUE INDEX `Contract_contractNo_key`(`contractNo`),
    UNIQUE INDEX `Contract_quoteVersionId_key`(`quoteVersionId`),
    INDEX `Contract_ownerId_statusCode_updatedAt_id_idx`(`ownerId`, `statusCode`, `updatedAt`, `id`),
    INDEX `Contract_customerId_statusCode_updatedAt_id_idx`(`customerId`, `statusCode`, `updatedAt`, `id`),
    INDEX `Contract_contractTypeCode_statusCode_updatedAt_id_idx`(`contractTypeCode`, `statusCode`, `updatedAt`, `id`),
    INDEX `Contract_organizationUnitId_statusCode_updatedAt_id_idx`(`organizationUnitId`, `statusCode`, `updatedAt`, `id`),
    INDEX `Contract_endDate_statusCode_idx`(`endDate`, `statusCode`),
    INDEX `Contract_nextRenewalAt_statusCode_idx`(`nextRenewalAt`, `statusCode`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE IF NOT EXISTS `ContractVersion` (
    `id` VARCHAR(191) NOT NULL,
    `contractId` VARCHAR(191) NOT NULL,
    `versionNumber` INTEGER NOT NULL,
    `statusCode` VARCHAR(40) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `currency` CHAR(3) NOT NULL,
    `startDate` DATETIME NULL,
    `endDate` DATETIME NULL,
    `paymentTerm` VARCHAR(255) NULL,
    `billingCycle` VARCHAR(100) NULL,
    `taxRate` DECIMAL(7, 4) NOT NULL DEFAULT 0,
    `subtotal` DECIMAL(19, 4) NOT NULL,
    `discountAmount` DECIMAL(19, 4) NOT NULL,
    `taxAmount` DECIMAL(19, 4) NOT NULL,
    `totalWithTax` DECIMAL(19, 4) NOT NULL,
    `totalContractValue` DECIMAL(19, 4) NOT NULL,
    `monthlyRecurringRevenue` DECIMAL(19, 4) NOT NULL,
    `oneTimeRevenue` DECIMAL(19, 4) NOT NULL,
    `annualRecurringRevenue` DECIMAL(19, 4) NOT NULL,
    `terms` LONGTEXT NULL,
    `remarks` TEXT NULL,
    `sourceSnapshot` LONGTEXT NOT NULL,
    `changeReason` VARCHAR(1000) NULL,
    `amendmentId` VARCHAR(191) NULL,
    `aiProviderConfigurationVersionId` VARCHAR(191) NULL,
    `aiProviderModel` VARCHAR(255) NULL,
    `aiPromptTemplateVersion` VARCHAR(100) NULL,
    `aiInputSourceReferences` LONGTEXT NULL,
    `createdById` VARCHAR(191) NOT NULL,
    `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    INDEX `ContractVersion_contractId_createdAt_idx`(`contractId`, `createdAt`),
    INDEX `ContractVersion_amendmentId_idx`(`amendmentId`),
    UNIQUE INDEX `ContractVersion_contractId_versionNumber_key`(`contractId`, `versionNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE IF NOT EXISTS `ContractItem` (
    `id` VARCHAR(191) NOT NULL,
    `contractVersionId` VARCHAR(191) NOT NULL,
    `productId` VARCHAR(191) NULL,
    `productCode` VARCHAR(191) NOT NULL,
    `serviceName` VARCHAR(255) NOT NULL,
    `description` TEXT NULL,
    `quantity` DECIMAL(19, 4) NOT NULL,
    `unit` VARCHAR(50) NOT NULL,
    `monthlyCharge` DECIMAL(19, 4) NOT NULL,
    `oneTimeCharge` DECIMAL(19, 4) NOT NULL,
    `discountAmount` DECIMAL(19, 4) NOT NULL,
    `durationMonths` INTEGER NOT NULL,
    `lineContractValue` DECIMAL(19, 4) NOT NULL,
    `installationRequired` BOOLEAN NOT NULL DEFAULT false,
    `solutionInstallationSiteId` VARCHAR(191) NULL,
    `serviceLocation` VARCHAR(500) NULL,
    `bandwidth` VARCHAR(100) NULL,
    `sla` VARCHAR(255) NULL,
    `supportLevel` VARCHAR(255) NULL,
    `futureCircuitId` VARCHAR(191) NULL,
    `futureServiceId` VARCHAR(191) NULL,
    `sortOrder` INTEGER NOT NULL,
    `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    INDEX `ContractItem_contractVersionId_sortOrder_idx`(`contractVersionId`, `sortOrder`),
    INDEX `ContractItem_productId_idx`(`productId`),
    INDEX `ContractItem_solutionInstallationSiteId_idx`(`solutionInstallationSiteId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE IF NOT EXISTS `ContractReview` (
    `id` VARCHAR(191) NOT NULL,
    `contractId` VARCHAR(191) NOT NULL,
    `contractVersionId` VARCHAR(191) NOT NULL,
    `reviewType` VARCHAR(50) NOT NULL,
    `status` VARCHAR(40) NOT NULL,
    `reviewerId` VARCHAR(191) NOT NULL,
    `riskLevel` VARCHAR(40) NULL,
    `clauses` LONGTEXT NULL,
    `comment` TEXT NULL,
    `decidedAt` DATETIME NULL,
    `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    INDEX `ContractReview_contractId_reviewType_status_createdAt_idx`(`contractId`, `reviewType`, `status`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE IF NOT EXISTS `ContractDocument` (
    `id` VARCHAR(191) NOT NULL,
    `contractId` VARCHAR(191) NOT NULL,
    `category` VARCHAR(60) NOT NULL,
    `currentVersion` INTEGER NOT NULL DEFAULT 0,
    `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updatedAt` DATETIME NOT NULL,

    INDEX `ContractDocument_contractId_category_updatedAt_idx`(`contractId`, `category`, `updatedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE IF NOT EXISTS `ContractDocumentVersion` (
    `id` VARCHAR(191) NOT NULL,
    `documentId` VARCHAR(191) NOT NULL,
    `versionNumber` INTEGER NOT NULL,
    `fileName` VARCHAR(255) NOT NULL,
    `mimeType` VARCHAR(191) NOT NULL,
    `sizeBytes` BIGINT NOT NULL,
    `objectKey` TEXT NOT NULL,
    `objectKeyHash` CHAR(64) NOT NULL,
    `sha256` CHAR(64) NOT NULL,
    `malwareScanStatus` VARCHAR(40) NOT NULL,
    `uploadedById` VARCHAR(191) NOT NULL,
    `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    UNIQUE INDEX `ContractDocumentVersion_objectKeyHash_key`(`objectKeyHash`),
    INDEX `ContractDocumentVersion_documentId_createdAt_idx`(`documentId`, `createdAt`),
    UNIQUE INDEX `ContractDocumentVersion_documentId_versionNumber_key`(`documentId`, `versionNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE IF NOT EXISTS `ContractSignature` (
    `id` VARCHAR(191) NOT NULL,
    `contractId` VARCHAR(191) NOT NULL,
    `contractVersionId` VARCHAR(191) NOT NULL,
    `partyCode` VARCHAR(40) NOT NULL,
    `methodCode` VARCHAR(40) NOT NULL,
    `status` VARCHAR(40) NOT NULL,
    `documentVersionId` VARCHAR(191) NOT NULL,
    `signedByName` VARCHAR(255) NOT NULL,
    `signedAt` DATETIME NOT NULL,
    `verifiedById` VARCHAR(191) NOT NULL,
    `providerReference` VARCHAR(255) NULL,
    `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    INDEX `ContractSignature_contractId_status_signedAt_idx`(`contractId`, `status`, `signedAt`),
    UNIQUE INDEX `ContractSignature_contractVersionId_partyCode_key`(`contractVersionId`, `partyCode`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE IF NOT EXISTS `ContractAmendment` (
    `id` VARCHAR(191) NOT NULL,
    `contractId` VARCHAR(191) NOT NULL,
    `amendmentNo` VARCHAR(60) NOT NULL,
    `amendmentTypeCode` VARCHAR(60) NOT NULL,
    `status` VARCHAR(40) NOT NULL,
    `reason` VARCHAR(1000) NOT NULL,
    `sourceVersionNumber` INTEGER NOT NULL,
    `resultingVersionNumber` INTEGER NULL,
    `requestedById` VARCHAR(191) NOT NULL,
    `approvedAt` DATETIME NULL,
    `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updatedAt` DATETIME NOT NULL,

    INDEX `ContractAmendment_contractId_status_createdAt_idx`(`contractId`, `status`, `createdAt`),
    UNIQUE INDEX `ContractAmendment_contractId_amendmentNo_key`(`contractId`, `amendmentNo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE IF NOT EXISTS `ContractRenewal` (
    `id` VARCHAR(191) NOT NULL,
    `contractId` VARCHAR(191) NOT NULL,
    `renewalTypeCode` VARCHAR(60) NOT NULL,
    `status` VARCHAR(40) NOT NULL,
    `renewalDate` DATETIME NOT NULL,
    `outcome` VARCHAR(100) NULL,
    `renewedContractId` VARCHAR(191) NULL,
    `createdById` VARCHAR(191) NOT NULL,
    `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updatedAt` DATETIME NOT NULL,

    INDEX `ContractRenewal_renewalDate_status_idx`(`renewalDate`, `status`),
    INDEX `ContractRenewal_contractId_status_renewalDate_idx`(`contractId`, `status`, `renewalDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE IF NOT EXISTS `ContractRenewalReminder` (
    `id` VARCHAR(191) NOT NULL,
    `renewalId` VARCHAR(191) NOT NULL,
    `daysBefore` INTEGER NOT NULL,
    `dueAt` DATETIME NOT NULL,
    `status` VARCHAR(40) NOT NULL DEFAULT 'PENDING',
    `sentAt` DATETIME NULL,
    `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    INDEX `ContractRenewalReminder_status_dueAt_idx`(`status`, `dueAt`),
    UNIQUE INDEX `ContractRenewalReminder_renewalId_daysBefore_key`(`renewalId`, `daysBefore`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE IF NOT EXISTS `ContractPurchaseOrder` (
    `id` VARCHAR(191) NOT NULL,
    `contractId` VARCHAR(191) NOT NULL,
    `poNumber` VARCHAR(100) NOT NULL,
    `poDate` DATETIME NOT NULL,
    `currency` CHAR(3) NOT NULL,
    `amount` DECIMAL(19, 4) NOT NULL,
    `remainingAmount` DECIMAL(19, 4) NOT NULL,
    `documentVersionId` VARCHAR(191) NULL,
    `createdById` VARCHAR(191) NOT NULL,
    `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    INDEX `ContractPurchaseOrder_contractId_poDate_idx`(`contractId`, `poDate`),
    UNIQUE INDEX `ContractPurchaseOrder_contractId_poNumber_key`(`contractId`, `poNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE IF NOT EXISTS `ContractServiceOrder` (
    `id` VARCHAR(191) NOT NULL,
    `contractId` VARCHAR(191) NOT NULL,
    `contractVersionId` VARCHAR(191) NOT NULL,
    `orderNo` VARCHAR(60) NOT NULL,
    `modeCode` VARCHAR(40) NOT NULL DEFAULT 'MANUAL',
    `status` VARCHAR(40) NOT NULL,
    `prefillSnapshot` LONGTEXT NOT NULL,
    `createdById` VARCHAR(191) NOT NULL,
    `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updatedAt` DATETIME NOT NULL,

    UNIQUE INDEX `ContractServiceOrder_orderNo_key`(`orderNo`),
    INDEX `ContractServiceOrder_contractId_status_createdAt_idx`(`contractId`, `status`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE IF NOT EXISTS `ContractCommandReceipt` (
    `id` VARCHAR(191) NOT NULL,
    `actorId` VARCHAR(191) NOT NULL,
    `idempotencyKey` VARCHAR(191) NOT NULL,
    `command` VARCHAR(100) NOT NULL,
    `contractId` VARCHAR(191) NOT NULL,
    `resultVersion` INTEGER NOT NULL,
    `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    INDEX `ContractCommandReceipt_contractId_createdAt_idx`(`contractId`, `createdAt`),
    UNIQUE INDEX `ContractCommandReceipt_actorId_idempotencyKey_command_key`(`actorId`, `idempotencyKey`, `command`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE IF NOT EXISTS `ContractNumberSequence` (
    `id` VARCHAR(32) NOT NULL,
    `nextValue` INTEGER NOT NULL DEFAULT 0,
    `updatedAt` DATETIME NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Contract` ADD CONSTRAINT `Contract_contractTypeCode_fkey` FOREIGN KEY (`contractTypeCode`) REFERENCES `ContractTypeDefinition`(`code`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Contract` ADD CONSTRAINT `Contract_statusCode_fkey` FOREIGN KEY (`statusCode`) REFERENCES `ContractStatusDefinition`(`code`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ContractVersion` ADD CONSTRAINT `ContractVersion_contractId_fkey` FOREIGN KEY (`contractId`) REFERENCES `Contract`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ContractItem` ADD CONSTRAINT `ContractItem_contractVersionId_fkey` FOREIGN KEY (`contractVersionId`) REFERENCES `ContractVersion`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ContractReview` ADD CONSTRAINT `ContractReview_contractId_fkey` FOREIGN KEY (`contractId`) REFERENCES `Contract`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ContractReview` ADD CONSTRAINT `ContractReview_contractVersionId_fkey` FOREIGN KEY (`contractVersionId`) REFERENCES `ContractVersion`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ContractDocument` ADD CONSTRAINT `ContractDocument_contractId_fkey` FOREIGN KEY (`contractId`) REFERENCES `Contract`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ContractDocumentVersion` ADD CONSTRAINT `ContractDocumentVersion_documentId_fkey` FOREIGN KEY (`documentId`) REFERENCES `ContractDocument`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ContractSignature` ADD CONSTRAINT `ContractSignature_contractId_fkey` FOREIGN KEY (`contractId`) REFERENCES `Contract`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ContractSignature` ADD CONSTRAINT `ContractSignature_contractVersionId_fkey` FOREIGN KEY (`contractVersionId`) REFERENCES `ContractVersion`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ContractSignature` ADD CONSTRAINT `ContractSignature_documentVersionId_fkey` FOREIGN KEY (`documentVersionId`) REFERENCES `ContractDocumentVersion`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ContractAmendment` ADD CONSTRAINT `ContractAmendment_contractId_fkey` FOREIGN KEY (`contractId`) REFERENCES `Contract`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ContractRenewal` ADD CONSTRAINT `ContractRenewal_contractId_fkey` FOREIGN KEY (`contractId`) REFERENCES `Contract`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ContractRenewalReminder` ADD CONSTRAINT `ContractRenewalReminder_renewalId_fkey` FOREIGN KEY (`renewalId`) REFERENCES `ContractRenewal`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ContractPurchaseOrder` ADD CONSTRAINT `ContractPurchaseOrder_contractId_fkey` FOREIGN KEY (`contractId`) REFERENCES `Contract`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ContractPurchaseOrder` ADD CONSTRAINT `ContractPurchaseOrder_documentVersionId_fkey` FOREIGN KEY (`documentVersionId`) REFERENCES `ContractDocumentVersion`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ContractServiceOrder` ADD CONSTRAINT `ContractServiceOrder_contractId_fkey` FOREIGN KEY (`contractId`) REFERENCES `Contract`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ContractServiceOrder` ADD CONSTRAINT `ContractServiceOrder_contractVersionId_fkey` FOREIGN KEY (`contractVersionId`) REFERENCES `ContractVersion`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ContractCommandReceipt` ADD CONSTRAINT `ContractCommandReceipt_contractId_fkey` FOREIGN KEY (`contractId`) REFERENCES `Contract`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
