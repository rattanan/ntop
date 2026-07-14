-- MariaDB 5.5 compatibility migration. Apply only after checking the marker.
ALTER TABLE `Opportunity`
  ADD COLUMN `opportunityNumber` VARCHAR(32) NULL,
  ADD COLUMN `probabilitySource` VARCHAR(32) NOT NULL DEFAULT 'STAGE_DEFAULT',
  ADD UNIQUE INDEX `Opportunity_opportunityNumber_key` (`opportunityNumber`);

SET @opportunity_sequence := 0;
UPDATE `Opportunity`
SET `opportunityNumber` = CONCAT('OPP-', YEAR(`createdAt`), '-', LPAD((@opportunity_sequence := @opportunity_sequence + 1), 6, '0'))
WHERE `opportunityNumber` IS NULL
ORDER BY `createdAt`, `id`;

CREATE TABLE `OpportunityNumberSequence` (
  `id` VARCHAR(32) NOT NULL,
  `nextValue` INTEGER NOT NULL DEFAULT 0,
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO `OpportunityNumberSequence` (`id`,`nextValue`,`updatedAt`)
SELECT CONCAT('OPP-', YEAR(UTC_TIMESTAMP())), COALESCE(MAX(CAST(RIGHT(`opportunityNumber`, 6) AS UNSIGNED)), 0), UTC_TIMESTAMP(3)
FROM `Opportunity`
WHERE `opportunityNumber` LIKE CONCAT('OPP-', YEAR(UTC_TIMESTAMP()), '-%');

CREATE TABLE `OpportunityProbabilityHistory` (
  `id` VARCHAR(191) NOT NULL,
  `opportunityId` VARCHAR(191) NOT NULL,
  `previousProbability` INTEGER NOT NULL,
  `newProbability` INTEGER NOT NULL,
  `reason` VARCHAR(1000) NOT NULL,
  `changedById` VARCHAR(191) NOT NULL,
  `aggregateVersion` INTEGER NOT NULL,
  `correlationId` VARCHAR(191) NOT NULL,
  `changedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `OpportunityProbabilityHistory_opportunity_version_key` (`opportunityId`,`aggregateVersion`),
  KEY `OpportunityProbabilityHistory_opportunity_time_idx` (`opportunityId`,`changedAt`),
  KEY `OpportunityProbabilityHistory_actor_time_idx` (`changedById`,`changedAt`),
  CONSTRAINT `OpportunityProbabilityHistory_opportunityId_fkey` FOREIGN KEY (`opportunityId`) REFERENCES `Opportunity`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `OpportunityProbabilityHistory_changedById_fkey` FOREIGN KEY (`changedById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
