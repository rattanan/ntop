CREATE TABLE `ActivityStatusHistory` (
  `id` VARCHAR(191) NOT NULL,
  `activityId` VARCHAR(191) NOT NULL,
  `fromStatusCode` VARCHAR(32) NOT NULL,
  `toStatusCode` VARCHAR(32) NOT NULL,
  `reason` VARCHAR(1000) NOT NULL,
  `outcome` TEXT NULL,
  `actorId` VARCHAR(191) NOT NULL,
  `correlationId` VARCHAR(191) NOT NULL,
  `transitionedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `ActivityStatusHistory_activityId_transitionedAt_idx` (`activityId`(80), `transitionedAt`),
  INDEX `ActivityStatusHistory_actorId_transitionedAt_idx` (`actorId`(80), `transitionedAt`),
  INDEX `ActivityStatusHistory_activityId_fkey` (`activityId`),
  INDEX `ActivityStatusHistory_actorId_fkey` (`actorId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

SET @activity_id_collation = (
  SELECT `COLLATION_NAME`
  FROM `information_schema`.`COLUMNS`
  WHERE `TABLE_SCHEMA` = DATABASE()
    AND `TABLE_NAME` = 'Activity'
    AND `COLUMN_NAME` = 'id'
);
SET @activity_id_sql = CONCAT(
  'ALTER TABLE `ActivityStatusHistory` MODIFY `activityId` VARCHAR(191) CHARACTER SET utf8mb4 COLLATE ',
  @activity_id_collation,
  ' NOT NULL'
);
PREPARE activity_id_statement FROM @activity_id_sql;
EXECUTE activity_id_statement;
DEALLOCATE PREPARE activity_id_statement;

ALTER TABLE `ActivityStatusHistory`
  ADD CONSTRAINT `ActivityStatusHistory_activityId_fkey` FOREIGN KEY (`activityId`) REFERENCES `Activity` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `ActivityStatusHistory_fromStatusCode_fkey` FOREIGN KEY (`fromStatusCode`) REFERENCES `ActivityStatusDefinition` (`code`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `ActivityStatusHistory_toStatusCode_fkey` FOREIGN KEY (`toStatusCode`) REFERENCES `ActivityStatusDefinition` (`code`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `ActivityStatusHistory_actorId_fkey` FOREIGN KEY (`actorId`) REFERENCES `User` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
