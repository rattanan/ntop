CREATE TABLE IF NOT EXISTS `LegacySchemaMigration` (
  `name` VARCHAR(191) NOT NULL,
  `appliedAt` DATETIME NOT NULL,
  PRIMARY KEY (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

SET @migration_name = '20260821090000_add_user_api_keys';
SET @already_applied = (SELECT COUNT(*) FROM `LegacySchemaMigration` WHERE `name` = @migration_name);

SET @sql = IF(@already_applied = 0,
  'ALTER TABLE `User` ADD COLUMN `apiKeyHash` CHAR(64) NULL, ADD COLUMN `apiKeyPrefix` VARCHAR(32) NULL, ADD COLUMN `apiKeyCreatedAt` DATETIME NULL',
  'SELECT 1');
PREPARE statement FROM @sql;
EXECUTE statement;
DEALLOCATE PREPARE statement;

SET @sql = IF(@already_applied = 0,
  'CREATE UNIQUE INDEX `User_apiKeyHash_key` ON `User` (`apiKeyHash`)',
  'SELECT 1');
PREPARE statement FROM @sql;
EXECUTE statement;
DEALLOCATE PREPARE statement;

SET @sql = IF(@already_applied = 0,
  'CREATE UNIQUE INDEX `User_apiKeyPrefix_key` ON `User` (`apiKeyPrefix`)',
  'SELECT 1');
PREPARE statement FROM @sql;
EXECUTE statement;
DEALLOCATE PREPARE statement;

INSERT IGNORE INTO `LegacySchemaMigration` (`name`, `appliedAt`) VALUES (@migration_name, NOW());
