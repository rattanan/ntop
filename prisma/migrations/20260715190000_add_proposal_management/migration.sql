-- Proposal & Quotation Phase 1 MVP. Expand-only MySQL 8 migration.

CREATE TABLE IF NOT EXISTS `ProposalStatusDefinition` (
  `code` VARCHAR(32) NOT NULL,
  `label` VARCHAR(100) NOT NULL,
  `sortOrder` INTEGER NOT NULL,
  `terminal` BOOLEAN NOT NULL DEFAULT false,
  `active` BOOLEAN NOT NULL DEFAULT true,
  `reportingCategory` VARCHAR(32) NOT NULL DEFAULT 'OPEN',
  `allowedTransitions` LONGTEXT NOT NULL,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` DATETIME NOT NULL,
  INDEX `ProposalStatusDefinition_active_sortOrder_idx` (`active`, `sortOrder`),
  PRIMARY KEY (`code`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;

INSERT IGNORE INTO `ProposalStatusDefinition`
  (`code`, `label`, `sortOrder`, `terminal`, `active`, `reportingCategory`, `allowedTransitions`, `updatedAt`)
VALUES
  ('DRAFT', 'Draft', 10, false, true, 'DRAFT', '["PENDING_REVIEW","CANCELLED"]', CURRENT_TIMESTAMP),
  ('PENDING_REVIEW', 'Pending Review — Manager', 20, false, true, 'REVIEW', '["PENDING_DIRECTOR","REJECTED","DRAFT","CANCELLED"]', CURRENT_TIMESTAMP),
  ('PENDING_DIRECTOR', 'Pending Review — Director', 25, false, true, 'REVIEW', '["APPROVED","REJECTED","DRAFT","CANCELLED"]', CURRENT_TIMESTAMP),
  ('APPROVED', 'Approved', 30, false, true, 'APPROVED', '["SENT","CANCELLED"]', CURRENT_TIMESTAMP),
  ('REJECTED', 'Rejected', 40, false, true, 'REJECTED', '["DRAFT","CANCELLED"]', CURRENT_TIMESTAMP),
  ('SENT', 'Sent', 50, false, true, 'SENT', '["ACCEPTED","REJECTED","EXPIRED","CANCELLED"]', CURRENT_TIMESTAMP),
  ('ACCEPTED', 'Accepted', 60, true, true, 'ACCEPTED', '[]', CURRENT_TIMESTAMP),
  ('EXPIRED', 'Expired', 70, true, true, 'EXPIRED', '[]', CURRENT_TIMESTAMP),
  ('CANCELLED', 'Cancelled', 80, true, true, 'CANCELLED', '[]', CURRENT_TIMESTAMP);

CREATE TABLE IF NOT EXISTS `ProposalStatusTransition` (
  `id` VARCHAR(191) NOT NULL,
  `fromStatusCode` VARCHAR(32) NOT NULL,
  `toStatusCode` VARCHAR(32) NOT NULL,
  `requiredPermission` VARCHAR(191) NULL,
  `makerChecker` BOOLEAN NOT NULL DEFAULT false,
  `active` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE INDEX `ProposalStatusTransition_fromStatusCode_toStatusCode_key` (`fromStatusCode`, `toStatusCode`),
  INDEX `ProposalStatusTransition_fromStatusCode_active_idx` (`fromStatusCode`, `active`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;

INSERT IGNORE INTO `ProposalStatusTransition` (`id`,`fromStatusCode`,`toStatusCode`,`requiredPermission`,`makerChecker`) VALUES
  ('proposal-transition-draft-review','DRAFT','PENDING_REVIEW',NULL,false),
  ('proposal-transition-draft-cancel','DRAFT','CANCELLED',NULL,false),
  ('proposal-transition-manager-director','PENDING_REVIEW','PENDING_DIRECTOR','proposal.review.manager',true),
  ('proposal-transition-manager-reject','PENDING_REVIEW','REJECTED','proposal.review.manager',true),
  ('proposal-transition-manager-revise','PENDING_REVIEW','DRAFT','proposal.review.manager',true),
  ('proposal-transition-manager-cancel','PENDING_REVIEW','CANCELLED',NULL,false),
  ('proposal-transition-director-approve','PENDING_DIRECTOR','APPROVED','proposal.approve.director',true),
  ('proposal-transition-director-reject','PENDING_DIRECTOR','REJECTED','proposal.approve.director',true),
  ('proposal-transition-director-revise','PENDING_DIRECTOR','DRAFT','proposal.approve.director',true),
  ('proposal-transition-director-cancel','PENDING_DIRECTOR','CANCELLED',NULL,false),
  ('proposal-transition-approved-sent','APPROVED','SENT',NULL,false),
  ('proposal-transition-approved-cancel','APPROVED','CANCELLED',NULL,false),
  ('proposal-transition-rejected-draft','REJECTED','DRAFT',NULL,false),
  ('proposal-transition-rejected-cancel','REJECTED','CANCELLED',NULL,false),
  ('proposal-transition-sent-accepted','SENT','ACCEPTED',NULL,false),
  ('proposal-transition-sent-rejected','SENT','REJECTED',NULL,false),
  ('proposal-transition-sent-expired','SENT','EXPIRED',NULL,false),
  ('proposal-transition-sent-cancel','SENT','CANCELLED',NULL,false);

CREATE TABLE IF NOT EXISTS `ProposalNumberSequence` (
  `id` VARCHAR(32) NOT NULL,
  `nextValue` INTEGER NOT NULL DEFAULT 0,
  `updatedAt` DATETIME NOT NULL,
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `ProposalTemplate` (
  `id` VARCHAR(191) NOT NULL,
  `code` VARCHAR(100) NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `category` VARCHAR(100) NOT NULL,
  `active` BOOLEAN NOT NULL DEFAULT true,
  `activeVersionId` VARCHAR(191) NULL,
  `createdById` VARCHAR(191) NOT NULL,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` DATETIME NOT NULL,
  UNIQUE INDEX `ProposalTemplate_code_key` (`code`),
  UNIQUE INDEX `ProposalTemplate_activeVersionId_key` (`activeVersionId`),
  INDEX `ProposalTemplate_active_category_name_idx` (`active`, `category`, `name`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `ProposalTemplateVersion` (
  `id` VARCHAR(191) NOT NULL,
  `templateId` VARCHAR(191) NOT NULL,
  `version` INTEGER NOT NULL,
  `companyInformation` TEXT NULL,
  `terms` TEXT NULL,
  `footer` TEXT NULL,
  `createdById` VARCHAR(191) NOT NULL,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE INDEX `ProposalTemplateVersion_templateId_version_key` (`templateId`, `version`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `ProposalTemplateSection` (
  `id` VARCHAR(191) NOT NULL,
  `templateVersionId` VARCHAR(191) NOT NULL,
  `sectionCode` VARCHAR(100) NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `sortOrder` INTEGER NOT NULL,
  `contentType` VARCHAR(32) NOT NULL DEFAULT 'RICH_TEXT',
  `defaultContent` TEXT NOT NULL,
  `structuredData` LONGTEXT NULL,
  UNIQUE INDEX `ProposalTemplateSection_templateVersionId_sectionCode_key` (`templateVersionId`, `sectionCode`),
  INDEX `ProposalTemplateSection_templateVersionId_sortOrder_idx` (`templateVersionId`, `sortOrder`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `Proposal` (
  `id` VARCHAR(191) NOT NULL,
  `proposalNo` VARCHAR(32) NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `opportunityId` VARCHAR(191) NOT NULL,
  `customerId` VARCHAR(191) NOT NULL,
  `ownerId` VARCHAR(191) NOT NULL,
  `version` INTEGER NOT NULL DEFAULT 1,
  `statusCode` VARCHAR(32) NOT NULL,
  `createDate` DATETIME NOT NULL,
  `expireDate` DATETIME NULL,
  `description` TEXT NULL,
  `tags` LONGTEXT NULL,
  `deletedAt` DATETIME NULL,
  `deletedById` VARCHAR(191) NULL,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` DATETIME NOT NULL,
  UNIQUE INDEX `Proposal_proposalNo_key` (`proposalNo`),
  INDEX `Proposal_ownerId_statusCode_updatedAt_idx` (`ownerId`, `statusCode`, `updatedAt`),
  INDEX `Proposal_opportunityId_deletedAt_updatedAt_idx` (`opportunityId`, `deletedAt`, `updatedAt`),
  INDEX `Proposal_customerId_deletedAt_updatedAt_idx` (`customerId`, `deletedAt`, `updatedAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `ProposalVersion` (
  `id` VARCHAR(191) NOT NULL,
  `proposalId` VARCHAR(191) NOT NULL,
  `versionNumber` INTEGER NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `statusCode` VARCHAR(32) NOT NULL,
  `description` TEXT NULL,
  `expireDate` DATETIME NULL,
  `tags` LONGTEXT NULL,
  `templateVersionId` VARCHAR(191) NULL,
  `restoredFromVersionId` VARCHAR(191) NULL,
  `aiProviderConfigurationVersionId` VARCHAR(191) NULL,
  `aiProviderModel` VARCHAR(255) NULL,
  `aiPromptTemplateVersion` VARCHAR(100) NULL,
  `aiInputSourceReferences` LONGTEXT NULL,
  `createdById` VARCHAR(191) NOT NULL,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE INDEX `ProposalVersion_proposalId_versionNumber_key` (`proposalId`, `versionNumber`),
  INDEX `ProposalVersion_proposalId_createdAt_idx` (`proposalId`, `createdAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `ProposalSection` (
  `id` VARCHAR(191) NOT NULL,
  `proposalVersionId` VARCHAR(191) NOT NULL,
  `sectionCode` VARCHAR(100) NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `sortOrder` INTEGER NOT NULL,
  `contentType` VARCHAR(32) NOT NULL DEFAULT 'RICH_TEXT',
  `content` TEXT NOT NULL,
  `structuredData` LONGTEXT NULL,
  UNIQUE INDEX `ProposalSection_proposalVersionId_sectionCode_key` (`proposalVersionId`, `sectionCode`),
  INDEX `ProposalSection_proposalVersionId_sortOrder_idx` (`proposalVersionId`, `sortOrder`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `ProposalCommandReceipt` (
  `id` VARCHAR(191) NOT NULL,
  `actorId` VARCHAR(191) NOT NULL,
  `idempotencyKey` VARCHAR(191) NOT NULL,
  `command` VARCHAR(100) NOT NULL,
  `proposalId` VARCHAR(191) NOT NULL,
  `resultVersion` INTEGER NOT NULL,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE INDEX `ProposalCommandReceipt_actorId_idempotencyKey_command_key` (`actorId`, `idempotencyKey`, `command`),
  INDEX `ProposalCommandReceipt_proposalId_createdAt_idx` (`proposalId`, `createdAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;

ALTER TABLE `Quote` ADD COLUMN `proposalId` VARCHAR(191) NULL;
CREATE INDEX `Quote_proposalId_createdAt_idx` ON `Quote` (`proposalId`, `createdAt`);

ALTER TABLE `ProposalTemplate` ADD CONSTRAINT `ProposalTemplate_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `ProposalTemplateVersion` ADD CONSTRAINT `ProposalTemplateVersion_templateId_fkey` FOREIGN KEY (`templateId`) REFERENCES `ProposalTemplate`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `ProposalTemplateVersion` ADD CONSTRAINT `ProposalTemplateVersion_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `ProposalTemplate` ADD CONSTRAINT `ProposalTemplate_activeVersionId_fkey` FOREIGN KEY (`activeVersionId`) REFERENCES `ProposalTemplateVersion`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `ProposalTemplateSection` ADD CONSTRAINT `ProposalTemplateSection_templateVersionId_fkey` FOREIGN KEY (`templateVersionId`) REFERENCES `ProposalTemplateVersion`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `Proposal` ADD CONSTRAINT `Proposal_opportunityId_fkey` FOREIGN KEY (`opportunityId`) REFERENCES `Opportunity`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `Proposal` ADD CONSTRAINT `Proposal_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `Customer`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `Proposal` ADD CONSTRAINT `Proposal_ownerId_fkey` FOREIGN KEY (`ownerId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `Proposal` ADD CONSTRAINT `Proposal_statusCode_fkey` FOREIGN KEY (`statusCode`) REFERENCES `ProposalStatusDefinition`(`code`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `ProposalVersion` ADD CONSTRAINT `ProposalVersion_proposalId_fkey` FOREIGN KEY (`proposalId`) REFERENCES `Proposal`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `ProposalVersion` ADD CONSTRAINT `ProposalVersion_templateVersionId_fkey` FOREIGN KEY (`templateVersionId`) REFERENCES `ProposalTemplateVersion`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `ProposalVersion` ADD CONSTRAINT `ProposalVersion_restoredFromVersionId_fkey` FOREIGN KEY (`restoredFromVersionId`) REFERENCES `ProposalVersion`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `ProposalVersion` ADD CONSTRAINT `ProposalVersion_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `ProposalSection` ADD CONSTRAINT `ProposalSection_proposalVersionId_fkey` FOREIGN KEY (`proposalVersionId`) REFERENCES `ProposalVersion`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `ProposalCommandReceipt` ADD CONSTRAINT `ProposalCommandReceipt_actorId_fkey` FOREIGN KEY (`actorId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `ProposalCommandReceipt` ADD CONSTRAINT `ProposalCommandReceipt_proposalId_fkey` FOREIGN KEY (`proposalId`) REFERENCES `Proposal`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `Quote` ADD CONSTRAINT `Quote_proposalId_fkey` FOREIGN KEY (`proposalId`) REFERENCES `Proposal`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
