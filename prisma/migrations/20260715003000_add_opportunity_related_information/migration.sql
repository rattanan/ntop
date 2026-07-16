-- Additive MySQL 8 migration for Opportunity pain points, requirements,
-- stakeholders, competitors and idempotent command receipts.
CREATE TABLE `OpportunityPainPoint` (
  `id` VARCHAR(191) NOT NULL, `opportunityId` VARCHAR(191) NOT NULL, `category` VARCHAR(100) NOT NULL,
  `title` VARCHAR(255) NOT NULL, `currentSituation` TEXT NULL, `businessProblem` TEXT NOT NULL,
  `impact` TEXT NULL, `expectedOutcome` TEXT NULL, `priority` VARCHAR(32) NOT NULL DEFAULT 'MEDIUM',
  `status` VARCHAR(32) NOT NULL DEFAULT 'OPEN', `source` VARCHAR(100) NULL, `ownerId` VARCHAR(191) NOT NULL,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`), INDEX `OpportunityPainPoint_opportunity_status_priority_idx` (`opportunityId`,`status`,`priority`),
  INDEX `OpportunityPainPoint_owner_updated_idx` (`ownerId`,`updatedAt`),
  CONSTRAINT `OpportunityPainPoint_opportunityId_fkey` FOREIGN KEY (`opportunityId`) REFERENCES `Opportunity`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `OpportunityPainPoint_ownerId_fkey` FOREIGN KEY (`ownerId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `OpportunityRequirement` (
  `id` VARCHAR(191) NOT NULL, `opportunityId` VARCHAR(191) NOT NULL, `requirementNumber` VARCHAR(64) NOT NULL,
  `title` VARCHAR(255) NOT NULL, `description` TEXT NOT NULL, `requirementType` VARCHAR(100) NOT NULL,
  `priority` VARCHAR(32) NOT NULL DEFAULT 'MEDIUM', `mandatoryFlag` BOOLEAN NOT NULL DEFAULT false,
  `acceptanceCriteria` TEXT NULL, `sourceDocument` VARCHAR(500) NULL, `status` VARCHAR(32) NOT NULL DEFAULT 'OPEN',
  `assignedTeam` VARCHAR(100) NULL, `feasibilityStatus` VARCHAR(32) NOT NULL DEFAULT 'NOT_ASSESSED',
  `solutionResponse` TEXT NULL, `riskLevel` VARCHAR(32) NOT NULL DEFAULT 'MEDIUM',
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`), UNIQUE INDEX `OpportunityRequirement_opportunity_number_key` (`opportunityId`,`requirementNumber`),
  INDEX `OpportunityRequirement_opportunity_type_status_idx` (`opportunityId`,`requirementType`,`status`),
  CONSTRAINT `OpportunityRequirement_opportunityId_fkey` FOREIGN KEY (`opportunityId`) REFERENCES `Opportunity`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `OpportunityStakeholder` (
  `id` VARCHAR(191) NOT NULL, `opportunityId` VARCHAR(191) NOT NULL, `contactId` VARCHAR(191) NULL,
  `name` VARCHAR(255) NOT NULL, `organization` VARCHAR(255) NULL, `department` VARCHAR(191) NULL,
  `jobTitle` VARCHAR(191) NULL, `email` VARCHAR(255) NULL, `phone` VARCHAR(100) NULL,
  `stakeholderRole` VARCHAR(100) NOT NULL, `influenceLevel` VARCHAR(32) NOT NULL DEFAULT 'MEDIUM',
  `decisionPower` VARCHAR(32) NOT NULL DEFAULT 'MEDIUM', `relationshipStrength` VARCHAR(32) NOT NULL DEFAULT 'MEDIUM',
  `attitude` VARCHAR(32) NOT NULL DEFAULT 'NEUTRAL', `supportLevel` VARCHAR(32) NOT NULL DEFAULT 'NEUTRAL',
  `preferredCommunication` VARCHAR(100) NULL, `notes` TEXT NULL, `primaryContactFlag` BOOLEAN NOT NULL DEFAULT false,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`), INDEX `OpportunityStakeholder_opportunity_influence_support_idx` (`opportunityId`,`influenceLevel`,`supportLevel`),
  INDEX `OpportunityStakeholder_contactId_idx` (`contactId`),
  CONSTRAINT `OpportunityStakeholder_opportunityId_fkey` FOREIGN KEY (`opportunityId`) REFERENCES `Opportunity`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `OpportunityStakeholder_contactId_fkey` FOREIGN KEY (`contactId`) REFERENCES `Contact`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `OpportunityCompetitor` (
  `id` VARCHAR(191) NOT NULL, `opportunityId` VARCHAR(191) NOT NULL, `competitorName` VARCHAR(255) NOT NULL,
  `incumbentFlag` BOOLEAN NOT NULL DEFAULT false, `estimatedPrice` DECIMAL(19,4) NULL,
  `strengths` TEXT NULL, `weaknesses` TEXT NULL, `relationshipLevel` VARCHAR(32) NOT NULL DEFAULT 'UNKNOWN',
  `threatLevel` VARCHAR(32) NOT NULL DEFAULT 'MEDIUM', `likelySolution` TEXT NULL, `winStrategy` TEXT NULL,
  `differentiation` TEXT NULL, `notes` TEXT NULL, `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`), INDEX `OpportunityCompetitor_opportunity_threat_idx` (`opportunityId`,`threatLevel`),
  CONSTRAINT `OpportunityCompetitor_opportunityId_fkey` FOREIGN KEY (`opportunityId`) REFERENCES `Opportunity`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `OpportunityRelatedCommandReceipt` (
  `id` VARCHAR(191) NOT NULL, `actorId` VARCHAR(191) NOT NULL, `idempotencyKey` VARCHAR(191) NOT NULL,
  `command` VARCHAR(100) NOT NULL, `opportunityId` VARCHAR(191) NOT NULL, `resultId` VARCHAR(191) NOT NULL,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (`id`),
  UNIQUE INDEX `OpportunityRelatedReceipt_actor_key_command_key` (`actorId`,`idempotencyKey`,`command`),
  INDEX `OpportunityRelatedReceipt_opportunity_created_idx` (`opportunityId`,`createdAt`),
  CONSTRAINT `OpportunityRelatedReceipt_actorId_fkey` FOREIGN KEY (`actorId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `OpportunityRelatedReceipt_opportunityId_fkey` FOREIGN KEY (`opportunityId`) REFERENCES `Opportunity`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
