-- Forward-only MySQL 8 expand migration for Opportunity, Forecast, Quote Version
-- and configurable Approval. Do not apply to the MariaDB 5.5 compatibility DB.

ALTER TABLE `Opportunity`
  MODIFY `stage` ENUM('QUALIFY','DISCOVER','SOLUTION','PROPOSAL','NEGOTIATION','WON','LOST','CANCELLED') NOT NULL DEFAULT 'QUALIFY',
  MODIFY `estimatedValue` DECIMAL(19,4) NOT NULL,
  ADD COLUMN `version` INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN `currency` CHAR(3) NOT NULL DEFAULT 'THB',
  ADD COLUMN `forecastCategory` ENUM('COMMIT','BEST_CASE','PIPELINE','OMITTED') NOT NULL DEFAULT 'PIPELINE',
  ADD COLUMN `stageEnteredAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  ADD COLUMN `organizationUnitId` VARCHAR(191) NULL,
  ADD COLUMN `qualificationResult` TEXT NULL,
  ADD COLUMN `stakeholderSummary` TEXT NULL,
  ADD COLUMN `lostReason` VARCHAR(1000) NULL,
  ADD COLUMN `lostCategory` VARCHAR(100) NULL,
  ADD COLUMN `cancelledReason` VARCHAR(1000) NULL,
  ADD COLUMN `primaryQuoteId` VARCHAR(191) NULL,
  ADD UNIQUE INDEX `Opportunity_primaryQuoteId_key` (`primaryQuoteId`),
  ADD INDEX `Opportunity_org_owner_stage_close_idx` (`organizationUnitId`,`ownerId`,`stage`,`expectedCloseAt`),
  ADD INDEX `Opportunity_owner_updated_id_idx` (`ownerId`,`updatedAt`,`id`);

UPDATE `Opportunity` o JOIN `Customer` c ON c.`id`=o.`customerId`
SET o.`organizationUnitId`=c.`organizationUnitId`, o.`stageEnteredAt`=o.`createdAt`;

ALTER TABLE `Opportunity`
  ADD CONSTRAINT `Opportunity_organizationUnitId_fkey` FOREIGN KEY (`organizationUnitId`) REFERENCES `OrganizationUnit`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `Opportunity_primaryQuoteId_fkey` FOREIGN KEY (`primaryQuoteId`) REFERENCES `Quote`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `Product`
  ADD COLUMN `standardCost` DECIMAL(19,4) NULL,
  ADD COLUMN `costConfirmedAt` DATETIME(3) NULL;

ALTER TABLE `Quote`
  ADD COLUMN `version` INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN `makerId` VARCHAR(191) NULL,
  ADD INDEX `Quote_makerId_idx` (`makerId`),
  ADD CONSTRAINT `Quote_makerId_fkey` FOREIGN KEY (`makerId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

UPDATE `Quote` q
LEFT JOIN `Opportunity` o ON o.`id` = q.`opportunityId`
LEFT JOIN `Customer` c ON c.`id` = q.`customerId`
SET q.`makerId` = COALESCE(o.`ownerId`, c.`ownerId`)
WHERE q.`makerId` IS NULL;

UPDATE `Opportunity` o
SET o.`primaryQuoteId` = (
  SELECT q.`id` FROM `Quote` q WHERE q.`opportunityId` = o.`id` ORDER BY q.`createdAt`, q.`id` LIMIT 1
)
WHERE o.`primaryQuoteId` IS NULL AND EXISTS (SELECT 1 FROM `Quote` q2 WHERE q2.`opportunityId` = o.`id`);

CREATE TABLE `OpportunityTransitionPolicyVersion` (
  `id` VARCHAR(191) NOT NULL, `policyCode` VARCHAR(100) NOT NULL, `version` INTEGER NOT NULL,
  `command` VARCHAR(32) NOT NULL, `fromStage` ENUM('QUALIFY','DISCOVER','SOLUTION','PROPOSAL','NEGOTIATION','WON','LOST','CANCELLED') NOT NULL,
  `toStage` ENUM('QUALIFY','DISCOVER','SOLUTION','PROPOSAL','NEGOTIATION','WON','LOST','CANCELLED') NOT NULL,
  `requiredFields` JSON NOT NULL, `requiredPermission` VARCHAR(191) NOT NULL, `active` BOOLEAN NOT NULL DEFAULT true,
  `effectiveFrom` DATETIME(3) NOT NULL, `effectiveTo` DATETIME(3) NULL, `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`), UNIQUE INDEX `OpportunityTransitionPolicyVersion_code_version_key` (`policyCode`,`version`),
  INDEX `OpportunityTransitionPolicyVersion_route_idx` (`fromStage`,`toStage`,`command`,`active`,`effectiveFrom`,`effectiveTo`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `OpportunityStageHistory` (
  `id` VARCHAR(191) NOT NULL, `opportunityId` VARCHAR(191) NOT NULL,
  `fromStage` ENUM('QUALIFY','DISCOVER','SOLUTION','PROPOSAL','NEGOTIATION','WON','LOST','CANCELLED') NOT NULL,
  `toStage` ENUM('QUALIFY','DISCOVER','SOLUTION','PROPOSAL','NEGOTIATION','WON','LOST','CANCELLED') NOT NULL,
  `command` VARCHAR(32) NOT NULL, `reason` VARCHAR(1000) NULL, `actorId` VARCHAR(191) NOT NULL,
  `policyVersionId` VARCHAR(191) NOT NULL, `evidenceSnapshot` JSON NOT NULL, `aggregateVersion` INTEGER NOT NULL,
  `correlationId` VARCHAR(191) NOT NULL, `transitionedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`), UNIQUE INDEX `OpportunityStageHistory_opportunity_version_key` (`opportunityId`,`aggregateVersion`),
  INDEX `OpportunityStageHistory_opportunity_time_idx` (`opportunityId`,`transitionedAt`), INDEX `OpportunityStageHistory_actor_time_idx` (`actorId`,`transitionedAt`),
  CONSTRAINT `OpportunityStageHistory_opportunityId_fkey` FOREIGN KEY (`opportunityId`) REFERENCES `Opportunity`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `OpportunityStageHistory_actorId_fkey` FOREIGN KEY (`actorId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `OpportunityCommandReceipt` (
  `id` VARCHAR(191) NOT NULL, `actorId` VARCHAR(191) NOT NULL, `idempotencyKey` VARCHAR(191) NOT NULL,
  `command` VARCHAR(100) NOT NULL, `opportunityId` VARCHAR(191) NOT NULL, `resultVersion` INTEGER NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), PRIMARY KEY (`id`),
  UNIQUE INDEX `OpportunityCommandReceipt_actor_key_command_key` (`actorId`,`idempotencyKey`,`command`),
  INDEX `OpportunityCommandReceipt_opportunity_created_idx` (`opportunityId`,`createdAt`),
  CONSTRAINT `OpportunityCommandReceipt_actorId_fkey` FOREIGN KEY (`actorId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `OpportunityCommandReceipt_opportunityId_fkey` FOREIGN KEY (`opportunityId`) REFERENCES `Opportunity`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `QuoteVersion` (
  `id` VARCHAR(191) NOT NULL, `quoteId` VARCHAR(191) NOT NULL, `versionNumber` INTEGER NOT NULL,
  `status` ENUM('DRAFT','SUBMITTED','APPROVED','REJECTED','RETURNED','SENT','ACCEPTED','SUPERSEDED') NOT NULL DEFAULT 'DRAFT',
  `currency` CHAR(3) NOT NULL DEFAULT 'THB', `subtotal` DECIMAL(19,4) NOT NULL, `discountAmount` DECIMAL(19,4) NOT NULL,
  `total` DECIMAL(19,4) NOT NULL, `totalCost` DECIMAL(19,4) NOT NULL, `grossMarginAmount` DECIMAL(19,4) NOT NULL,
  `grossMarginPct` DECIMAL(7,4) NOT NULL, `policyInputSnapshot` JSON NOT NULL, `coverageSnapshot` JSON NOT NULL,
  `solutionSnapshot` JSON NOT NULL, `validUntil` DATETIME(3) NULL, `notes` TEXT NULL, `submittedAt` DATETIME(3) NULL,
  `acceptedAt` DATETIME(3) NULL, `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), PRIMARY KEY (`id`),
  UNIQUE INDEX `QuoteVersion_quote_version_key` (`quoteId`,`versionNumber`), INDEX `QuoteVersion_quote_status_version_idx` (`quoteId`,`status`,`versionNumber`),
  CONSTRAINT `QuoteVersion_quoteId_fkey` FOREIGN KEY (`quoteId`) REFERENCES `Quote`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `QuoteVersionItem` (
  `id` VARCHAR(191) NOT NULL, `quoteVersionId` VARCHAR(191) NOT NULL, `productId` VARCHAR(191) NOT NULL,
  `productCode` VARCHAR(191) NOT NULL, `productName` VARCHAR(255) NOT NULL, `quantity` DECIMAL(19,4) NOT NULL,
  `unitPrice` DECIMAL(19,4) NOT NULL, `discountAmount` DECIMAL(19,4) NOT NULL, `unitCost` DECIMAL(19,4) NOT NULL,
  `lineSubtotal` DECIMAL(19,4) NOT NULL, `lineTotal` DECIMAL(19,4) NOT NULL, `lineCost` DECIMAL(19,4) NOT NULL,
  `marginAmount` DECIMAL(19,4) NOT NULL, `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), PRIMARY KEY (`id`),
  INDEX `QuoteVersionItem_version_product_idx` (`quoteVersionId`,`productId`),
  CONSTRAINT `QuoteVersionItem_quoteVersionId_fkey` FOREIGN KEY (`quoteVersionId`) REFERENCES `QuoteVersion`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ApprovalPolicy` (
  `id` VARCHAR(191) NOT NULL, `code` VARCHAR(100) NOT NULL, `activeVersionId` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`), UNIQUE INDEX `ApprovalPolicy_code_key` (`code`), UNIQUE INDEX `ApprovalPolicy_activeVersionId_key` (`activeVersionId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ApprovalPolicyVersion` (
  `id` VARCHAR(191) NOT NULL, `policyId` VARCHAR(191) NOT NULL, `version` INTEGER NOT NULL,
  `definition` JSON NOT NULL, `definitionHash` CHAR(64) NOT NULL, `effectiveFrom` DATETIME(3) NOT NULL,
  `effectiveTo` DATETIME(3) NULL, `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), PRIMARY KEY (`id`),
  UNIQUE INDEX `ApprovalPolicyVersion_policy_version_key` (`policyId`,`version`),
  CONSTRAINT `ApprovalPolicyVersion_policyId_fkey` FOREIGN KEY (`policyId`) REFERENCES `ApprovalPolicy`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `ApprovalPolicy` ADD CONSTRAINT `ApprovalPolicy_activeVersionId_fkey` FOREIGN KEY (`activeVersionId`) REFERENCES `ApprovalPolicyVersion`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE `ApprovalAuthorityGrant` (
  `id` VARCHAR(191) NOT NULL, `roleCode` VARCHAR(100) NOT NULL, `permissionCode` VARCHAR(191) NOT NULL,
  `organizationUnitId` VARCHAR(191) NULL, `customerSegment` VARCHAR(100) NULL, `maximumAmount` DECIMAL(19,4) NOT NULL,
  `active` BOOLEAN NOT NULL DEFAULT true, `effectiveFrom` DATETIME(3) NOT NULL, `effectiveTo` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), PRIMARY KEY (`id`),
  INDEX `ApprovalAuthorityGrant_role_permission_active_idx` (`roleCode`,`permissionCode`,`active`,`effectiveFrom`,`effectiveTo`),
  INDEX `ApprovalAuthorityGrant_org_segment_idx` (`organizationUnitId`,`customerSegment`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ApprovalRequest` (
  `id` VARCHAR(191) NOT NULL, `quoteVersionId` VARCHAR(191) NOT NULL, `policyVersionId` VARCHAR(191) NOT NULL,
  `makerId` VARCHAR(191) NOT NULL, `status` ENUM('PENDING','PENDING_ESCALATION','APPROVED','REJECTED','RETURNED','CANCELLED','EXPIRED','SUPERSEDED') NOT NULL DEFAULT 'PENDING',
  `version` INTEGER NOT NULL DEFAULT 1, `inputSnapshot` JSON NOT NULL, `quoteVersionHash` CHAR(64) NOT NULL,
  `submittedAt` DATETIME(3) NOT NULL, `completedAt` DATETIME(3) NULL, `supersededAt` DATETIME(3) NULL, PRIMARY KEY (`id`),
  INDEX `ApprovalRequest_quote_status_idx` (`quoteVersionId`,`status`), INDEX `ApprovalRequest_maker_submitted_idx` (`makerId`,`submittedAt`),
  CONSTRAINT `ApprovalRequest_quoteVersionId_fkey` FOREIGN KEY (`quoteVersionId`) REFERENCES `QuoteVersion`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `ApprovalRequest_policyVersionId_fkey` FOREIGN KEY (`policyVersionId`) REFERENCES `ApprovalPolicyVersion`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `ApprovalRequest_makerId_fkey` FOREIGN KEY (`makerId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ApprovalStep` (
  `id` VARCHAR(191) NOT NULL, `requestId` VARCHAR(191) NOT NULL, `stepCode` VARCHAR(100) NOT NULL, `sequence` INTEGER NOT NULL,
  `executionMode` VARCHAR(32) NOT NULL, `requiredPermission` VARCHAR(191) NOT NULL, `assignedRoleCode` VARCHAR(100) NULL,
  `delegatedToActorId` VARCHAR(191) NULL,
  `minimumAuthority` DECIMAL(19,4) NULL, `maximumAuthority` DECIMAL(19,4) NULL, `makerChecker` BOOLEAN NOT NULL DEFAULT true,
  `status` ENUM('WAITING','PENDING','APPROVED','REJECTED','RETURNED','DELEGATED','ESCALATED','SKIPPED') NOT NULL DEFAULT 'WAITING',
  `dueAt` DATETIME(3) NULL, PRIMARY KEY (`id`), UNIQUE INDEX `ApprovalStep_request_code_key` (`requestId`,`stepCode`),
  INDEX `ApprovalStep_request_sequence_status_idx` (`requestId`,`sequence`,`status`),
  CONSTRAINT `ApprovalStep_requestId_fkey` FOREIGN KEY (`requestId`) REFERENCES `ApprovalRequest`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ApprovalDecision` (
  `id` VARCHAR(191) NOT NULL, `requestId` VARCHAR(191) NOT NULL, `stepId` VARCHAR(191) NOT NULL, `actorId` VARCHAR(191) NOT NULL,
  `delegateToActorId` VARCHAR(191) NULL,
  `decision` VARCHAR(32) NOT NULL, `reason` VARCHAR(1000) NOT NULL, `authoritySnapshot` JSON NOT NULL,
  `policyInputSnapshot` JSON NOT NULL, `previousHash` CHAR(64) NOT NULL, `decisionHash` CHAR(64) NOT NULL,
  `correlationId` VARCHAR(191) NOT NULL, `decidedAt` DATETIME(3) NOT NULL, PRIMARY KEY (`id`),
  INDEX `ApprovalDecision_request_time_idx` (`requestId`,`decidedAt`), INDEX `ApprovalDecision_actor_time_idx` (`actorId`,`decidedAt`),
  CONSTRAINT `ApprovalDecision_requestId_fkey` FOREIGN KEY (`requestId`) REFERENCES `ApprovalRequest`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `ApprovalDecision_stepId_fkey` FOREIGN KEY (`stepId`) REFERENCES `ApprovalStep`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `ApprovalDecision_actorId_fkey` FOREIGN KEY (`actorId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `CommercialCommandReceipt` (
  `id` VARCHAR(191) NOT NULL, `actorId` VARCHAR(191) NOT NULL, `idempotencyKey` VARCHAR(191) NOT NULL,
  `command` VARCHAR(100) NOT NULL, `targetId` VARCHAR(191) NOT NULL, `resultVersion` INTEGER NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), PRIMARY KEY (`id`),
  UNIQUE INDEX `CommercialCommandReceipt_actor_key_command_key` (`actorId`,`idempotencyKey`,`command`), INDEX `CommercialCommandReceipt_target_created_idx` (`targetId`,`createdAt`),
  CONSTRAINT `CommercialCommandReceipt_actorId_fkey` FOREIGN KEY (`actorId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ForecastSnapshot` (
  `id` VARCHAR(191) NOT NULL, `snapshotKey` VARCHAR(191) NOT NULL, `periodStart` DATETIME(3) NOT NULL,
  `periodEnd` DATETIME(3) NOT NULL, `cutoffAt` DATETIME(3) NOT NULL, `timezone` VARCHAR(64) NOT NULL,
  `formulaVersion` VARCHAR(64) NOT NULL, `scopeSnapshot` JSON NOT NULL, `currency` CHAR(3) NOT NULL DEFAULT 'THB',
  `pipelineAmount` DECIMAL(19,4) NOT NULL, `weightedAmount` DECIMAL(19,4) NOT NULL, `qualitySnapshot` JSON NOT NULL,
  `createdById` VARCHAR(191) NOT NULL, `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), PRIMARY KEY (`id`),
  UNIQUE INDEX `ForecastSnapshot_snapshotKey_key` (`snapshotKey`), INDEX `ForecastSnapshot_period_cutoff_idx` (`periodStart`,`periodEnd`,`cutoffAt`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ForecastItem` (
  `id` VARCHAR(191) NOT NULL, `snapshotId` VARCHAR(191) NOT NULL, `opportunityId` VARCHAR(191) NOT NULL,
  `opportunityVersion` INTEGER NOT NULL, `ownerId` VARCHAR(191) NOT NULL, `organizationUnitId` VARCHAR(191) NULL,
  `customerId` VARCHAR(191) NOT NULL, `segment` VARCHAR(100) NOT NULL, `flow` VARCHAR(191) NOT NULL,
  `stage` ENUM('QUALIFY','DISCOVER','SOLUTION','PROPOSAL','NEGOTIATION','WON','LOST','CANCELLED') NOT NULL,
  `category` ENUM('COMMIT','BEST_CASE','PIPELINE','OMITTED') NOT NULL, `estimatedValue` DECIMAL(19,4) NOT NULL,
  `forecastAmount` DECIMAL(19,4) NOT NULL, `weightedAmount` DECIMAL(19,4) NOT NULL, `probability` INTEGER NOT NULL,
  `amountSource` VARCHAR(32) NOT NULL, `sourceQuoteVersionId` VARCHAR(191) NULL, `expectedCloseAt` DATETIME(3) NULL,
  `stageEnteredAt` DATETIME(3) NOT NULL, `riskSnapshot` JSON NOT NULL, `qualitySnapshot` JSON NOT NULL, PRIMARY KEY (`id`),
  UNIQUE INDEX `ForecastItem_snapshot_opportunity_key` (`snapshotId`,`opportunityId`),
  INDEX `ForecastItem_rollup_idx` (`snapshotId`,`organizationUnitId`,`ownerId`,`stage`,`category`),
  CONSTRAINT `ForecastItem_snapshotId_fkey` FOREIGN KEY (`snapshotId`) REFERENCES `ForecastSnapshot`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `ForecastItem_opportunityId_fkey` FOREIGN KEY (`opportunityId`) REFERENCES `Opportunity`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Backfill governed immutable versions for legacy quotes without changing the
-- legacy Quote/QuoteItem read path.
INSERT INTO `QuoteVersion` (`id`,`quoteId`,`versionNumber`,`status`,`currency`,`subtotal`,`discountAmount`,`total`,`totalCost`,`grossMarginAmount`,`grossMarginPct`,`policyInputSnapshot`,`coverageSnapshot`,`solutionSnapshot`,`validUntil`,`notes`,`submittedAt`,`acceptedAt`,`createdAt`)
SELECT CONCAT('qv_',SHA2(q.`id`,256)), q.`id`, 1,
  CASE q.`status` WHEN 'APPROVED' THEN 'APPROVED' WHEN 'REJECTED' THEN 'REJECTED' WHEN 'SENT' THEN 'SENT' WHEN 'ACCEPTED' THEN 'ACCEPTED' ELSE 'DRAFT' END,
  'THB', q.`subtotal`, q.`discountValue`, q.`total`, 0, q.`total`, CASE WHEN q.`total`=0 THEN 0 ELSE 100 END,
  JSON_OBJECT('legacyBackfill',true), JSON_OBJECT('legacyBackfill',true), JSON_OBJECT('legacyBackfill',true), q.`validUntil`, q.`notes`,
  CASE WHEN q.`status` IN ('PENDING_APPROVAL','APPROVED','REJECTED','SENT','ACCEPTED') THEN q.`updatedAt` ELSE NULL END,
  CASE WHEN q.`status`='ACCEPTED' THEN q.`updatedAt` ELSE NULL END, q.`createdAt`
FROM `Quote` q;

INSERT INTO `QuoteVersionItem` (`id`,`quoteVersionId`,`productId`,`productCode`,`productName`,`quantity`,`unitPrice`,`discountAmount`,`unitCost`,`lineSubtotal`,`lineTotal`,`lineCost`,`marginAmount`,`createdAt`)
SELECT CONCAT('qvi_',SHA2(qi.`id`,256)), CONCAT('qv_',SHA2(qi.`quoteId`,256)), qi.`productId`, p.`code`, p.`name`, qi.`quantity`, qi.`unitPrice`, 0, 0,
  qi.`quantity`*qi.`unitPrice`, qi.`quantity`*qi.`unitPrice`, 0, qi.`quantity`*qi.`unitPrice`, qi.`createdAt`
FROM `QuoteItem` qi JOIN `Product` p ON p.`id`=qi.`productId`;

-- Versioned workflow configuration. Values are data and can be replaced by a
-- later policy version without changing application code.
INSERT INTO `OpportunityTransitionPolicyVersion` (`id`,`policyCode`,`version`,`command`,`fromStage`,`toStage`,`requiredFields`,`requiredPermission`,`active`,`effectiveFrom`,`createdAt`) VALUES
('otp_qualify_discover_v1','QUALIFY_DISCOVER',1,'FORWARD','QUALIFY','DISCOVER',JSON_ARRAY('qualificationResult','nextAction'),'opportunity.transition',true,UTC_TIMESTAMP(3),UTC_TIMESTAMP(3)),
('otp_discover_solution_v1','DISCOVER_SOLUTION',1,'FORWARD','DISCOVER','SOLUTION',JSON_ARRAY('requirements','stakeholderSummary','expectedCloseAt'),'opportunity.transition',true,UTC_TIMESTAMP(3),UTC_TIMESTAMP(3)),
('otp_solution_proposal_v1','SOLUTION_PROPOSAL',1,'FORWARD','SOLUTION','PROPOSAL',JSON_ARRAY('coverageConfirmed','solutionComplete'),'opportunity.transition',true,UTC_TIMESTAMP(3),UTC_TIMESTAMP(3)),
('otp_proposal_negotiation_v1','PROPOSAL_NEGOTIATION',1,'FORWARD','PROPOSAL','NEGOTIATION',JSON_ARRAY('quoteSubmitted','quoteApproved'),'opportunity.transition',true,UTC_TIMESTAMP(3),UTC_TIMESTAMP(3)),
('otp_negotiation_won_v1','NEGOTIATION_WON',1,'WON','NEGOTIATION','WON',JSON_ARRAY('quoteApproved','quoteAccepted','reason'),'opportunity.transition.won',true,UTC_TIMESTAMP(3),UTC_TIMESTAMP(3)),
('otp_lost_reopen_v1','LOST_REOPEN',1,'REOPEN','LOST','QUALIFY',JSON_ARRAY('reason','expectedCloseAt'),'opportunity.transition.reopen',true,UTC_TIMESTAMP(3),UTC_TIMESTAMP(3)),
('otp_won_reopen_v1','WON_REOPEN',1,'REOPEN','WON','NEGOTIATION',JSON_ARRAY('reason'),'opportunity.transition.reopen-won',true,UTC_TIMESTAMP(3),UTC_TIMESTAMP(3));

INSERT INTO `OpportunityTransitionPolicyVersion` (`id`,`policyCode`,`version`,`command`,`fromStage`,`toStage`,`requiredFields`,`requiredPermission`,`active`,`effectiveFrom`,`createdAt`) VALUES
('otp_discover_return_v1','DISCOVER_RETURN',1,'RETURN','DISCOVER','QUALIFY',JSON_ARRAY('reason'),'opportunity.transition',true,UTC_TIMESTAMP(3),UTC_TIMESTAMP(3)),
('otp_solution_return_v1','SOLUTION_RETURN',1,'RETURN','SOLUTION','DISCOVER',JSON_ARRAY('reason'),'opportunity.transition',true,UTC_TIMESTAMP(3),UTC_TIMESTAMP(3)),
('otp_proposal_return_v1','PROPOSAL_RETURN',1,'RETURN','PROPOSAL','SOLUTION',JSON_ARRAY('reason'),'opportunity.transition',true,UTC_TIMESTAMP(3),UTC_TIMESTAMP(3)),
('otp_negotiation_return_v1','NEGOTIATION_RETURN',1,'RETURN','NEGOTIATION','PROPOSAL',JSON_ARRAY('reason'),'opportunity.transition',true,UTC_TIMESTAMP(3),UTC_TIMESTAMP(3)),
('otp_qualify_lost_v1','QUALIFY_LOST',1,'LOST','QUALIFY','LOST',JSON_ARRAY('reason','lostReason','lostCategory'),'opportunity.transition',true,UTC_TIMESTAMP(3),UTC_TIMESTAMP(3)),
('otp_discover_lost_v1','DISCOVER_LOST',1,'LOST','DISCOVER','LOST',JSON_ARRAY('reason','lostReason','lostCategory'),'opportunity.transition',true,UTC_TIMESTAMP(3),UTC_TIMESTAMP(3)),
('otp_solution_lost_v1','SOLUTION_LOST',1,'LOST','SOLUTION','LOST',JSON_ARRAY('reason','lostReason','lostCategory'),'opportunity.transition',true,UTC_TIMESTAMP(3),UTC_TIMESTAMP(3)),
('otp_proposal_lost_v1','PROPOSAL_LOST',1,'LOST','PROPOSAL','LOST',JSON_ARRAY('reason','lostReason','lostCategory'),'opportunity.transition',true,UTC_TIMESTAMP(3),UTC_TIMESTAMP(3)),
('otp_negotiation_lost_v1','NEGOTIATION_LOST',1,'LOST','NEGOTIATION','LOST',JSON_ARRAY('reason','lostReason','lostCategory'),'opportunity.transition',true,UTC_TIMESTAMP(3),UTC_TIMESTAMP(3)),
('otp_qualify_cancel_v1','QUALIFY_CANCEL',1,'CANCEL','QUALIFY','CANCELLED',JSON_ARRAY('reason'),'opportunity.transition',true,UTC_TIMESTAMP(3),UTC_TIMESTAMP(3)),
('otp_discover_cancel_v1','DISCOVER_CANCEL',1,'CANCEL','DISCOVER','CANCELLED',JSON_ARRAY('reason'),'opportunity.transition',true,UTC_TIMESTAMP(3),UTC_TIMESTAMP(3)),
('otp_solution_cancel_v1','SOLUTION_CANCEL',1,'CANCEL','SOLUTION','CANCELLED',JSON_ARRAY('reason'),'opportunity.transition',true,UTC_TIMESTAMP(3),UTC_TIMESTAMP(3)),
('otp_proposal_cancel_v1','PROPOSAL_CANCEL',1,'CANCEL','PROPOSAL','CANCELLED',JSON_ARRAY('reason'),'opportunity.transition',true,UTC_TIMESTAMP(3),UTC_TIMESTAMP(3)),
('otp_negotiation_cancel_v1','NEGOTIATION_CANCEL',1,'CANCEL','NEGOTIATION','CANCELLED',JSON_ARRAY('reason'),'opportunity.transition',true,UTC_TIMESTAMP(3),UTC_TIMESTAMP(3));

INSERT INTO `RolePermissionGrant` (`id`,`roleCode`,`permissionCode`,`createdAt`) VALUES
('grant_opp_won_sales_director','SALES_DIRECTOR','opportunity.transition.won',UTC_TIMESTAMP(3)),
('grant_opp_reopen_manager','TEAM_MANAGER','opportunity.transition.reopen',UTC_TIMESTAMP(3)),
('grant_opp_reopen_sales_director','SALES_DIRECTOR','opportunity.transition.reopen',UTC_TIMESTAMP(3)),
('grant_opp_reopen_won_director','SALES_DIRECTOR','opportunity.transition.reopen-won',UTC_TIMESTAMP(3));

INSERT INTO `ApprovalPolicy` (`id`,`code`,`createdAt`,`updatedAt`) VALUES ('approval_default','COMMERCIAL_DEFAULT',UTC_TIMESTAMP(3),UTC_TIMESTAMP(3));
INSERT INTO `ApprovalPolicyVersion` (`id`,`policyId`,`version`,`definition`,`definitionHash`,`effectiveFrom`,`createdAt`) VALUES
('approval_default_v1','approval_default',1,
 JSON_OBJECT(
  'submissionGates',JSON_OBJECT('coverageRequired',false,'solutionRequired',true,'confirmedCostRequired',true),
  'rules',JSON_ARRAY(
    JSON_OBJECT('code','T3','when',JSON_ARRAY(JSON_OBJECT('field','total','operator','GT','value','100000000')),'steps',JSON_ARRAY(JSON_OBJECT('code','commercial-committee','sequence',1,'executionMode','SEQUENTIAL','requiredPermission','approval.committee','assignedRoleCode','COMMERCIAL_COMMITTEE','maximumAuthority','999999999999999.9999','makerChecker',true,'slaHours',24))),
    JSON_OBJECT('code','T2','when',JSON_ARRAY(JSON_OBJECT('field','total','operator','GT','value','10000000'),JSON_OBJECT('field','total','operator','LTE','value','100000000')),'steps',JSON_ARRAY(JSON_OBJECT('code','sales-director','sequence',1,'executionMode','PARALLEL','requiredPermission','approval.sales-director','assignedRoleCode','SALES_DIRECTOR','maximumAuthority','100000000','makerChecker',true,'slaHours',24),JSON_OBJECT('code','pricing','sequence',1,'executionMode','PARALLEL','requiredPermission','approval.pricing','assignedRoleCode','PRICING_APPROVER','maximumAuthority','100000000','makerChecker',true,'slaHours',24))),
    JSON_OBJECT('code','EXCEPTIONAL_DISCOUNT','when',JSON_ARRAY(JSON_OBJECT('field','discountPct','operator','GT','value','10')),'steps',JSON_ARRAY(JSON_OBJECT('code','pricing-exception','sequence',2,'executionMode','SEQUENTIAL','requiredPermission','approval.pricing-exception','assignedRoleCode','PRICING_APPROVER','maximumAuthority','100000000','makerChecker',true,'slaHours',12)))
  ),
  'fallbackSteps',JSON_ARRAY(JSON_OBJECT('code','team-manager','sequence',1,'executionMode','SEQUENTIAL','requiredPermission','approval.team-manager','assignedRoleCode','TEAM_MANAGER','maximumAuthority','10000000','makerChecker',true,'slaHours',24))
 ), REPEAT('0',64), UTC_TIMESTAMP(3), UTC_TIMESTAMP(3));
UPDATE `ApprovalPolicyVersion` SET `definitionHash`=SHA2(CAST(`definition` AS CHAR),256) WHERE `id`='approval_default_v1';
UPDATE `ApprovalPolicy` SET `activeVersionId`='approval_default_v1' WHERE `id`='approval_default';

INSERT INTO `ApprovalAuthorityGrant` (`id`,`roleCode`,`permissionCode`,`maximumAmount`,`active`,`effectiveFrom`,`createdAt`) VALUES
('auth_team_manager_v1','TEAM_MANAGER','approval.team-manager',10000000,true,UTC_TIMESTAMP(3),UTC_TIMESTAMP(3)),
('auth_sales_director_v1','SALES_DIRECTOR','approval.sales-director',100000000,true,UTC_TIMESTAMP(3),UTC_TIMESTAMP(3)),
('auth_pricing_v1','PRICING_APPROVER','approval.pricing',100000000,true,UTC_TIMESTAMP(3),UTC_TIMESTAMP(3)),
('auth_pricing_exception_v1','PRICING_APPROVER','approval.pricing-exception',100000000,true,UTC_TIMESTAMP(3),UTC_TIMESTAMP(3)),
('auth_committee_v1','COMMERCIAL_COMMITTEE','approval.committee',999999999999999.9999,true,UTC_TIMESTAMP(3),UTC_TIMESTAMP(3));
