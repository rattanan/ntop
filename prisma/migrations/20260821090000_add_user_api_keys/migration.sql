ALTER TABLE `User`
  ADD COLUMN `apiKeyHash` CHAR(64) NULL,
  ADD COLUMN `apiKeyPrefix` VARCHAR(32) NULL,
  ADD COLUMN `apiKeyCreatedAt` DATETIME(3) NULL;

CREATE UNIQUE INDEX `User_apiKeyHash_key` ON `User`(`apiKeyHash`);
CREATE UNIQUE INDEX `User_apiKeyPrefix_key` ON `User`(`apiKeyPrefix`);
