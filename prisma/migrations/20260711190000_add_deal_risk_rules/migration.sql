-- MySQL 8 production-target migration. Risk thresholds, scope and severity
-- remain versioned configuration; no stage, segment or threshold is hard-coded.
CREATE TABLE `DealRiskRule` (
  `id` VARCHAR(191) NOT NULL,
  `code` VARCHAR(100) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `DealRiskRule_code_key`(`code`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `DealRiskRuleVersion` (
  `id` VARCHAR(191) NOT NULL,
  `ruleId` VARCHAR(191) NOT NULL,
  `version` INTEGER NOT NULL,
  `riskType` VARCHAR(100) NOT NULL,
  `enabled` BOOLEAN NOT NULL DEFAULT false,
  `effectiveFrom` DATETIME(3) NOT NULL,
  `effectiveTo` DATETIME(3) NULL,
  `conditionConfig` JSON NOT NULL,
  `thresholdConfig` JSON NOT NULL,
  `scopeConfig` JSON NOT NULL,
  `severityConfig` JSON NOT NULL,
  `createdById` VARCHAR(191) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `DealRiskRuleVersion_ruleId_version_key`(`ruleId`, `version`),
  INDEX `DealRiskRuleVersion_ruleId_enabled_effectiveFrom_effectiveTo_idx`(`ruleId`, `enabled`, `effectiveFrom`, `effectiveTo`),
  INDEX `DealRiskRuleVersion_risk_effective_idx`(`riskType`, `enabled`, `effectiveFrom`, `effectiveTo`),
  PRIMARY KEY (`id`),
  CONSTRAINT `DealRiskRuleVersion_effective_period_chk` CHECK (`effectiveTo` IS NULL OR `effectiveTo` > `effectiveFrom`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `DealRiskSignal` (
  `id` VARCHAR(191) NOT NULL,
  `opportunityId` VARCHAR(191) NOT NULL,
  `ruleVersionId` VARCHAR(191) NOT NULL,
  `evaluationKey` VARCHAR(191) NOT NULL,
  `riskType` VARCHAR(100) NOT NULL,
  `thresholdSnapshot` JSON NOT NULL,
  `triggeringFacts` JSON NOT NULL,
  `severitySnapshot` JSON NOT NULL,
  `evaluatedAt` DATETIME(3) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `DealRiskSignal_opportunityId_ruleVersionId_evaluationKey_key`(`opportunityId`, `ruleVersionId`, `evaluationKey`),
  INDEX `DealRiskSignal_opportunityId_evaluatedAt_idx`(`opportunityId`, `evaluatedAt`),
  INDEX `DealRiskSignal_ruleVersionId_evaluatedAt_idx`(`ruleVersionId`, `evaluatedAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `DealRiskRuleVersion` ADD CONSTRAINT `DealRiskRuleVersion_ruleId_fkey`
  FOREIGN KEY (`ruleId`) REFERENCES `DealRiskRule`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `DealRiskRuleVersion` ADD CONSTRAINT `DealRiskRuleVersion_createdById_fkey`
  FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `DealRiskSignal` ADD CONSTRAINT `DealRiskSignal_opportunityId_fkey`
  FOREIGN KEY (`opportunityId`) REFERENCES `Opportunity`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `DealRiskSignal` ADD CONSTRAINT `DealRiskSignal_ruleVersionId_fkey`
  FOREIGN KEY (`ruleVersionId`) REFERENCES `DealRiskRuleVersion`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
