-- MariaDB 5.5 compatibility companion for 20260714170000_expand_lead_management.
-- JSON columns from the MySQL 8 migration are represented as LONGTEXT.
ALTER TABLE `Lead`
  MODIFY `source` ENUM('IMPORT','WEBSITE','EVENT','PARTNER','REFERRAL','EXISTING_CUSTOMER','MARKETING_CAMPAIGN','API','GOVERNMENT_TENDER') NOT NULL,
  MODIFY `status` ENUM('NEW','ASSIGNED','CONTACTED','QUALIFIED','NURTURING','CONVERTED','DISQUALIFIED','ARCHIVED') NOT NULL DEFAULT 'NEW',
  ADD COLUMN `leadNumber` VARCHAR(32) NULL, ADD COLUMN `leadType` ENUM('CORPORATE','GOVERNMENT','SME','PARTNER') NOT NULL DEFAULT 'CORPORATE',
  ADD COLUMN `taxId` VARCHAR(32) NULL, ADD COLUMN `branchNumber` VARCHAR(20) NULL, ADD COLUMN `industry` VARCHAR(191) NULL,
  ADD COLUMN `website` VARCHAR(500) NULL, ADD COLUMN `contactFirstName` VARCHAR(191) NULL, ADD COLUMN `contactLastName` VARCHAR(191) NULL,
  ADD COLUMN `jobTitle` VARCHAR(191) NULL, ADD COLUMN `department` VARCHAR(191) NULL,
  ADD COLUMN `priority` ENUM('LOW','MEDIUM','HIGH','URGENT') NOT NULL DEFAULT 'MEDIUM',
  ADD COLUMN `temperature` ENUM('COLD','WARM','HOT') NOT NULL DEFAULT 'COLD', ADD COLUMN `scoreBreakdown` LONGTEXT NULL,
  ADD COLUMN `requirementSummary` LONGTEXT NULL, ADD COLUMN `estimatedBudget` DECIMAL(19,4) NULL,
  ADD COLUMN `expectedPurchaseAt` DATETIME NULL, ADD COLUMN `numberOfSites` INTEGER NULL, ADD COLUMN `serviceLocations` LONGTEXT NULL,
  ADD COLUMN `qualificationData` LONGTEXT NULL, ADD COLUMN `qualificationResult` LONGTEXT NULL,
  ADD COLUMN `disqualificationReason` VARCHAR(1000) NULL, ADD COLUMN `assignedAt` DATETIME NULL, ADD COLUMN `firstContactDueAt` DATETIME NULL,
  ADD COLUMN `lastContactedAt` DATETIME NULL, ADD COLUMN `nextFollowUpAt` DATETIME NULL,
  ADD COLUMN `convertedAt` DATETIME NULL, ADD COLUMN `archivedAt` DATETIME NULL,
  ADD COLUMN `organizationUnitId` VARCHAR(191) NULL, ADD COLUMN `contactId` VARCHAR(191) NULL, ADD COLUMN `campaignId` VARCHAR(191) NULL, ADD COLUMN `mergedIntoLeadId` VARCHAR(191) NULL;

ALTER TABLE `LeadCommandReceipt` ADD COLUMN `contactId` VARCHAR(191) NULL, ADD COLUMN `opportunityId` VARCHAR(191) NULL, ADD COLUMN `resultLeadId` VARCHAR(191) NULL;

CREATE UNIQUE INDEX `Lead_leadNumber_key` ON `Lead`(`leadNumber`);
CREATE INDEX `Lead_temperature_score_updatedAt_idx` ON `Lead`(`temperature`,`score`,`updatedAt`);
CREATE INDEX `Lead_nextFollowUpAt_status_idx` ON `Lead`(`nextFollowUpAt`,`status`);
CREATE INDEX `Lead_firstContactDueAt_status_idx` ON `Lead`(`firstContactDueAt`,`status`);
CREATE INDEX `Lead_taxId_idx` ON `Lead`(`taxId`);
CREATE INDEX `Lead_organizationUnitId_ownerId_status_idx` ON `Lead`(`organizationUnitId`,`ownerId`,`status`);
ALTER TABLE `Lead` ADD CONSTRAINT `Lead_organizationUnitId_fkey` FOREIGN KEY (`organizationUnitId`) REFERENCES `OrganizationUnit`(`id`) ON DELETE SET NULL;
ALTER TABLE `Lead` ADD CONSTRAINT `Lead_contactId_fkey` FOREIGN KEY (`contactId`) REFERENCES `Contact`(`id`) ON DELETE SET NULL;
ALTER TABLE `Lead` ADD CONSTRAINT `Lead_mergedIntoLeadId_fkey` FOREIGN KEY (`mergedIntoLeadId`) REFERENCES `Lead`(`id`) ON DELETE SET NULL;
CREATE TABLE `Campaign` (`id` VARCHAR(191) NOT NULL, `code` VARCHAR(100) NOT NULL, `name` VARCHAR(255) NOT NULL, `source` VARCHAR(100) NOT NULL, `active` TINYINT(1) NOT NULL DEFAULT 1, `startsAt` DATETIME NULL, `endsAt` DATETIME NULL, `createdAt` DATETIME NOT NULL, `updatedAt` DATETIME NOT NULL, PRIMARY KEY (`id`), UNIQUE INDEX `Campaign_code_key` (`code`)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE INDEX `Lead_campaignId_status_idx` ON `Lead`(`campaignId`,`status`);
ALTER TABLE `Lead` ADD CONSTRAINT `Lead_campaignId_fkey` FOREIGN KEY (`campaignId`) REFERENCES `Campaign`(`id`) ON DELETE SET NULL;
CREATE TABLE `LeadNumberSequence` (`id` VARCHAR(32) NOT NULL, `nextValue` INTEGER NOT NULL DEFAULT 0, `updatedAt` DATETIME NOT NULL, PRIMARY KEY (`id`)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `LeadStatusHistory` (`id` VARCHAR(191) NOT NULL, `leadId` VARCHAR(191) NOT NULL, `fromStatus` ENUM('NEW','ASSIGNED','CONTACTED','QUALIFIED','NURTURING','CONVERTED','DISQUALIFIED','ARCHIVED') NOT NULL, `toStatus` ENUM('NEW','ASSIGNED','CONTACTED','QUALIFIED','NURTURING','CONVERTED','DISQUALIFIED','ARCHIVED') NOT NULL, `reason` VARCHAR(1000), `actorId` VARCHAR(191) NOT NULL, `correlationId` VARCHAR(191) NOT NULL, `transitionedAt` DATETIME NOT NULL, PRIMARY KEY (`id`), INDEX `LeadStatusHistory_leadId_transitionedAt_idx` (`leadId`,`transitionedAt`), CONSTRAINT `LeadStatusHistory_leadId_fkey` FOREIGN KEY (`leadId`) REFERENCES `Lead`(`id`), CONSTRAINT `LeadStatusHistory_actorId_fkey` FOREIGN KEY (`actorId`) REFERENCES `User`(`id`)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE `LeadAssignmentHistory` (`id` VARCHAR(191) NOT NULL, `leadId` VARCHAR(191) NOT NULL, `fromOwnerId` VARCHAR(191), `toOwnerId` VARCHAR(191) NOT NULL, `reason` VARCHAR(1000), `actorId` VARCHAR(191) NOT NULL, `assignedAt` DATETIME NOT NULL, PRIMARY KEY (`id`), INDEX `LeadAssignmentHistory_leadId_assignedAt_idx` (`leadId`,`assignedAt`), CONSTRAINT `LeadAssignmentHistory_leadId_fkey` FOREIGN KEY (`leadId`) REFERENCES `Lead`(`id`), CONSTRAINT `LeadAssignmentHistory_actorId_fkey` FOREIGN KEY (`actorId`) REFERENCES `User`(`id`)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
ALTER TABLE `Activity` ADD COLUMN `leadId` VARCHAR(191) NULL, ADD INDEX `Activity_leadId_createdAt_idx` (`leadId`,`createdAt`), ADD CONSTRAINT `Activity_leadId_fkey` FOREIGN KEY (`leadId`) REFERENCES `Lead`(`id`) ON DELETE SET NULL;
ALTER TABLE `Activity` MODIFY `type` ENUM('CALL','EMAIL','MEETING','SITE_VISIT','ONLINE_MEETING','NOTE','FOLLOW_UP','TASK','DOCUMENT_REQUEST') NOT NULL;
ALTER TABLE `Opportunity` ADD COLUMN `sourceLeadId` VARCHAR(191) NULL, ADD UNIQUE INDEX `Opportunity_sourceLeadId_key` (`sourceLeadId`), ADD CONSTRAINT `Opportunity_sourceLeadId_fkey` FOREIGN KEY (`sourceLeadId`) REFERENCES `Lead`(`id`) ON DELETE SET NULL;
