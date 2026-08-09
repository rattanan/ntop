-- Some deployed environments contain ActivityStatusHistory from an operational
-- migration that predates the repository's current migration set. Repair it
-- when present without making clean installations depend on that legacy table.
SET @activity_history_exists = (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.TABLES
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'ActivityStatusHistory'
);

SET @activity_history_drop_fk = IF(
  @activity_history_exists > 0,
  'ALTER TABLE `ActivityStatusHistory` DROP FOREIGN KEY `ActivityStatusHistory_activityId_fkey`',
  'SELECT 1'
);
PREPARE activity_history_statement FROM @activity_history_drop_fk;
EXECUTE activity_history_statement;
DEALLOCATE PREPARE activity_history_statement;

SET @activity_history_modify = IF(
  @activity_history_exists > 0,
  'ALTER TABLE `ActivityStatusHistory` MODIFY `activityId` VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL',
  'SELECT 1'
);
PREPARE activity_history_statement FROM @activity_history_modify;
EXECUTE activity_history_statement;
DEALLOCATE PREPARE activity_history_statement;

SET @activity_history_add_fk = IF(
  @activity_history_exists > 0,
  'ALTER TABLE `ActivityStatusHistory` ADD CONSTRAINT `ActivityStatusHistory_activityId_fkey` FOREIGN KEY (`activityId`) REFERENCES `Activity`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE',
  'SELECT 1'
);
PREPARE activity_history_statement FROM @activity_history_add_fk;
EXECUTE activity_history_statement;
DEALLOCATE PREPARE activity_history_statement;
