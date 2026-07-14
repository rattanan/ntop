-- Phase 1 Lead Management: additive, backward-compatible expansion.
ALTER TABLE `Lead`
  MODIFY `source` ENUM('IMPORT','WEBSITE','EVENT','PARTNER','REFERRAL','EXISTING_CUSTOMER','MARKETING_CAMPAIGN','API','GOVERNMENT_TENDER') NOT NULL,
  MODIFY `status` ENUM('NEW','ASSIGNED','CONTACTED','QUALIFIED','NURTURING','CONVERTED','DISQUALIFIED','ARCHIVED') NOT NULL DEFAULT 'NEW',
  ADD COLUMN `leadNumber` VARCHAR(32) NULL,
  ADD COLUMN `leadType` ENUM('CORPORATE','GOVERNMENT','SME','PARTNER') NOT NULL DEFAULT 'CORPORATE',
  ADD COLUMN `taxId` VARCHAR(32) NULL,
  ADD COLUMN `branchNumber` VARCHAR(20) NULL,
  ADD COLUMN `industry` VARCHAR(191) NULL,
  ADD COLUMN `website` VARCHAR(500) NULL,
  ADD COLUMN `contactFirstName` VARCHAR(191) NULL,
  ADD COLUMN `contactLastName` VARCHAR(191) NULL,
  ADD COLUMN `jobTitle` VARCHAR(191) NULL,
  ADD COLUMN `department` VARCHAR(191) NULL,
  ADD COLUMN `priority` ENUM('LOW','MEDIUM','HIGH','URGENT') NOT NULL DEFAULT 'MEDIUM',
  ADD COLUMN `temperature` ENUM('COLD','WARM','HOT') NOT NULL DEFAULT 'COLD',
  ADD COLUMN `scoreBreakdown` JSON NULL,
  ADD COLUMN `requirementSummary` TEXT NULL,
  ADD COLUMN `estimatedBudget` DECIMAL(19,4) NULL,
  ADD COLUMN `expectedPurchaseAt` DATETIME(3) NULL,
  ADD COLUMN `numberOfSites` INTEGER NULL,
  ADD COLUMN `serviceLocations` TEXT NULL,
  ADD COLUMN `qualificationData` JSON NULL,
  ADD COLUMN `qualificationResult` TEXT NULL,
  ADD COLUMN `disqualificationReason` VARCHAR(1000) NULL,
  ADD COLUMN `assignedAt` DATETIME(3) NULL,
  ADD COLUMN `firstContactDueAt` DATETIME(3) NULL,
  ADD COLUMN `lastContactedAt` DATETIME(3) NULL,
  ADD COLUMN `nextFollowUpAt` DATETIME(3) NULL,
  ADD COLUMN `convertedAt` DATETIME(3) NULL,
  ADD COLUMN `archivedAt` DATETIME(3) NULL;

ALTER TABLE `Lead`
  ADD COLUMN `organizationUnitId` VARCHAR(191) NULL,
  ADD COLUMN `contactId` VARCHAR(191) NULL,
  ADD COLUMN `campaignId` VARCHAR(191) NULL;
ALTER TABLE `Lead` ADD COLUMN `mergedIntoLeadId` VARCHAR(191) NULL;
ALTER TABLE `LeadCommandReceipt`
  ADD COLUMN `contactId` VARCHAR(191) NULL,
  ADD COLUMN `opportunityId` VARCHAR(191) NULL;
ALTER TABLE `LeadCommandReceipt` ADD COLUMN `resultLeadId` VARCHAR(191) NULL;

CREATE UNIQUE INDEX `Lead_leadNumber_key` ON `Lead`(`leadNumber`);
CREATE INDEX `Lead_temperature_score_updatedAt_idx` ON `Lead`(`temperature`, `score`, `updatedAt`);
CREATE INDEX `Lead_nextFollowUpAt_status_idx` ON `Lead`(`nextFollowUpAt`, `status`);
CREATE INDEX `Lead_firstContactDueAt_status_idx` ON `Lead`(`firstContactDueAt`, `status`);
CREATE INDEX `Lead_taxId_idx` ON `Lead`(`taxId`);
CREATE INDEX `Lead_organizationUnitId_ownerId_status_idx` ON `Lead`(`organizationUnitId`,`ownerId`,`status`);
ALTER TABLE `Lead` ADD CONSTRAINT `Lead_organizationUnitId_fkey` FOREIGN KEY (`organizationUnitId`) REFERENCES `OrganizationUnit`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `Lead` ADD CONSTRAINT `Lead_contactId_fkey` FOREIGN KEY (`contactId`) REFERENCES `Contact`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `Lead` ADD CONSTRAINT `Lead_mergedIntoLeadId_fkey` FOREIGN KEY (`mergedIntoLeadId`) REFERENCES `Lead`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX `Lead_campaignId_status_idx` ON `Lead`(`campaignId`,`status`);
CREATE TABLE `Campaign` (`id` VARCHAR(191) NOT NULL, `code` VARCHAR(100) NOT NULL, `name` VARCHAR(255) NOT NULL, `source` VARCHAR(100) NOT NULL, `active` BOOLEAN NOT NULL DEFAULT true, `startsAt` DATETIME(3) NULL, `endsAt` DATETIME(3) NULL, `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), `updatedAt` DATETIME(3) NOT NULL, PRIMARY KEY (`id`), UNIQUE INDEX `Campaign_code_key` (`code`)) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE `Lead` ADD CONSTRAINT `Lead_campaignId_fkey` FOREIGN KEY (`campaignId`) REFERENCES `Campaign`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
CREATE TABLE `LeadNumberSequence` (`id` VARCHAR(32) NOT NULL, `nextValue` INTEGER NOT NULL DEFAULT 0, `updatedAt` DATETIME(3) NOT NULL, PRIMARY KEY (`id`)) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `LeadStatusHistory` (
  `id` VARCHAR(191) NOT NULL, `leadId` VARCHAR(191) NOT NULL,
  `fromStatus` ENUM('NEW','ASSIGNED','CONTACTED','QUALIFIED','NURTURING','CONVERTED','DISQUALIFIED','ARCHIVED') NOT NULL,
  `toStatus` ENUM('NEW','ASSIGNED','CONTACTED','QUALIFIED','NURTURING','CONVERTED','DISQUALIFIED','ARCHIVED') NOT NULL,
  `reason` VARCHAR(1000) NULL, `actorId` VARCHAR(191) NOT NULL,
  `correlationId` VARCHAR(191) NOT NULL, `transitionedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`), INDEX `LeadStatusHistory_leadId_transitionedAt_idx` (`leadId`,`transitionedAt`),
  CONSTRAINT `LeadStatusHistory_leadId_fkey` FOREIGN KEY (`leadId`) REFERENCES `Lead`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `LeadStatusHistory_actorId_fkey` FOREIGN KEY (`actorId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `LeadAssignmentHistory` (
  `id` VARCHAR(191) NOT NULL, `leadId` VARCHAR(191) NOT NULL, `fromOwnerId` VARCHAR(191) NULL,
  `toOwnerId` VARCHAR(191) NOT NULL, `reason` VARCHAR(1000) NULL, `actorId` VARCHAR(191) NOT NULL,
  `assignedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), PRIMARY KEY (`id`),
  INDEX `LeadAssignmentHistory_leadId_assignedAt_idx` (`leadId`,`assignedAt`),
  CONSTRAINT `LeadAssignmentHistory_leadId_fkey` FOREIGN KEY (`leadId`) REFERENCES `Lead`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `LeadAssignmentHistory_actorId_fkey` FOREIGN KEY (`actorId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `Activity` ADD COLUMN `leadId` VARCHAR(191) NULL;
ALTER TABLE `Activity` MODIFY `type` ENUM('CALL','EMAIL','MEETING','SITE_VISIT','ONLINE_MEETING','NOTE','FOLLOW_UP','TASK','DOCUMENT_REQUEST') NOT NULL;
CREATE INDEX `Activity_leadId_createdAt_idx` ON `Activity`(`leadId`,`createdAt`);
ALTER TABLE `Activity` ADD CONSTRAINT `Activity_leadId_fkey` FOREIGN KEY (`leadId`) REFERENCES `Lead`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `Opportunity` ADD COLUMN `sourceLeadId` VARCHAR(191) NULL;
CREATE UNIQUE INDEX `Opportunity_sourceLeadId_key` ON `Opportunity`(`sourceLeadId`);
ALTER TABLE `Opportunity` ADD CONSTRAINT `Opportunity_sourceLeadId_fkey` FOREIGN KEY (`sourceLeadId`) REFERENCES `Lead`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
