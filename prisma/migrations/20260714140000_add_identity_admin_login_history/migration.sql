-- Additive identity administration and login history foundation.
ALTER TABLE `User` ADD COLUMN `active` BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE `LoginEvent` (
  `id` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NULL,
  `identifierHash` CHAR(64) NOT NULL,
  `outcome` ENUM('SUCCESS', 'INVALID_CREDENTIALS', 'DISABLED') NOT NULL,
  `ipAddressHash` CHAR(64) NULL,
  `userAgentHash` CHAR(64) NULL,
  `correlationId` VARCHAR(191) NOT NULL,
  `occurredAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `LoginEvent_occurredAt_outcome_idx` (`occurredAt`, `outcome`),
  INDEX `LoginEvent_userId_occurredAt_idx` (`userId`, `occurredAt`),
  INDEX `LoginEvent_identifierHash_occurredAt_idx` (`identifierHash`, `occurredAt`),
  INDEX `LoginEvent_correlationId_idx` (`correlationId`),
  PRIMARY KEY (`id`),
  CONSTRAINT `LoginEvent_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
