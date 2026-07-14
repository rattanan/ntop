-- MariaDB 5.5 compatibility addendum required by Pipeline deterministic risk.
-- JSON uses LONGTEXT and exact composite uniqueness uses trigger-maintained hashes.

CREATE TABLE `DealRiskRule` (
  `id` VARCHAR(191) NOT NULL, `code` VARCHAR(100) NOT NULL, `createdAt` DATETIME NOT NULL,
  PRIMARY KEY (`id`), UNIQUE KEY `DealRiskRule_code_key` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `DealRiskRuleVersion` (
  `id` VARCHAR(191) NOT NULL, `ruleId` VARCHAR(191) NOT NULL, `version` INTEGER NOT NULL,
  `riskType` VARCHAR(100) NOT NULL, `enabled` TINYINT(1) NOT NULL DEFAULT 0,
  `effectiveFrom` DATETIME NOT NULL, `effectiveTo` DATETIME NULL,
  `conditionConfig` LONGTEXT NOT NULL, `thresholdConfig` LONGTEXT NOT NULL,
  `scopeConfig` LONGTEXT NOT NULL, `severityConfig` LONGTEXT NOT NULL,
  `createdById` VARCHAR(191) NOT NULL, `createdAt` DATETIME NOT NULL, `versionHash` CHAR(64) NOT NULL,
  PRIMARY KEY (`id`), UNIQUE KEY `DRRV_rule_version_key` (`versionHash`),
  KEY `DRRV_rule_effective_idx` (`ruleId`(100),`enabled`,`effectiveFrom`,`effectiveTo`),
  KEY `DRRV_type_effective_idx` (`riskType`(64),`enabled`,`effectiveFrom`,`effectiveTo`),
  CONSTRAINT `DRRV_rule_fkey` FOREIGN KEY (`ruleId`) REFERENCES `DealRiskRule`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `DRRV_creator_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
CREATE TRIGGER `DRRV_hash_insert` BEFORE INSERT ON `DealRiskRuleVersion` FOR EACH ROW SET NEW.`versionHash`=SHA2(CONCAT(NEW.`ruleId`,'|',NEW.`version`),256);
CREATE TRIGGER `DRRV_hash_update` BEFORE UPDATE ON `DealRiskRuleVersion` FOR EACH ROW SET NEW.`versionHash`=SHA2(CONCAT(NEW.`ruleId`,'|',NEW.`version`),256);

CREATE TABLE `DealRiskSignal` (
  `id` VARCHAR(191) NOT NULL, `opportunityId` VARCHAR(191) NOT NULL, `ruleVersionId` VARCHAR(191) NOT NULL,
  `evaluationKey` VARCHAR(191) NOT NULL, `riskType` VARCHAR(100) NOT NULL,
  `thresholdSnapshot` LONGTEXT NOT NULL, `triggeringFacts` LONGTEXT NOT NULL, `severitySnapshot` LONGTEXT NOT NULL,
  `evaluatedAt` DATETIME NOT NULL, `createdAt` DATETIME NOT NULL, `signalHash` CHAR(64) NOT NULL,
  PRIMARY KEY (`id`), UNIQUE KEY `DRS_evaluation_key` (`signalHash`),
  KEY `DRS_opportunity_time_idx` (`opportunityId`(100),`evaluatedAt`), KEY `DRS_rule_time_idx` (`ruleVersionId`(100),`evaluatedAt`),
  CONSTRAINT `DRS_opportunity_fkey` FOREIGN KEY (`opportunityId`) REFERENCES `Opportunity`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `DRS_rule_version_fkey` FOREIGN KEY (`ruleVersionId`) REFERENCES `DealRiskRuleVersion`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
CREATE TRIGGER `DRS_hash_insert` BEFORE INSERT ON `DealRiskSignal` FOR EACH ROW SET NEW.`signalHash`=SHA2(CONCAT(NEW.`opportunityId`,'|',NEW.`ruleVersionId`,'|',NEW.`evaluationKey`),256);
CREATE TRIGGER `DRS_hash_update` BEFORE UPDATE ON `DealRiskSignal` FOR EACH ROW SET NEW.`signalHash`=SHA2(CONCAT(NEW.`opportunityId`,'|',NEW.`ruleVersionId`,'|',NEW.`evaluationKey`),256);

INSERT INTO `LegacySchemaMigration` (`id`,`appliedAt`) VALUES ('20260714083500_add_deal_risk_pipeline_dependency',UTC_TIMESTAMP());
