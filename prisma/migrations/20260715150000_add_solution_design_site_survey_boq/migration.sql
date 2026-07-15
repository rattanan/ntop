-- Recovery note: Product/SolutionDesign alters and PresalesNumberSequence were
-- committed by MariaDB before the original query 4 failed. This forward-only
-- continuation intentionally starts with the first unapplied statement.

CREATE TABLE IF NOT EXISTS `ServiceCategoryConfig` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(100) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `requiresSiteSurvey` BOOLEAN NOT NULL DEFAULT false,
    `requiresBoq` BOOLEAN NOT NULL DEFAULT false,
    `requiresPhysicalInstallation` BOOLEAN NOT NULL DEFAULT false,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `displayOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updatedAt` DATETIME NOT NULL,

    UNIQUE INDEX `ServiceCategoryConfig_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `SolutionStatusDefinition` (
    `id` VARCHAR(191) NOT NULL,
    `entityType` VARCHAR(32) NOT NULL DEFAULT 'SOLUTION_DESIGN',
    `code` VARCHAR(64) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `displayOrder` INTEGER NOT NULL,
    `requiredFields` LONGTEXT NOT NULL,
    `requiredChecklistItems` LONGTEXT NOT NULL,
    `requiredApprovals` LONGTEXT NOT NULL,
    `expectedDurationHours` INTEGER NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `closed` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updatedAt` DATETIME NOT NULL,

    INDEX `SolutionStatusDefinition_entityType_active_displayOrder_idx`(`entityType`, `active`, `displayOrder`),
    UNIQUE INDEX `SolutionStatusDefinition_entityType_code_key`(`entityType`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `SolutionStatusTransition` (
    `id` VARCHAR(191) NOT NULL,
    `entityType` VARCHAR(32) NOT NULL DEFAULT 'SOLUTION_DESIGN',
    `fromStatusCode` VARCHAR(64) NOT NULL,
    `toStatusCode` VARCHAR(64) NOT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    INDEX `SolutionStatusTransition_entityType_fromStatusCode_active_idx`(`entityType`, `fromStatusCode`, `active`),
    UNIQUE INDEX `SolutionStatusTransition_entityType_fromStatusCode_toStatusC_key`(`entityType`, `fromStatusCode`, `toStatusCode`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `SolutionDesignVersion` (
    `id` VARCHAR(191) NOT NULL,
    `solutionDesignId` VARCHAR(191) NOT NULL,
    `version` INTEGER NOT NULL,
    `revisionNumber` INTEGER NOT NULL,
    `statusCode` VARCHAR(64) NOT NULL,
    `snapshot` LONGTEXT NOT NULL,
    `changeReason` VARCHAR(1000) NULL,
    `createdById` VARCHAR(191) NOT NULL,
    `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    INDEX `SolutionDesignVersion_solutionDesignId_createdAt_idx`(`solutionDesignId`, `createdAt`),
    UNIQUE INDEX `SolutionDesignVersion_solutionDesignId_version_revisionNumbe_key`(`solutionDesignId`, `version`, `revisionNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `SolutionServiceItem` (
    `id` VARCHAR(191) NOT NULL,
    `solutionDesignId` VARCHAR(191) NOT NULL,
    `serviceCategoryId` VARCHAR(191) NOT NULL,
    `productId` VARCHAR(191) NULL,
    `quantity` DECIMAL(19, 4) NOT NULL DEFAULT 1,
    `requestedBandwidth` VARCHAR(100) NULL,
    `accessTechnology` VARCHAR(100) NULL,
    `serviceLevel` VARCHAR(100) NULL,
    `contractMonths` INTEGER NULL,
    `installationSiteId` VARCHAR(191) NULL,
    `destinationSiteId` VARCHAR(191) NULL,
    `redundancyRequirement` VARCHAR(191) NULL,
    `estimatedOneTimeCharge` DECIMAL(19, 4) NULL,
    `estimatedRecurringCharge` DECIMAL(19, 4) NULL,
    `surveyRequired` BOOLEAN NOT NULL,
    `boqRequired` BOOLEAN NOT NULL,
    `physicalInstallationRequired` BOOLEAN NOT NULL,
    `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updatedAt` DATETIME NOT NULL,

    INDEX `SolutionServiceItem_solutionDesignId_serviceCategoryId_idx`(`solutionDesignId`, `serviceCategoryId`),
    INDEX `SolutionServiceItem_productId_idx`(`productId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `SolutionInstallationSite` (
    `id` VARCHAR(191) NOT NULL,
    `solutionDesignId` VARCHAR(191) NOT NULL,
    `opportunityId` VARCHAR(191) NOT NULL,
    `siteCode` VARCHAR(64) NULL,
    `siteName` VARCHAR(255) NOT NULL,
    `siteType` VARCHAR(100) NULL,
    `accountId` VARCHAR(191) NOT NULL,
    `branchName` VARCHAR(255) NULL,
    `buildingName` VARCHAR(255) NULL,
    `floor` VARCHAR(100) NULL,
    `room` VARCHAR(100) NULL,
    `addressLine1` VARCHAR(500) NOT NULL,
    `addressLine2` VARCHAR(500) NULL,
    `subdistrict` VARCHAR(191) NULL,
    `district` VARCHAR(191) NOT NULL,
    `province` VARCHAR(191) NOT NULL,
    `postalCode` VARCHAR(20) NULL,
    `country` CHAR(2) NOT NULL DEFAULT 'TH',
    `latitude` DECIMAL(10, 7) NOT NULL,
    `longitude` DECIMAL(10, 7) NOT NULL,
    `gpsAccuracy` DECIMAL(10, 2) NULL,
    `landmark` VARCHAR(500) NULL,
    `accessInstructions` TEXT NULL,
    `operatingHours` VARCHAR(255) NULL,
    `restrictedAccess` BOOLEAN NOT NULL DEFAULT false,
    `securityRequirements` TEXT NULL,
    `rackAvailable` BOOLEAN NULL,
    `rackSpaceAvailable` VARCHAR(100) NULL,
    `powerAvailable` BOOLEAN NULL,
    `groundingAvailable` BOOLEAN NULL,
    `airConditioningAvailable` BOOLEAN NULL,
    `existingNetwork` BOOLEAN NULL,
    `existingProvider` VARCHAR(255) NULL,
    `existingCircuitInfo` TEXT NULL,
    `notes` TEXT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updatedAt` DATETIME NOT NULL,

    INDEX `SolutionInstallationSite_opportunityId_active_idx`(`opportunityId`, `active`),
    INDEX `SolutionInstallationSite_accountId_active_idx`(`accountId`, `active`),
    UNIQUE INDEX `SolutionInstallationSite_solutionDesignId_siteCode_key`(`solutionDesignId`, `siteCode`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `SolutionComponent` (
    `id` VARCHAR(191) NOT NULL,
    `solutionDesignId` VARCHAR(191) NOT NULL,
    `componentNumber` VARCHAR(64) NOT NULL,
    `componentName` VARCHAR(255) NOT NULL,
    `componentType` VARCHAR(100) NOT NULL,
    `serviceCategoryId` VARCHAR(191) NULL,
    `description` TEXT NULL,
    `sourceSiteId` VARCHAR(191) NULL,
    `destinationSiteId` VARCHAR(191) NULL,
    `bandwidth` VARCHAR(100) NULL,
    `accessTechnology` VARCHAR(100) NULL,
    `redundancyType` VARCHAR(100) NULL,
    `quantity` DECIMAL(19, 4) NOT NULL DEFAULT 1,
    `unit` VARCHAR(32) NOT NULL DEFAULT 'EA',
    `productId` VARCHAR(191) NULL,
    `dependsOnComponentId` VARCHAR(191) NULL,
    `implementationSequence` INTEGER NULL,
    `surveyRequired` BOOLEAN NOT NULL DEFAULT false,
    `boqRequired` BOOLEAN NOT NULL DEFAULT false,
    `technicalStatus` VARCHAR(64) NOT NULL DEFAULT 'NOT_ASSESSED',
    `commercialStatus` VARCHAR(64) NOT NULL DEFAULT 'NOT_ASSESSED',
    `estimatedCost` DECIMAL(19, 4) NULL,
    `estimatedPrice` DECIMAL(19, 4) NULL,
    `notes` TEXT NULL,
    `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updatedAt` DATETIME NOT NULL,

    INDEX `SolutionComponent_solutionDesignId_implementationSequence_idx`(`solutionDesignId`, `implementationSequence`),
    UNIQUE INDEX `SolutionComponent_solutionDesignId_componentNumber_key`(`solutionDesignId`, `componentNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `SolutionNetworkConnection` (
    `id` VARCHAR(191) NOT NULL,
    `solutionDesignId` VARCHAR(191) NOT NULL,
    `connectionNumber` VARCHAR(64) NOT NULL,
    `sourceSiteId` VARCHAR(191) NOT NULL,
    `destinationSiteId` VARCHAR(191) NULL,
    `connectionType` VARCHAR(100) NOT NULL,
    `serviceCategoryId` VARCHAR(191) NULL,
    `topologyType` VARCHAR(100) NOT NULL,
    `primaryBandwidth` VARCHAR(100) NULL,
    `backupBandwidth` VARCHAR(100) NULL,
    `primaryAccessTechnology` VARCHAR(100) NULL,
    `backupAccessTechnology` VARCHAR(100) NULL,
    `redundancyMode` VARCHAR(100) NULL,
    `sla` VARCHAR(100) NULL,
    `surveyRequired` BOOLEAN NOT NULL DEFAULT false,
    `feasibilityStatus` VARCHAR(64) NOT NULL DEFAULT 'NOT_ASSESSED',
    `notes` TEXT NULL,
    `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updatedAt` DATETIME NOT NULL,

    INDEX `SolutionNetworkConnection_sourceSiteId_destinationSiteId_idx`(`sourceSiteId`, `destinationSiteId`),
    UNIQUE INDEX `SolutionNetworkConnection_solutionDesignId_connectionNumber_key`(`solutionDesignId`, `connectionNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `SolutionRequirementMapping` (
    `id` VARCHAR(191) NOT NULL,
    `solutionDesignId` VARCHAR(191) NOT NULL,
    `requirementId` VARCHAR(191) NOT NULL,
    `solutionComponentId` VARCHAR(191) NULL,
    `surveyRequestId` VARCHAR(191) NULL,
    `boqLineItemId` VARCHAR(191) NULL,
    `coverageStatus` VARCHAR(64) NOT NULL DEFAULT 'REQUIRES_CLARIFICATION',
    `response` TEXT NULL,
    `gap` TEXT NULL,
    `notes` TEXT NULL,
    `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updatedAt` DATETIME NOT NULL,

    INDEX `SolutionRequirementMapping_requirementId_coverageStatus_idx`(`requirementId`, `coverageStatus`),
    UNIQUE INDEX `SolutionRequirementMapping_solutionDesignId_requirementId_so_key`(`solutionDesignId`, `requirementId`, `solutionComponentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `SolutionDesignRisk` (
    `id` VARCHAR(191) NOT NULL,
    `solutionDesignId` VARCHAR(191) NOT NULL,
    `recordType` VARCHAR(32) NOT NULL,
    `title` VARCHAR(255) NOT NULL,
    `category` VARCHAR(100) NULL,
    `description` TEXT NOT NULL,
    `probability` VARCHAR(32) NULL,
    `impact` VARCHAR(32) NULL,
    `severity` VARCHAR(32) NULL,
    `mitigation` TEXT NULL,
    `contingency` TEXT NULL,
    `ownerId` VARCHAR(191) NULL,
    `dueDate` DATETIME NULL,
    `status` VARCHAR(64) NOT NULL DEFAULT 'OPEN',
    `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updatedAt` DATETIME NOT NULL,

    INDEX `SolutionDesignRisk_solutionDesignId_recordType_status_idx`(`solutionDesignId`, `recordType`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `SiteSurveyRequest` (
    `id` VARCHAR(191) NOT NULL,
    `surveyRequestNumber` VARCHAR(32) NOT NULL,
    `solutionDesignId` VARCHAR(191) NOT NULL,
    `opportunityId` VARCHAR(191) NOT NULL,
    `installationSiteId` VARCHAR(191) NOT NULL,
    `requestedServiceId` VARCHAR(191) NOT NULL,
    `destinationSiteId` VARCHAR(191) NULL,
    `requestType` VARCHAR(64) NOT NULL DEFAULT 'NEW_INSTALLATION',
    `surveyType` VARCHAR(64) NOT NULL DEFAULT 'PHYSICAL_SITE',
    `statusCode` VARCHAR(64) NOT NULL DEFAULT 'DRAFT',
    `priority` VARCHAR(32) NOT NULL DEFAULT 'NORMAL',
    `surveyReason` VARCHAR(1000) NOT NULL,
    `requestedById` VARCHAR(191) NOT NULL,
    `assignedCoordinatorId` VARCHAR(191) NULL,
    `assignedSurveyTeamId` VARCHAR(191) NULL,
    `assignedSurveyEngineerId` VARCHAR(191) NULL,
    `requestedBandwidth` VARCHAR(100) NULL,
    `accessTechnologyPreference` VARCHAR(100) NULL,
    `redundancyRequirement` VARCHAR(191) NULL,
    `targetActivationDate` DATETIME NULL,
    `requestedSla` VARCHAR(100) NULL,
    `specialRequirements` TEXT NULL,
    `preferredSurveyDateFrom` DATETIME NULL,
    `preferredSurveyDateTo` DATETIME NULL,
    `scheduledSurveyDate` DATETIME NULL,
    `surveyStartedAt` DATETIME NULL,
    `surveyCompletedAt` DATETIME NULL,
    `resultSubmittedAt` DATETIME NULL,
    `resultApprovedAt` DATETIME NULL,
    `integrationStatus` VARCHAR(64) NOT NULL DEFAULT 'NOT_SUBMITTED',
    `integrationProvider` VARCHAR(64) NOT NULL DEFAULT 'MANUAL',
    `integrationMode` VARCHAR(32) NOT NULL DEFAULT 'MANUAL',
    `externalRequestId` VARCHAR(191) NULL,
    `externalReferenceNumber` VARCHAR(191) NULL,
    `lastIntegrationAttemptAt` DATETIME NULL,
    `lastIntegrationSuccessAt` DATETIME NULL,
    `integrationErrorCode` VARCHAR(100) NULL,
    `integrationErrorMessage` VARCHAR(1000) NULL,
    `requestPayloadVersion` VARCHAR(32) NOT NULL DEFAULT '1.0',
    `responsePayloadVersion` VARCHAR(32) NULL,
    `integrationCorrelationId` VARCHAR(191) NOT NULL,
    `integrationRetryCount` INTEGER NOT NULL DEFAULT 0,
    `requestPayloadSnapshot` LONGTEXT NULL,
    `version` INTEGER NOT NULL DEFAULT 1,
    `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updatedAt` DATETIME NOT NULL,

    UNIQUE INDEX `SiteSurveyRequest_surveyRequestNumber_key`(`surveyRequestNumber`),
    INDEX `SiteSurveyRequest_solutionDesignId_statusCode_idx`(`solutionDesignId`, `statusCode`),
    INDEX `SiteSurveyRequest_installationSiteId_statusCode_idx`(`installationSiteId`, `statusCode`),
    INDEX `SiteSurveyRequest_assignedSurveyEngineerId_statusCode_idx`(`assignedSurveyEngineerId`, `statusCode`),
    INDEX `SiteSurveyRequest_scheduledSurveyDate_statusCode_idx`(`scheduledSurveyDate`, `statusCode`),
    INDEX `SiteSurveyRequest_externalRequestId_idx`(`externalRequestId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `SiteSurveyContact` (
    `id` VARCHAR(191) NOT NULL,
    `siteSurveyRequestId` VARCHAR(191) NOT NULL,
    `contactId` VARCHAR(191) NULL,
    `fullName` VARCHAR(255) NOT NULL,
    `jobTitle` VARCHAR(191) NULL,
    `department` VARCHAR(191) NULL,
    `organization` VARCHAR(255) NULL,
    `phone` VARCHAR(100) NOT NULL,
    `email` VARCHAR(255) NULL,
    `preferredContactMethod` VARCHAR(100) NULL,
    `availableDate` DATETIME NULL,
    `availableTimeWindow` VARCHAR(191) NULL,
    `siteAccessRole` VARCHAR(100) NULL,
    `primaryContact` BOOLEAN NOT NULL DEFAULT false,
    `backupContact` BOOLEAN NOT NULL DEFAULT false,
    `notes` TEXT NULL,
    `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updatedAt` DATETIME NOT NULL,

    INDEX `SiteSurveyContact_siteSurveyRequestId_primaryContact_idx`(`siteSurveyRequestId`, `primaryContact`),
    INDEX `SiteSurveyContact_contactId_idx`(`contactId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `SiteSurveyResult` (
    `id` VARCHAR(191) NOT NULL,
    `siteSurveyRequestId` VARCHAR(191) NOT NULL,
    `revisionNumber` INTEGER NOT NULL DEFAULT 1,
    `statusCode` VARCHAR(64) NOT NULL DEFAULT 'DRAFT',
    `resultSource` VARCHAR(32) NOT NULL DEFAULT 'MANUAL',
    `surveyDate` DATETIME NOT NULL,
    `surveyTeam` VARCHAR(255) NULL,
    `surveyEngineer` VARCHAR(255) NULL,
    `customerContactPresent` VARCHAR(255) NULL,
    `weatherCondition` VARCHAR(100) NULL,
    `siteAccessibility` VARCHAR(100) NULL,
    `feasibilityStatus` VARCHAR(64) NOT NULL,
    `recommendedAccessTechnology` VARCHAR(100) NULL,
    `availableBandwidth` VARCHAR(100) NULL,
    `nearestNetworkNode` VARCHAR(255) NULL,
    `estimatedDistanceMeters` DECIMAL(19, 4) NULL,
    `estimatedLeadTimeDays` INTEGER NULL,
    `technicalSummary` TEXT NOT NULL,
    `findings` LONGTEXT NOT NULL,
    `measurements` LONGTEXT NOT NULL,
    `conditions` LONGTEXT NOT NULL,
    `risks` LONGTEXT NOT NULL,
    `customerActions` LONGTEXT NOT NULL,
    `submittedById` VARCHAR(191) NULL,
    `submittedAt` DATETIME NULL,
    `reviewedById` VARCHAR(191) NULL,
    `reviewedAt` DATETIME NULL,
    `decision` VARCHAR(32) NULL,
    `decisionReason` VARCHAR(1000) NULL,
    `responsePayloadSnapshot` LONGTEXT NULL,
    `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updatedAt` DATETIME NOT NULL,

    INDEX `SiteSurveyResult_siteSurveyRequestId_statusCode_idx`(`siteSurveyRequestId`, `statusCode`),
    UNIQUE INDEX `SiteSurveyResult_siteSurveyRequestId_revisionNumber_key`(`siteSurveyRequestId`, `revisionNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `SiteSurveyEstimatedItem` (
    `id` VARCHAR(191) NOT NULL,
    `siteSurveyResultId` VARCHAR(191) NOT NULL,
    `externalItemCode` VARCHAR(100) NULL,
    `itemType` VARCHAR(32) NOT NULL,
    `itemName` VARCHAR(255) NOT NULL,
    `description` TEXT NULL,
    `quantity` DECIMAL(19, 4) NOT NULL,
    `unit` VARCHAR(32) NOT NULL,
    `estimatedUnitCost` DECIMAL(19, 4) NULL,
    `estimatedTotalCost` DECIMAL(19, 4) NULL,
    `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updatedAt` DATETIME NOT NULL,

    INDEX `SiteSurveyEstimatedItem_siteSurveyResultId_itemType_idx`(`siteSurveyResultId`, `itemType`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `SiteSurveyIntegrationLog` (
    `id` VARCHAR(191) NOT NULL,
    `siteSurveyRequestId` VARCHAR(191) NOT NULL,
    `direction` VARCHAR(16) NOT NULL,
    `provider` VARCHAR(64) NOT NULL,
    `schemaVersion` VARCHAR(32) NOT NULL,
    `correlationId` VARCHAR(191) NOT NULL,
    `status` VARCHAR(64) NOT NULL,
    `payloadSnapshot` LONGTEXT NOT NULL,
    `errorCode` VARCHAR(100) NULL,
    `errorMessage` VARCHAR(1000) NULL,
    `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    INDEX `SiteSurveyIntegrationLog_siteSurveyRequestId_createdAt_idx`(`siteSurveyRequestId`, `createdAt`),
    INDEX `SiteSurveyIntegrationLog_correlationId_idx`(`correlationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `BoqHeader` (
    `id` VARCHAR(191) NOT NULL,
    `boqNumber` VARCHAR(32) NOT NULL,
    `opportunityId` VARCHAR(191) NOT NULL,
    `solutionDesignId` VARCHAR(191) NOT NULL,
    `siteSurveyRequestId` VARCHAR(191) NULL,
    `version` INTEGER NOT NULL DEFAULT 1,
    `revisionNumber` INTEGER NOT NULL DEFAULT 0,
    `statusCode` VARCHAR(64) NOT NULL DEFAULT 'DRAFT',
    `currency` CHAR(3) NOT NULL DEFAULT 'THB',
    `pricingDate` DATETIME NOT NULL,
    `validUntil` DATETIME NULL,
    `preparedById` VARCHAR(191) NOT NULL,
    `reviewedById` VARCHAR(191) NULL,
    `approvedById` VARCHAR(191) NULL,
    `changeReason` VARCHAR(1000) NULL,
    `totalOneTimeCost` DECIMAL(19, 4) NOT NULL DEFAULT 0,
    `totalOneTimePrice` DECIMAL(19, 4) NOT NULL DEFAULT 0,
    `monthlyRecurringCost` DECIMAL(19, 4) NOT NULL DEFAULT 0,
    `monthlyRecurringPrice` DECIMAL(19, 4) NOT NULL DEFAULT 0,
    `annualRecurringCost` DECIMAL(19, 4) NOT NULL DEFAULT 0,
    `annualRecurringPrice` DECIMAL(19, 4) NOT NULL DEFAULT 0,
    `totalContractValue` DECIMAL(19, 4) NOT NULL DEFAULT 0,
    `totalCost` DECIMAL(19, 4) NOT NULL DEFAULT 0,
    `grossProfit` DECIMAL(19, 4) NOT NULL DEFAULT 0,
    `grossMarginPercent` DECIMAL(7, 4) NOT NULL DEFAULT 0,
    `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updatedAt` DATETIME NOT NULL,

    UNIQUE INDEX `BoqHeader_boqNumber_key`(`boqNumber`),
    INDEX `BoqHeader_solutionDesignId_statusCode_idx`(`solutionDesignId`, `statusCode`),
    INDEX `BoqHeader_siteSurveyRequestId_statusCode_idx`(`siteSurveyRequestId`, `statusCode`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `BoqSection` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(100) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `displayOrder` INTEGER NOT NULL DEFAULT 0,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updatedAt` DATETIME NOT NULL,

    UNIQUE INDEX `BoqSection_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `BoqItem` (
    `id` VARCHAR(191) NOT NULL,
    `boqId` VARCHAR(191) NOT NULL,
    `lineNumber` INTEGER NOT NULL,
    `sectionId` VARCHAR(191) NOT NULL,
    `sourceType` VARCHAR(32) NOT NULL,
    `sourceReferenceId` VARCHAR(191) NULL,
    `productId` VARCHAR(191) NULL,
    `materialCode` VARCHAR(100) NULL,
    `itemName` VARCHAR(255) NOT NULL,
    `description` TEXT NULL,
    `specification` TEXT NULL,
    `quantity` DECIMAL(19, 4) NOT NULL,
    `unit` VARCHAR(32) NOT NULL,
    `wastagePercent` DECIMAL(7, 4) NOT NULL DEFAULT 0,
    `finalQuantity` DECIMAL(19, 4) NOT NULL,
    `listPrice` DECIMAL(19, 4) NULL,
    `unitCost` DECIMAL(19, 4) NOT NULL DEFAULT 0,
    `unitSellingPrice` DECIMAL(19, 4) NOT NULL DEFAULT 0,
    `totalCost` DECIMAL(19, 4) NOT NULL DEFAULT 0,
    `totalSellingPrice` DECIMAL(19, 4) NOT NULL DEFAULT 0,
    `discountPercent` DECIMAL(7, 4) NOT NULL DEFAULT 0,
    `grossProfit` DECIMAL(19, 4) NOT NULL DEFAULT 0,
    `grossMarginPercent` DECIMAL(7, 4) NOT NULL DEFAULT 0,
    `chargeType` VARCHAR(32) NOT NULL DEFAULT 'ONE_TIME',
    `billingFrequency` VARCHAR(32) NULL,
    `contractMonths` INTEGER NULL,
    `installationSiteId` VARCHAR(191) NULL,
    `leadTimeDays` INTEGER NULL,
    `remarks` TEXT NULL,
    `optional` BOOLEAN NOT NULL DEFAULT false,
    `customerProvided` BOOLEAN NOT NULL DEFAULT false,
    `provisionalPricing` BOOLEAN NOT NULL DEFAULT false,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updatedAt` DATETIME NOT NULL,

    INDEX `BoqItem_boqId_sectionId_idx`(`boqId`, `sectionId`),
    INDEX `BoqItem_sourceType_sourceReferenceId_idx`(`sourceType`, `sourceReferenceId`),
    UNIQUE INDEX `BoqItem_boqId_lineNumber_key`(`boqId`, `lineNumber`),
    UNIQUE INDEX `BoqItem_boqId_sourceType_sourceReferenceId_key`(`boqId`, `sourceType`, `sourceReferenceId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `BoqVersion` (
    `id` VARCHAR(191) NOT NULL,
    `boqId` VARCHAR(191) NOT NULL,
    `version` INTEGER NOT NULL,
    `revisionNumber` INTEGER NOT NULL,
    `statusCode` VARCHAR(64) NOT NULL,
    `snapshot` LONGTEXT NOT NULL,
    `changeReason` VARCHAR(1000) NULL,
    `createdById` VARCHAR(191) NOT NULL,
    `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    INDEX `BoqVersion_boqId_createdAt_idx`(`boqId`, `createdAt`),
    UNIQUE INDEX `BoqVersion_boqId_version_revisionNumber_key`(`boqId`, `version`, `revisionNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `SolutionReviewDecision` (
    `id` VARCHAR(191) NOT NULL,
    `solutionDesignId` VARCHAR(191) NOT NULL,
    `reviewType` VARCHAR(32) NOT NULL,
    `decision` VARCHAR(32) NOT NULL,
    `reason` VARCHAR(1000) NOT NULL,
    `requestedById` VARCHAR(191) NOT NULL,
    `decidedById` VARCHAR(191) NOT NULL,
    `correlationId` VARCHAR(191) NOT NULL,
    `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    INDEX `SolutionReviewDecision_solutionDesignId_reviewType_createdAt_idx`(`solutionDesignId`, `reviewType`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;

-- Referential integrity is explicit even though the application keeps cross-module
-- access behind public service contracts.
-- MariaDB 5.5 requires identical collations on both sides of every varchar FK.
ALTER TABLE `ServiceCategoryConfig` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
ALTER TABLE `SolutionStatusDefinition` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
ALTER TABLE `SolutionStatusTransition` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
ALTER TABLE `SolutionDesignVersion` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
ALTER TABLE `SolutionServiceItem` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
ALTER TABLE `SolutionInstallationSite` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
ALTER TABLE `SolutionComponent` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
ALTER TABLE `SolutionNetworkConnection` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
ALTER TABLE `SolutionRequirementMapping` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
ALTER TABLE `SolutionDesignRisk` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
ALTER TABLE `SiteSurveyRequest` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
ALTER TABLE `SiteSurveyContact` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
ALTER TABLE `SiteSurveyResult` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
ALTER TABLE `SiteSurveyEstimatedItem` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
ALTER TABLE `SiteSurveyIntegrationLog` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
ALTER TABLE `BoqHeader` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
ALTER TABLE `BoqSection` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
ALTER TABLE `BoqItem` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
ALTER TABLE `BoqVersion` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
ALTER TABLE `SolutionReviewDecision` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
ALTER TABLE `SolutionDesignVersion` ADD CONSTRAINT `SolutionDesignVersion_solutionDesignId_fkey` FOREIGN KEY (`solutionDesignId`) REFERENCES `SolutionDesign`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `SolutionServiceItem`
  ADD CONSTRAINT `SolutionServiceItem_solutionDesignId_fkey` FOREIGN KEY (`solutionDesignId`) REFERENCES `SolutionDesign`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `SolutionServiceItem_serviceCategoryId_fkey` FOREIGN KEY (`serviceCategoryId`) REFERENCES `ServiceCategoryConfig`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `SolutionServiceItem_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `SolutionServiceItem_quantity_check` CHECK (`quantity` > 0);
ALTER TABLE `SolutionInstallationSite`
  ADD CONSTRAINT `SolutionInstallationSite_solutionDesignId_fkey` FOREIGN KEY (`solutionDesignId`) REFERENCES `SolutionDesign`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `SolutionInstallationSite_opportunityId_fkey` FOREIGN KEY (`opportunityId`) REFERENCES `Opportunity`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `SolutionInstallationSite_accountId_fkey` FOREIGN KEY (`accountId`) REFERENCES `Customer`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `SolutionInstallationSite_latitude_check` CHECK (`latitude` BETWEEN -90 AND 90),
  ADD CONSTRAINT `SolutionInstallationSite_longitude_check` CHECK (`longitude` BETWEEN -180 AND 180);
ALTER TABLE `SolutionComponent`
  ADD CONSTRAINT `SolutionComponent_solutionDesignId_fkey` FOREIGN KEY (`solutionDesignId`) REFERENCES `SolutionDesign`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `SolutionComponent_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `SolutionComponent_quantity_check` CHECK (`quantity` > 0);
ALTER TABLE `SolutionNetworkConnection`
  ADD CONSTRAINT `SolutionNetworkConnection_solutionDesignId_fkey` FOREIGN KEY (`solutionDesignId`) REFERENCES `SolutionDesign`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `SolutionNetworkConnection_sourceSiteId_fkey` FOREIGN KEY (`sourceSiteId`) REFERENCES `SolutionInstallationSite`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `SolutionNetworkConnection_destinationSiteId_fkey` FOREIGN KEY (`destinationSiteId`) REFERENCES `SolutionInstallationSite`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `SolutionRequirementMapping`
  ADD CONSTRAINT `SolutionRequirementMapping_solutionDesignId_fkey` FOREIGN KEY (`solutionDesignId`) REFERENCES `SolutionDesign`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `SolutionRequirementMapping_requirementId_fkey` FOREIGN KEY (`requirementId`) REFERENCES `OpportunityRequirement`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `SolutionDesignRisk` ADD CONSTRAINT `SolutionDesignRisk_solutionDesignId_fkey` FOREIGN KEY (`solutionDesignId`) REFERENCES `SolutionDesign`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `SiteSurveyRequest`
  ADD CONSTRAINT `SiteSurveyRequest_solutionDesignId_fkey` FOREIGN KEY (`solutionDesignId`) REFERENCES `SolutionDesign`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `SiteSurveyRequest_opportunityId_fkey` FOREIGN KEY (`opportunityId`) REFERENCES `Opportunity`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `SiteSurveyRequest_installationSiteId_fkey` FOREIGN KEY (`installationSiteId`) REFERENCES `SolutionInstallationSite`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `SiteSurveyRequest_requestedServiceId_fkey` FOREIGN KEY (`requestedServiceId`) REFERENCES `SolutionServiceItem`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `SiteSurveyContact`
  ADD CONSTRAINT `SiteSurveyContact_siteSurveyRequestId_fkey` FOREIGN KEY (`siteSurveyRequestId`) REFERENCES `SiteSurveyRequest`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `SiteSurveyContact_contactId_fkey` FOREIGN KEY (`contactId`) REFERENCES `Contact`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `SiteSurveyResult` ADD CONSTRAINT `SiteSurveyResult_siteSurveyRequestId_fkey` FOREIGN KEY (`siteSurveyRequestId`) REFERENCES `SiteSurveyRequest`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `SiteSurveyEstimatedItem`
  ADD CONSTRAINT `SiteSurveyEstimatedItem_siteSurveyResultId_fkey` FOREIGN KEY (`siteSurveyResultId`) REFERENCES `SiteSurveyResult`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `SiteSurveyEstimatedItem_quantity_check` CHECK (`quantity` > 0);
ALTER TABLE `SiteSurveyIntegrationLog` ADD CONSTRAINT `SiteSurveyIntegrationLog_siteSurveyRequestId_fkey` FOREIGN KEY (`siteSurveyRequestId`) REFERENCES `SiteSurveyRequest`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `BoqHeader`
  ADD CONSTRAINT `BoqHeader_opportunityId_fkey` FOREIGN KEY (`opportunityId`) REFERENCES `Opportunity`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `BoqHeader_solutionDesignId_fkey` FOREIGN KEY (`solutionDesignId`) REFERENCES `SolutionDesign`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `BoqHeader_siteSurveyRequestId_fkey` FOREIGN KEY (`siteSurveyRequestId`) REFERENCES `SiteSurveyRequest`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `BoqItem`
  ADD CONSTRAINT `BoqItem_boqId_fkey` FOREIGN KEY (`boqId`) REFERENCES `BoqHeader`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `BoqItem_sectionId_fkey` FOREIGN KEY (`sectionId`) REFERENCES `BoqSection`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `BoqItem_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `BoqItem_quantity_check` CHECK (`quantity` > 0),
  ADD CONSTRAINT `BoqItem_wastage_check` CHECK (`wastagePercent` >= 0);
ALTER TABLE `BoqVersion` ADD CONSTRAINT `BoqVersion_boqId_fkey` FOREIGN KEY (`boqId`) REFERENCES `BoqHeader`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `SolutionReviewDecision` ADD CONSTRAINT `SolutionReviewDecision_solutionDesignId_fkey` FOREIGN KEY (`solutionDesignId`) REFERENCES `SolutionDesign`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
