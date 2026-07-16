-- Idempotent preparation for both fresh MySQL 8 databases and environments
-- where the original Presales migration partially committed before recovery.

SET @product_alter = IF(
  EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'Product'
      AND COLUMN_NAME = 'serviceCategoryCode'
  ),
  'SELECT 1',
  'ALTER TABLE `Product`
    ADD COLUMN `serviceCategoryCode` VARCHAR(100) NULL,
    ADD COLUMN `requiresSiteSurvey` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `requiresBoq` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `requiresPhysicalInstallation` BOOLEAN NOT NULL DEFAULT false'
);
PREPARE product_statement FROM @product_alter;
EXECUTE product_statement;
DEALLOCATE PREPARE product_statement;

SET @solution_alter = IF(
  EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'SolutionDesign'
      AND COLUMN_NAME = 'statusCode'
  ),
  'SELECT 1',
  'ALTER TABLE `SolutionDesign`
    ADD COLUMN `solutionDesignNumber` VARCHAR(32) NULL,
    ADD COLUMN `solutionDesignName` VARCHAR(255) NULL,
    ADD COLUMN `statusCode` VARCHAR(64) NOT NULL DEFAULT ''DRAFT'',
    ADD COLUMN `version` INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN `revisionNumber` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `parentVersionId` VARCHAR(191) NULL,
    ADD COLUMN `designType` VARCHAR(100) NULL,
    ADD COLUMN `solutionCategory` VARCHAR(100) NULL,
    ADD COLUMN `description` TEXT NULL,
    ADD COLUMN `objective` TEXT NULL,
    ADD COLUMN `executiveSummary` TEXT NULL,
    ADD COLUMN `technicalSummary` TEXT NULL,
    ADD COLUMN `salesOwnerId` VARCHAR(191) NULL,
    ADD COLUMN `preSalesOwnerId` VARCHAR(191) NULL,
    ADD COLUMN `technicalApproverId` VARCHAR(191) NULL,
    ADD COLUMN `commercialOwnerId` VARCHAR(191) NULL,
    ADD COLUMN `surveyCoordinatorId` VARCHAR(191) NULL,
    ADD COLUMN `requestedDate` DATETIME(3) NULL,
    ADD COLUMN `targetDesignDate` DATETIME(3) NULL,
    ADD COLUMN `expectedProposalDate` DATETIME(3) NULL,
    ADD COLUMN `approvedDate` DATETIME(3) NULL,
    ADD COLUMN `requirementsCompleteness` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `technicalReadiness` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `boqReadiness` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `surveyReadiness` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `overallReadiness` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `technicalFeasibility` VARCHAR(64) NOT NULL DEFAULT ''NOT_ASSESSED'',
    ADD COLUMN `commercialFeasibility` VARCHAR(64) NOT NULL DEFAULT ''NOT_ASSESSED'',
    ADD COLUMN `implementationComplexity` VARCHAR(32) NOT NULL DEFAULT ''MEDIUM'',
    ADD COLUMN `riskLevel` VARCHAR(32) NOT NULL DEFAULT ''MEDIUM'',
    ADD COLUMN `surveyRequired` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `surveyRequirementReason` VARCHAR(1000) NULL,
    ADD COLUMN `surveyOverrideReason` VARCHAR(1000) NULL,
    ADD COLUMN `surveyOverrideById` VARCHAR(191) NULL,
    ADD COLUMN `surveyOverrideAt` DATETIME(3) NULL,
    ADD COLUMN `createdById` VARCHAR(191) NULL,
    ADD COLUMN `updatedById` VARCHAR(191) NULL,
    MODIFY `ntWorkValue` DECIMAL(19,4) NOT NULL DEFAULT 0,
    MODIFY `partnerCost` DECIMAL(19,4) NOT NULL DEFAULT 0,
    MODIFY `estimatedCost` DECIMAL(19,4) NOT NULL DEFAULT 0,
    MODIFY `estimatedPrice` DECIMAL(19,4) NOT NULL DEFAULT 0,
    MODIFY `marginPct` DECIMAL(7,4) NOT NULL DEFAULT 0'
);
PREPARE solution_statement FROM @solution_alter;
EXECUTE solution_statement;
DEALLOCATE PREPARE solution_statement;

CREATE TABLE IF NOT EXISTS `PresalesNumberSequence` (
  `id` VARCHAR(32) NOT NULL,
  `nextValue` INTEGER NOT NULL DEFAULT 0,
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

SET @solution_number_index = IF(
  EXISTS (
    SELECT 1 FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'SolutionDesign'
      AND INDEX_NAME = 'SolutionDesign_solutionDesignNumber_key'
  ),
  'SELECT 1',
  'CREATE UNIQUE INDEX `SolutionDesign_solutionDesignNumber_key` ON `SolutionDesign` (`solutionDesignNumber`)'
);
PREPARE solution_number_statement FROM @solution_number_index;
EXECUTE solution_number_statement;
DEALLOCATE PREPARE solution_number_statement;

SET @solution_owner_index = IF(
  EXISTS (
    SELECT 1 FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'SolutionDesign'
      AND INDEX_NAME = 'SolutionDesign_preSalesOwnerId_statusCode_idx'
  ),
  'SELECT 1',
  'CREATE INDEX `SolutionDesign_preSalesOwnerId_statusCode_idx` ON `SolutionDesign` (`preSalesOwnerId`, `statusCode`)'
);
PREPARE solution_owner_statement FROM @solution_owner_index;
EXECUTE solution_owner_statement;
DEALLOCATE PREPARE solution_owner_statement;

SET @solution_target_index = IF(
  EXISTS (
    SELECT 1 FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'SolutionDesign'
      AND INDEX_NAME = 'SolutionDesign_targetDesignDate_statusCode_idx'
  ),
  'SELECT 1',
  'CREATE INDEX `SolutionDesign_targetDesignDate_statusCode_idx` ON `SolutionDesign` (`targetDesignDate`, `statusCode`)'
);
PREPARE solution_target_statement FROM @solution_target_index;
EXECUTE solution_target_statement;
DEALLOCATE PREPARE solution_target_statement;
