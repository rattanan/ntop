CREATE TABLE IF NOT EXISTS `ActivityStatusDefinition` (
  `code` VARCHAR(32) NOT NULL,
  `label` VARCHAR(100) NOT NULL,
  `sortOrder` INTEGER NOT NULL,
  `reportingCategory` VARCHAR(32) NOT NULL,
  `terminal` BOOLEAN NOT NULL DEFAULT false,
  `active` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`code`),
  INDEX `ActivityStatusDefinition_active_sortOrder_idx` (`active`, `sortOrder`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `ActivityStatusTransition` (
  `id` VARCHAR(191) NOT NULL,
  `fromStatusCode` VARCHAR(32) NOT NULL,
  `toStatusCode` VARCHAR(32) NOT NULL,
  `requiredPermission` VARCHAR(100) NULL,
  `ownerOnly` BOOLEAN NOT NULL DEFAULT true,
  `active` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `ActivityStatusTransition_fromStatusCode_toStatusCode_key` (`fromStatusCode`, `toStatusCode`),
  INDEX `ActivityStatusTransition_fromStatusCode_active_idx` (`fromStatusCode`, `active`),
  CONSTRAINT `ActivityStatusTransition_fromStatusCode_fkey` FOREIGN KEY (`fromStatusCode`) REFERENCES `ActivityStatusDefinition` (`code`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `ActivityStatusTransition_toStatusCode_fkey` FOREIGN KEY (`toStatusCode`) REFERENCES `ActivityStatusDefinition` (`code`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO `ActivityStatusDefinition` (`code`, `label`, `sortOrder`, `reportingCategory`, `terminal`, `active`, `updatedAt`) VALUES
  ('OPEN', 'Open', 10, 'OPEN', false, true, CURRENT_TIMESTAMP),
  ('IN_PROGRESS', 'In Progress', 20, 'ACTIVE', false, true, CURRENT_TIMESTAMP),
  ('COMPLETED', 'Completed', 30, 'CLOSED', true, true, CURRENT_TIMESTAMP),
  ('CANCELLED', 'Cancelled', 40, 'CLOSED', true, true, CURRENT_TIMESTAMP)
ON DUPLICATE KEY UPDATE
  `label` = VALUES(`label`),
  `sortOrder` = VALUES(`sortOrder`),
  `reportingCategory` = VALUES(`reportingCategory`),
  `terminal` = VALUES(`terminal`),
  `active` = VALUES(`active`),
  `updatedAt` = VALUES(`updatedAt`);

INSERT INTO `ActivityStatusTransition` (`id`, `fromStatusCode`, `toStatusCode`, `requiredPermission`, `ownerOnly`, `active`, `updatedAt`) VALUES
  ('activity-open-in-progress', 'OPEN', 'IN_PROGRESS', 'activity.complete', true, true, CURRENT_TIMESTAMP),
  ('activity-open-completed', 'OPEN', 'COMPLETED', 'activity.complete', true, true, CURRENT_TIMESTAMP),
  ('activity-in-progress-open', 'IN_PROGRESS', 'OPEN', 'activity.complete', true, true, CURRENT_TIMESTAMP),
  ('activity-in-progress-completed', 'IN_PROGRESS', 'COMPLETED', 'activity.complete', true, true, CURRENT_TIMESTAMP)
ON DUPLICATE KEY UPDATE
  `requiredPermission` = VALUES(`requiredPermission`),
  `ownerOnly` = VALUES(`ownerOnly`),
  `active` = VALUES(`active`),
  `updatedAt` = VALUES(`updatedAt`);

SET FOREIGN_KEY_CHECKS = 0;

ALTER TABLE `Activity`
  ADD COLUMN `statusCode` VARCHAR(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL,
  ADD COLUMN `completedAt` DATETIME(3) NULL,
  ADD COLUMN `completionOutcome` TEXT NULL;

UPDATE `Activity` SET `statusCode` = 'OPEN' WHERE `statusCode` IS NULL;

ALTER TABLE `Activity`
  MODIFY `statusCode` VARCHAR(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'OPEN',
  ADD INDEX `Activity_ownerId_statusCode_dueAt_idx` (`ownerId`, `statusCode`, `dueAt`),
  ADD INDEX `Activity_statusCode_dueAt_deletedAt_idx` (`statusCode`, `dueAt`, `deletedAt`),
  ADD CONSTRAINT `Activity_statusCode_fkey` FOREIGN KEY (`statusCode`) REFERENCES `ActivityStatusDefinition` (`code`) ON DELETE RESTRICT ON UPDATE CASCADE;

SET FOREIGN_KEY_CHECKS = 1;
