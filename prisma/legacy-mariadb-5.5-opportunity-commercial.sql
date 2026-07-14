-- MariaDB 5.5 compatibility migration for Opportunity, Pipeline/Forecast,
-- immutable Quote Versions, and configurable Approval.
-- JSON values use LONGTEXT. Exact composite uniqueness uses SHA-256 columns
-- because legacy InnoDB has a 767-byte index limit under utf8mb4.

ALTER TABLE `Opportunity`
  MODIFY `stage` ENUM('QUALIFY','DISCOVER','SOLUTION','PROPOSAL','NEGOTIATION','WON','LOST','CANCELLED') NOT NULL DEFAULT 'QUALIFY',
  MODIFY `estimatedValue` DECIMAL(19,4) NOT NULL,
  ADD COLUMN `version` INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN `currency` CHAR(3) NOT NULL DEFAULT 'THB',
  ADD COLUMN `forecastCategory` ENUM('COMMIT','BEST_CASE','PIPELINE','OMITTED') NOT NULL DEFAULT 'PIPELINE',
  ADD COLUMN `stageEnteredAt` DATETIME NULL,
  ADD COLUMN `organizationUnitId` VARCHAR(191) NULL,
  ADD COLUMN `qualificationResult` TEXT NULL,
  ADD COLUMN `stakeholderSummary` TEXT NULL,
  ADD COLUMN `lostReason` VARCHAR(1000) NULL,
  ADD COLUMN `lostCategory` VARCHAR(100) NULL,
  ADD COLUMN `cancelledReason` VARCHAR(1000) NULL,
  ADD COLUMN `primaryQuoteId` VARCHAR(191) NULL,
  ADD UNIQUE KEY `Opportunity_primaryQuoteId_key` (`primaryQuoteId`),
  ADD KEY `Opportunity_org_owner_stage_close_idx` (`organizationUnitId`(40),`ownerId`(40),`stage`,`expectedCloseAt`),
  ADD KEY `Opportunity_owner_updated_id_idx` (`ownerId`(80),`updatedAt`,`id`(80));

UPDATE `Opportunity` o JOIN `Customer` c ON c.`id`=o.`customerId`
SET o.`organizationUnitId`=c.`organizationUnitId`, o.`stageEnteredAt`=o.`createdAt`;
ALTER TABLE `Opportunity` MODIFY `stageEnteredAt` DATETIME NOT NULL;
ALTER TABLE `Opportunity`
  ADD CONSTRAINT `Opportunity_organizationUnitId_fkey` FOREIGN KEY (`organizationUnitId`) REFERENCES `OrganizationUnit`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `Opportunity_primaryQuoteId_fkey` FOREIGN KEY (`primaryQuoteId`) REFERENCES `Quote`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `Product`
  ADD COLUMN `standardCost` DECIMAL(19,4) NULL,
  ADD COLUMN `costConfirmedAt` DATETIME NULL;

ALTER TABLE `Quote`
  ADD COLUMN `version` INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN `makerId` VARCHAR(191) NULL,
  ADD KEY `Quote_makerId_idx` (`makerId`),
  ADD CONSTRAINT `Quote_makerId_fkey` FOREIGN KEY (`makerId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

UPDATE `Quote` q LEFT JOIN `Opportunity` o ON o.`id`=q.`opportunityId` LEFT JOIN `Customer` c ON c.`id`=q.`customerId`
SET q.`makerId`=COALESCE(o.`ownerId`,c.`ownerId`) WHERE q.`makerId` IS NULL;
UPDATE `Opportunity` o SET o.`primaryQuoteId`=(SELECT q.`id` FROM `Quote` q WHERE q.`opportunityId`=o.`id` ORDER BY q.`createdAt`,q.`id` LIMIT 1)
WHERE o.`primaryQuoteId` IS NULL AND EXISTS (SELECT 1 FROM `Quote` q2 WHERE q2.`opportunityId`=o.`id`);

CREATE TABLE `OpportunityTransitionPolicyVersion` (
  `id` VARCHAR(191) NOT NULL, `policyCode` VARCHAR(100) NOT NULL, `version` INTEGER NOT NULL,
  `command` VARCHAR(32) NOT NULL, `fromStage` ENUM('QUALIFY','DISCOVER','SOLUTION','PROPOSAL','NEGOTIATION','WON','LOST','CANCELLED') NOT NULL,
  `toStage` ENUM('QUALIFY','DISCOVER','SOLUTION','PROPOSAL','NEGOTIATION','WON','LOST','CANCELLED') NOT NULL,
  `requiredFields` LONGTEXT NOT NULL, `requiredPermission` VARCHAR(191) NOT NULL, `active` TINYINT(1) NOT NULL DEFAULT 1,
  `effectiveFrom` DATETIME NOT NULL, `effectiveTo` DATETIME NULL, `createdAt` DATETIME NOT NULL,
  PRIMARY KEY (`id`), UNIQUE KEY `OTP_code_version_key` (`policyCode`,`version`),
  KEY `OTP_route_idx` (`fromStage`,`toStage`,`command`,`active`,`effectiveFrom`,`effectiveTo`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `OpportunityStageHistory` (
  `id` VARCHAR(191) NOT NULL, `opportunityId` VARCHAR(191) NOT NULL,
  `fromStage` ENUM('QUALIFY','DISCOVER','SOLUTION','PROPOSAL','NEGOTIATION','WON','LOST','CANCELLED') NOT NULL,
  `toStage` ENUM('QUALIFY','DISCOVER','SOLUTION','PROPOSAL','NEGOTIATION','WON','LOST','CANCELLED') NOT NULL,
  `command` VARCHAR(32) NOT NULL, `reason` VARCHAR(1000) NULL, `actorId` VARCHAR(191) NOT NULL,
  `policyVersionId` VARCHAR(191) NOT NULL, `evidenceSnapshot` LONGTEXT NOT NULL, `aggregateVersion` INTEGER NOT NULL,
  `correlationId` VARCHAR(191) NOT NULL, `transitionedAt` DATETIME NOT NULL, `historyHash` CHAR(64) NOT NULL,
  PRIMARY KEY (`id`), UNIQUE KEY `OSH_opportunity_version_key` (`historyHash`),
  KEY `OSH_opportunity_time_idx` (`opportunityId`(100),`transitionedAt`), KEY `OSH_actor_time_idx` (`actorId`(100),`transitionedAt`),
  CONSTRAINT `OSH_opportunity_fkey` FOREIGN KEY (`opportunityId`) REFERENCES `Opportunity`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `OSH_actor_fkey` FOREIGN KEY (`actorId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
CREATE TRIGGER `OSH_hash_insert` BEFORE INSERT ON `OpportunityStageHistory` FOR EACH ROW SET NEW.`historyHash`=SHA2(CONCAT(NEW.`opportunityId`,'|',NEW.`aggregateVersion`),256);
CREATE TRIGGER `OSH_hash_update` BEFORE UPDATE ON `OpportunityStageHistory` FOR EACH ROW SET NEW.`historyHash`=SHA2(CONCAT(NEW.`opportunityId`,'|',NEW.`aggregateVersion`),256);

CREATE TABLE `OpportunityCommandReceipt` (
  `id` VARCHAR(191) NOT NULL, `actorId` VARCHAR(191) NOT NULL, `idempotencyKey` VARCHAR(191) NOT NULL,
  `command` VARCHAR(100) NOT NULL, `opportunityId` VARCHAR(191) NOT NULL, `resultVersion` INTEGER NOT NULL,
  `createdAt` DATETIME NOT NULL, `receiptHash` CHAR(64) NOT NULL, PRIMARY KEY (`id`),
  UNIQUE KEY `OCR_actor_key_command_key` (`receiptHash`), KEY `OCR_opportunity_created_idx` (`opportunityId`(100),`createdAt`),
  CONSTRAINT `OCR_actor_fkey` FOREIGN KEY (`actorId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `OCR_opportunity_fkey` FOREIGN KEY (`opportunityId`) REFERENCES `Opportunity`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
CREATE TRIGGER `OCR_hash_insert` BEFORE INSERT ON `OpportunityCommandReceipt` FOR EACH ROW SET NEW.`receiptHash`=SHA2(CONCAT(NEW.`actorId`,'|',NEW.`idempotencyKey`,'|',NEW.`command`),256);
CREATE TRIGGER `OCR_hash_update` BEFORE UPDATE ON `OpportunityCommandReceipt` FOR EACH ROW SET NEW.`receiptHash`=SHA2(CONCAT(NEW.`actorId`,'|',NEW.`idempotencyKey`,'|',NEW.`command`),256);

CREATE TABLE `QuoteVersion` (
  `id` VARCHAR(191) NOT NULL, `quoteId` VARCHAR(191) NOT NULL, `versionNumber` INTEGER NOT NULL,
  `status` ENUM('DRAFT','SUBMITTED','APPROVED','REJECTED','RETURNED','SENT','ACCEPTED','SUPERSEDED') NOT NULL DEFAULT 'DRAFT',
  `currency` CHAR(3) NOT NULL DEFAULT 'THB', `subtotal` DECIMAL(19,4) NOT NULL, `discountAmount` DECIMAL(19,4) NOT NULL,
  `total` DECIMAL(19,4) NOT NULL, `totalCost` DECIMAL(19,4) NOT NULL, `grossMarginAmount` DECIMAL(19,4) NOT NULL,
  `grossMarginPct` DECIMAL(7,4) NOT NULL, `policyInputSnapshot` LONGTEXT NOT NULL, `coverageSnapshot` LONGTEXT NOT NULL,
  `solutionSnapshot` LONGTEXT NOT NULL, `validUntil` DATETIME NULL, `notes` TEXT NULL, `submittedAt` DATETIME NULL,
  `acceptedAt` DATETIME NULL, `createdAt` DATETIME NOT NULL, `versionHash` CHAR(64) NOT NULL, PRIMARY KEY (`id`),
  UNIQUE KEY `QV_quote_version_key` (`versionHash`), KEY `QV_quote_status_version_idx` (`quoteId`(100),`status`,`versionNumber`),
  CONSTRAINT `QV_quote_fkey` FOREIGN KEY (`quoteId`) REFERENCES `Quote`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
CREATE TRIGGER `QV_hash_insert` BEFORE INSERT ON `QuoteVersion` FOR EACH ROW SET NEW.`versionHash`=SHA2(CONCAT(NEW.`quoteId`,'|',NEW.`versionNumber`),256);
CREATE TRIGGER `QV_hash_update` BEFORE UPDATE ON `QuoteVersion` FOR EACH ROW SET NEW.`versionHash`=SHA2(CONCAT(NEW.`quoteId`,'|',NEW.`versionNumber`),256);

CREATE TABLE `QuoteVersionItem` (
  `id` VARCHAR(191) NOT NULL, `quoteVersionId` VARCHAR(191) NOT NULL, `productId` VARCHAR(191) NOT NULL,
  `productCode` VARCHAR(191) NOT NULL, `productName` VARCHAR(255) NOT NULL, `quantity` DECIMAL(19,4) NOT NULL,
  `unitPrice` DECIMAL(19,4) NOT NULL, `discountAmount` DECIMAL(19,4) NOT NULL, `unitCost` DECIMAL(19,4) NOT NULL,
  `lineSubtotal` DECIMAL(19,4) NOT NULL, `lineTotal` DECIMAL(19,4) NOT NULL, `lineCost` DECIMAL(19,4) NOT NULL,
  `marginAmount` DECIMAL(19,4) NOT NULL, `createdAt` DATETIME NOT NULL, PRIMARY KEY (`id`),
  KEY `QVI_version_product_idx` (`quoteVersionId`(80),`productId`(80)),
  CONSTRAINT `QVI_version_fkey` FOREIGN KEY (`quoteVersionId`) REFERENCES `QuoteVersion`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `ApprovalPolicy` (
  `id` VARCHAR(191) NOT NULL, `code` VARCHAR(100) NOT NULL, `activeVersionId` VARCHAR(191) NULL,
  `createdAt` DATETIME NOT NULL, `updatedAt` DATETIME NOT NULL, PRIMARY KEY (`id`),
  UNIQUE KEY `ApprovalPolicy_code_key` (`code`), UNIQUE KEY `ApprovalPolicy_activeVersionId_key` (`activeVersionId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `ApprovalPolicyVersion` (
  `id` VARCHAR(191) NOT NULL, `policyId` VARCHAR(191) NOT NULL, `version` INTEGER NOT NULL,
  `definition` LONGTEXT NOT NULL, `definitionHash` CHAR(64) NOT NULL, `effectiveFrom` DATETIME NOT NULL,
  `effectiveTo` DATETIME NULL, `createdAt` DATETIME NOT NULL, `versionHash` CHAR(64) NOT NULL, PRIMARY KEY (`id`),
  UNIQUE KEY `APV_policy_version_key` (`versionHash`),
  CONSTRAINT `APV_policy_fkey` FOREIGN KEY (`policyId`) REFERENCES `ApprovalPolicy`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
CREATE TRIGGER `APV_hash_insert` BEFORE INSERT ON `ApprovalPolicyVersion` FOR EACH ROW SET NEW.`versionHash`=SHA2(CONCAT(NEW.`policyId`,'|',NEW.`version`),256);
CREATE TRIGGER `APV_hash_update` BEFORE UPDATE ON `ApprovalPolicyVersion` FOR EACH ROW SET NEW.`versionHash`=SHA2(CONCAT(NEW.`policyId`,'|',NEW.`version`),256);
ALTER TABLE `ApprovalPolicy` ADD CONSTRAINT `ApprovalPolicy_activeVersion_fkey` FOREIGN KEY (`activeVersionId`) REFERENCES `ApprovalPolicyVersion`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE `ApprovalAuthorityGrant` (
  `id` VARCHAR(191) NOT NULL, `roleCode` VARCHAR(100) NOT NULL, `permissionCode` VARCHAR(191) NOT NULL,
  `organizationUnitId` VARCHAR(191) NULL, `customerSegment` VARCHAR(100) NULL, `maximumAmount` DECIMAL(19,4) NOT NULL,
  `active` TINYINT(1) NOT NULL DEFAULT 1, `effectiveFrom` DATETIME NOT NULL, `effectiveTo` DATETIME NULL,
  `createdAt` DATETIME NOT NULL, PRIMARY KEY (`id`),
  KEY `AAG_role_permission_active_idx` (`roleCode`(40),`permissionCode`(60),`active`,`effectiveFrom`,`effectiveTo`),
  KEY `AAG_org_segment_idx` (`organizationUnitId`(80),`customerSegment`(40))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `ApprovalRequest` (
  `id` VARCHAR(191) NOT NULL, `quoteVersionId` VARCHAR(191) NOT NULL, `policyVersionId` VARCHAR(191) NOT NULL,
  `makerId` VARCHAR(191) NOT NULL, `status` ENUM('PENDING','PENDING_ESCALATION','APPROVED','REJECTED','RETURNED','CANCELLED','EXPIRED','SUPERSEDED') NOT NULL DEFAULT 'PENDING',
  `version` INTEGER NOT NULL DEFAULT 1, `inputSnapshot` LONGTEXT NOT NULL, `quoteVersionHash` CHAR(64) NOT NULL,
  `submittedAt` DATETIME NOT NULL, `completedAt` DATETIME NULL, `supersededAt` DATETIME NULL, PRIMARY KEY (`id`),
  KEY `AR_quote_status_idx` (`quoteVersionId`(100),`status`), KEY `AR_maker_submitted_idx` (`makerId`(100),`submittedAt`),
  CONSTRAINT `AR_quote_version_fkey` FOREIGN KEY (`quoteVersionId`) REFERENCES `QuoteVersion`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `AR_policy_version_fkey` FOREIGN KEY (`policyVersionId`) REFERENCES `ApprovalPolicyVersion`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `AR_maker_fkey` FOREIGN KEY (`makerId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `ApprovalStep` (
  `id` VARCHAR(191) NOT NULL, `requestId` VARCHAR(191) NOT NULL, `stepCode` VARCHAR(100) NOT NULL, `sequence` INTEGER NOT NULL,
  `executionMode` VARCHAR(32) NOT NULL, `requiredPermission` VARCHAR(191) NOT NULL, `assignedRoleCode` VARCHAR(100) NULL,
  `delegatedToActorId` VARCHAR(191) NULL, `minimumAuthority` DECIMAL(19,4) NULL, `maximumAuthority` DECIMAL(19,4) NULL,
  `makerChecker` TINYINT(1) NOT NULL DEFAULT 1, `status` ENUM('WAITING','PENDING','APPROVED','REJECTED','RETURNED','DELEGATED','ESCALATED','SKIPPED') NOT NULL DEFAULT 'WAITING',
  `dueAt` DATETIME NULL, `stepHash` CHAR(64) NOT NULL, PRIMARY KEY (`id`), UNIQUE KEY `AS_request_code_key` (`stepHash`),
  KEY `AS_request_sequence_status_idx` (`requestId`(100),`sequence`,`status`),
  CONSTRAINT `AS_request_fkey` FOREIGN KEY (`requestId`) REFERENCES `ApprovalRequest`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
CREATE TRIGGER `AS_hash_insert` BEFORE INSERT ON `ApprovalStep` FOR EACH ROW SET NEW.`stepHash`=SHA2(CONCAT(NEW.`requestId`,'|',NEW.`stepCode`),256);
CREATE TRIGGER `AS_hash_update` BEFORE UPDATE ON `ApprovalStep` FOR EACH ROW SET NEW.`stepHash`=SHA2(CONCAT(NEW.`requestId`,'|',NEW.`stepCode`),256);

CREATE TABLE `ApprovalDecision` (
  `id` VARCHAR(191) NOT NULL, `requestId` VARCHAR(191) NOT NULL, `stepId` VARCHAR(191) NOT NULL, `actorId` VARCHAR(191) NOT NULL,
  `delegateToActorId` VARCHAR(191) NULL, `decision` VARCHAR(32) NOT NULL, `reason` VARCHAR(1000) NOT NULL,
  `authoritySnapshot` LONGTEXT NOT NULL, `policyInputSnapshot` LONGTEXT NOT NULL, `previousHash` CHAR(64) NOT NULL,
  `decisionHash` CHAR(64) NOT NULL, `correlationId` VARCHAR(191) NOT NULL, `decidedAt` DATETIME NOT NULL, PRIMARY KEY (`id`),
  KEY `AD_request_time_idx` (`requestId`(100),`decidedAt`), KEY `AD_actor_time_idx` (`actorId`(100),`decidedAt`),
  CONSTRAINT `AD_request_fkey` FOREIGN KEY (`requestId`) REFERENCES `ApprovalRequest`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `AD_step_fkey` FOREIGN KEY (`stepId`) REFERENCES `ApprovalStep`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `AD_actor_fkey` FOREIGN KEY (`actorId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `CommercialCommandReceipt` (
  `id` VARCHAR(191) NOT NULL, `actorId` VARCHAR(191) NOT NULL, `idempotencyKey` VARCHAR(191) NOT NULL,
  `command` VARCHAR(100) NOT NULL, `targetId` VARCHAR(191) NOT NULL, `resultVersion` INTEGER NULL,
  `createdAt` DATETIME NOT NULL, `receiptHash` CHAR(64) NOT NULL, PRIMARY KEY (`id`), UNIQUE KEY `CCR_actor_key_command_key` (`receiptHash`),
  KEY `CCR_target_created_idx` (`targetId`(100),`createdAt`), CONSTRAINT `CCR_actor_fkey` FOREIGN KEY (`actorId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
CREATE TRIGGER `CCR_hash_insert` BEFORE INSERT ON `CommercialCommandReceipt` FOR EACH ROW SET NEW.`receiptHash`=SHA2(CONCAT(NEW.`actorId`,'|',NEW.`idempotencyKey`,'|',NEW.`command`),256);
CREATE TRIGGER `CCR_hash_update` BEFORE UPDATE ON `CommercialCommandReceipt` FOR EACH ROW SET NEW.`receiptHash`=SHA2(CONCAT(NEW.`actorId`,'|',NEW.`idempotencyKey`,'|',NEW.`command`),256);

CREATE TABLE `ForecastSnapshot` (
  `id` VARCHAR(191) NOT NULL, `snapshotKey` VARCHAR(191) NOT NULL, `periodStart` DATETIME NOT NULL, `periodEnd` DATETIME NOT NULL,
  `cutoffAt` DATETIME NOT NULL, `timezone` VARCHAR(64) NOT NULL, `formulaVersion` VARCHAR(64) NOT NULL, `scopeSnapshot` LONGTEXT NOT NULL,
  `currency` CHAR(3) NOT NULL DEFAULT 'THB', `pipelineAmount` DECIMAL(19,4) NOT NULL, `weightedAmount` DECIMAL(19,4) NOT NULL,
  `qualitySnapshot` LONGTEXT NOT NULL, `createdById` VARCHAR(191) NOT NULL, `createdAt` DATETIME NOT NULL, PRIMARY KEY (`id`),
  UNIQUE KEY `FS_snapshotKey_key` (`snapshotKey`), KEY `FS_period_cutoff_idx` (`periodStart`,`periodEnd`,`cutoffAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `ForecastItem` (
  `id` VARCHAR(191) NOT NULL, `snapshotId` VARCHAR(191) NOT NULL, `opportunityId` VARCHAR(191) NOT NULL,
  `opportunityVersion` INTEGER NOT NULL, `ownerId` VARCHAR(191) NOT NULL, `organizationUnitId` VARCHAR(191) NULL,
  `customerId` VARCHAR(191) NOT NULL, `segment` VARCHAR(100) NOT NULL, `flow` VARCHAR(191) NOT NULL,
  `stage` ENUM('QUALIFY','DISCOVER','SOLUTION','PROPOSAL','NEGOTIATION','WON','LOST','CANCELLED') NOT NULL,
  `category` ENUM('COMMIT','BEST_CASE','PIPELINE','OMITTED') NOT NULL, `estimatedValue` DECIMAL(19,4) NOT NULL,
  `forecastAmount` DECIMAL(19,4) NOT NULL, `weightedAmount` DECIMAL(19,4) NOT NULL, `probability` INTEGER NOT NULL,
  `amountSource` VARCHAR(32) NOT NULL, `sourceQuoteVersionId` VARCHAR(191) NULL, `expectedCloseAt` DATETIME NULL,
  `stageEnteredAt` DATETIME NOT NULL, `riskSnapshot` LONGTEXT NOT NULL, `qualitySnapshot` LONGTEXT NOT NULL,
  `itemHash` CHAR(64) NOT NULL, PRIMARY KEY (`id`), UNIQUE KEY `FI_snapshot_opportunity_key` (`itemHash`),
  KEY `FI_rollup_idx` (`snapshotId`(40),`organizationUnitId`(40),`ownerId`(40),`stage`,`category`),
  CONSTRAINT `FI_snapshot_fkey` FOREIGN KEY (`snapshotId`) REFERENCES `ForecastSnapshot`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `FI_opportunity_fkey` FOREIGN KEY (`opportunityId`) REFERENCES `Opportunity`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
CREATE TRIGGER `FI_hash_insert` BEFORE INSERT ON `ForecastItem` FOR EACH ROW SET NEW.`itemHash`=SHA2(CONCAT(NEW.`snapshotId`,'|',NEW.`opportunityId`),256);
CREATE TRIGGER `FI_hash_update` BEFORE UPDATE ON `ForecastItem` FOR EACH ROW SET NEW.`itemHash`=SHA2(CONCAT(NEW.`snapshotId`,'|',NEW.`opportunityId`),256);

-- Preserve the legacy Quote/QuoteItem read path while creating reproducible v1 snapshots.
INSERT INTO `QuoteVersion` (`id`,`quoteId`,`versionNumber`,`status`,`currency`,`subtotal`,`discountAmount`,`total`,`totalCost`,`grossMarginAmount`,`grossMarginPct`,`policyInputSnapshot`,`coverageSnapshot`,`solutionSnapshot`,`validUntil`,`notes`,`submittedAt`,`acceptedAt`,`createdAt`,`versionHash`)
SELECT CONCAT('qv_',SHA2(q.`id`,256)),q.`id`,1,CASE q.`status` WHEN 'APPROVED' THEN 'APPROVED' WHEN 'REJECTED' THEN 'REJECTED' WHEN 'SENT' THEN 'SENT' WHEN 'ACCEPTED' THEN 'ACCEPTED' ELSE 'DRAFT' END,
  'THB',q.`subtotal`,q.`discountValue`,q.`total`,0,q.`total`,CASE WHEN q.`total`=0 THEN 0 ELSE 100 END,
  '{"legacyBackfill":true}','{"legacyBackfill":true}','{"legacyBackfill":true}',q.`validUntil`,q.`notes`,
  CASE WHEN q.`status` IN ('PENDING_APPROVAL','APPROVED','REJECTED','SENT','ACCEPTED') THEN q.`updatedAt` ELSE NULL END,
  CASE WHEN q.`status`='ACCEPTED' THEN q.`updatedAt` ELSE NULL END,q.`createdAt`,REPEAT('0',64) FROM `Quote` q;
INSERT INTO `QuoteVersionItem` (`id`,`quoteVersionId`,`productId`,`productCode`,`productName`,`quantity`,`unitPrice`,`discountAmount`,`unitCost`,`lineSubtotal`,`lineTotal`,`lineCost`,`marginAmount`,`createdAt`)
SELECT CONCAT('qvi_',SHA2(qi.`id`,256)),CONCAT('qv_',SHA2(qi.`quoteId`,256)),qi.`productId`,p.`code`,p.`name`,qi.`quantity`,qi.`unitPrice`,0,0,qi.`quantity`*qi.`unitPrice`,qi.`quantity`*qi.`unitPrice`,0,qi.`quantity`*qi.`unitPrice`,qi.`createdAt`
FROM `QuoteItem` qi JOIN `Product` p ON p.`id`=qi.`productId`;

-- Versioned configuration. Thresholds, roles, steps, and levels remain data.
INSERT INTO `OpportunityTransitionPolicyVersion` (`id`,`policyCode`,`version`,`command`,`fromStage`,`toStage`,`requiredFields`,`requiredPermission`,`active`,`effectiveFrom`,`createdAt`) VALUES
('otp_qualify_discover_v1','QUALIFY_DISCOVER',1,'FORWARD','QUALIFY','DISCOVER','["qualificationResult","nextAction"]','opportunity.transition',1,UTC_TIMESTAMP(),UTC_TIMESTAMP()),
('otp_discover_solution_v1','DISCOVER_SOLUTION',1,'FORWARD','DISCOVER','SOLUTION','["requirements","stakeholderSummary","expectedCloseAt"]','opportunity.transition',1,UTC_TIMESTAMP(),UTC_TIMESTAMP()),
('otp_solution_proposal_v1','SOLUTION_PROPOSAL',1,'FORWARD','SOLUTION','PROPOSAL','["coverageConfirmed","solutionComplete"]','opportunity.transition',1,UTC_TIMESTAMP(),UTC_TIMESTAMP()),
('otp_proposal_negotiation_v1','PROPOSAL_NEGOTIATION',1,'FORWARD','PROPOSAL','NEGOTIATION','["quoteSubmitted","quoteApproved"]','opportunity.transition',1,UTC_TIMESTAMP(),UTC_TIMESTAMP()),
('otp_negotiation_won_v1','NEGOTIATION_WON',1,'WON','NEGOTIATION','WON','["quoteApproved","quoteAccepted","reason"]','opportunity.transition.won',1,UTC_TIMESTAMP(),UTC_TIMESTAMP()),
('otp_lost_reopen_v1','LOST_REOPEN',1,'REOPEN','LOST','QUALIFY','["reason","expectedCloseAt"]','opportunity.transition.reopen',1,UTC_TIMESTAMP(),UTC_TIMESTAMP()),
('otp_won_reopen_v1','WON_REOPEN',1,'REOPEN','WON','NEGOTIATION','["reason"]','opportunity.transition.reopen-won',1,UTC_TIMESTAMP(),UTC_TIMESTAMP()),
('otp_discover_return_v1','DISCOVER_RETURN',1,'RETURN','DISCOVER','QUALIFY','["reason"]','opportunity.transition',1,UTC_TIMESTAMP(),UTC_TIMESTAMP()),
('otp_solution_return_v1','SOLUTION_RETURN',1,'RETURN','SOLUTION','DISCOVER','["reason"]','opportunity.transition',1,UTC_TIMESTAMP(),UTC_TIMESTAMP()),
('otp_proposal_return_v1','PROPOSAL_RETURN',1,'RETURN','PROPOSAL','SOLUTION','["reason"]','opportunity.transition',1,UTC_TIMESTAMP(),UTC_TIMESTAMP()),
('otp_negotiation_return_v1','NEGOTIATION_RETURN',1,'RETURN','NEGOTIATION','PROPOSAL','["reason"]','opportunity.transition',1,UTC_TIMESTAMP(),UTC_TIMESTAMP()),
('otp_qualify_lost_v1','QUALIFY_LOST',1,'LOST','QUALIFY','LOST','["reason","lostReason","lostCategory"]','opportunity.transition',1,UTC_TIMESTAMP(),UTC_TIMESTAMP()),
('otp_discover_lost_v1','DISCOVER_LOST',1,'LOST','DISCOVER','LOST','["reason","lostReason","lostCategory"]','opportunity.transition',1,UTC_TIMESTAMP(),UTC_TIMESTAMP()),
('otp_solution_lost_v1','SOLUTION_LOST',1,'LOST','SOLUTION','LOST','["reason","lostReason","lostCategory"]','opportunity.transition',1,UTC_TIMESTAMP(),UTC_TIMESTAMP()),
('otp_proposal_lost_v1','PROPOSAL_LOST',1,'LOST','PROPOSAL','LOST','["reason","lostReason","lostCategory"]','opportunity.transition',1,UTC_TIMESTAMP(),UTC_TIMESTAMP()),
('otp_negotiation_lost_v1','NEGOTIATION_LOST',1,'LOST','NEGOTIATION','LOST','["reason","lostReason","lostCategory"]','opportunity.transition',1,UTC_TIMESTAMP(),UTC_TIMESTAMP()),
('otp_qualify_cancel_v1','QUALIFY_CANCEL',1,'CANCEL','QUALIFY','CANCELLED','["reason"]','opportunity.transition',1,UTC_TIMESTAMP(),UTC_TIMESTAMP()),
('otp_discover_cancel_v1','DISCOVER_CANCEL',1,'CANCEL','DISCOVER','CANCELLED','["reason"]','opportunity.transition',1,UTC_TIMESTAMP(),UTC_TIMESTAMP()),
('otp_solution_cancel_v1','SOLUTION_CANCEL',1,'CANCEL','SOLUTION','CANCELLED','["reason"]','opportunity.transition',1,UTC_TIMESTAMP(),UTC_TIMESTAMP()),
('otp_proposal_cancel_v1','PROPOSAL_CANCEL',1,'CANCEL','PROPOSAL','CANCELLED','["reason"]','opportunity.transition',1,UTC_TIMESTAMP(),UTC_TIMESTAMP()),
('otp_negotiation_cancel_v1','NEGOTIATION_CANCEL',1,'CANCEL','NEGOTIATION','CANCELLED','["reason"]','opportunity.transition',1,UTC_TIMESTAMP(),UTC_TIMESTAMP());

INSERT INTO `RolePermissionGrant` (`id`,`roleCode`,`permissionCode`,`createdAt`,`grantHash`) VALUES
('grant_opp_won_sales_director','SALES_DIRECTOR','opportunity.transition.won',UTC_TIMESTAMP(),REPEAT('0',64)),
('grant_opp_reopen_manager','TEAM_MANAGER','opportunity.transition.reopen',UTC_TIMESTAMP(),REPEAT('0',64)),
('grant_opp_reopen_sales_director','SALES_DIRECTOR','opportunity.transition.reopen',UTC_TIMESTAMP(),REPEAT('0',64)),
('grant_opp_reopen_won_director','SALES_DIRECTOR','opportunity.transition.reopen-won',UTC_TIMESTAMP(),REPEAT('0',64));

INSERT INTO `ApprovalPolicy` (`id`,`code`,`createdAt`,`updatedAt`) VALUES ('approval_default','COMMERCIAL_DEFAULT',UTC_TIMESTAMP(),UTC_TIMESTAMP());
INSERT INTO `ApprovalPolicyVersion` (`id`,`policyId`,`version`,`definition`,`definitionHash`,`effectiveFrom`,`createdAt`,`versionHash`) VALUES
('approval_default_v1','approval_default',1,
 '{"submissionGates":{"coverageRequired":false,"solutionRequired":true,"confirmedCostRequired":true},"rules":[{"code":"T3","when":[{"field":"total","operator":"GT","value":"100000000"}],"steps":[{"code":"commercial-committee","sequence":1,"executionMode":"SEQUENTIAL","requiredPermission":"approval.committee","assignedRoleCode":"COMMERCIAL_COMMITTEE","maximumAuthority":"999999999999999.9999","makerChecker":true,"slaHours":24}]},{"code":"T2","when":[{"field":"total","operator":"GT","value":"10000000"},{"field":"total","operator":"LTE","value":"100000000"}],"steps":[{"code":"sales-director","sequence":1,"executionMode":"PARALLEL","requiredPermission":"approval.sales-director","assignedRoleCode":"SALES_DIRECTOR","maximumAuthority":"100000000","makerChecker":true,"slaHours":24},{"code":"pricing","sequence":1,"executionMode":"PARALLEL","requiredPermission":"approval.pricing","assignedRoleCode":"PRICING_APPROVER","maximumAuthority":"100000000","makerChecker":true,"slaHours":24}]}],"fallbackSteps":[{"code":"team-manager","sequence":1,"executionMode":"SEQUENTIAL","requiredPermission":"approval.team-manager","assignedRoleCode":"TEAM_MANAGER","maximumAuthority":"10000000","makerChecker":true,"slaHours":24}]}',
 REPEAT('0',64),UTC_TIMESTAMP(),UTC_TIMESTAMP(),REPEAT('0',64));
UPDATE `ApprovalPolicyVersion` SET `definitionHash`=SHA2(`definition`,256) WHERE `id`='approval_default_v1';
UPDATE `ApprovalPolicy` SET `activeVersionId`='approval_default_v1' WHERE `id`='approval_default';

INSERT INTO `ApprovalAuthorityGrant` (`id`,`roleCode`,`permissionCode`,`maximumAmount`,`active`,`effectiveFrom`,`createdAt`) VALUES
('auth_team_manager_v1','TEAM_MANAGER','approval.team-manager',10000000,1,UTC_TIMESTAMP(),UTC_TIMESTAMP()),
('auth_sales_director_v1','SALES_DIRECTOR','approval.sales-director',100000000,1,UTC_TIMESTAMP(),UTC_TIMESTAMP()),
('auth_pricing_v1','PRICING_APPROVER','approval.pricing',100000000,1,UTC_TIMESTAMP(),UTC_TIMESTAMP()),
('auth_committee_v1','COMMERCIAL_COMMITTEE','approval.committee',999999999999999.9999,1,UTC_TIMESTAMP(),UTC_TIMESTAMP());

-- Backward-compatible effective role assignment for existing legacy users.
INSERT INTO `UserRoleAssignment` (`id`,`userId`,`roleCode`,`scopeCode`,`organizationUnitId`,`effectiveFrom`,`effectiveTo`,`active`,`createdAt`,`updatedAt`)
SELECT CONCAT('ura_',SUBSTR(SHA2(CONCAT(u.`id`,'|',u.`role`),256),1,40)),u.`id`,
  CASE u.`role` WHEN 'ADMIN' THEN 'ADMIN' WHEN 'VIEWER' THEN 'VIEWER' ELSE 'KAM' END,
  CASE u.`role` WHEN 'ADMIN' THEN 'ENTERPRISE' ELSE 'SELF' END,NULL,UTC_TIMESTAMP(),NULL,1,UTC_TIMESTAMP(),UTC_TIMESTAMP()
FROM `User` u WHERE NOT EXISTS (SELECT 1 FROM `UserRoleAssignment` a WHERE a.`userId`=u.`id` AND a.`active`=1);

INSERT INTO `LegacySchemaMigration` (`id`,`appliedAt`) VALUES ('20260713220000_add_opportunity_pipeline_quote_approval',UTC_TIMESTAMP());
