-- MariaDB 5.5 compatibility counterpart for identity administration and login history.
ALTER TABLE `User` ADD COLUMN `active` TINYINT(1) NOT NULL DEFAULT 1 AFTER `role`;

CREATE TABLE `LoginEvent` (
  `id` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NULL,
  `identifierHash` CHAR(64) NOT NULL,
  `outcome` ENUM('SUCCESS', 'INVALID_CREDENTIALS', 'DISABLED') NOT NULL,
  `ipAddressHash` CHAR(64) NULL,
  `userAgentHash` CHAR(64) NULL,
  `correlationId` VARCHAR(191) NOT NULL,
  `occurredAt` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  KEY `LoginEvent_occurredAt_outcome_idx` (`occurredAt`, `outcome`),
  KEY `LoginEvent_userId_occurredAt_idx` (`userId`, `occurredAt`),
  KEY `LoginEvent_identifierHash_occurredAt_idx` (`identifierHash`, `occurredAt`),
  KEY `LoginEvent_correlationId_idx` (`correlationId`),
  CONSTRAINT `LoginEvent_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO `LegacySchemaMigration` (`id`,`appliedAt`) VALUES ('20260714140000_add_identity_admin_login_history',UTC_TIMESTAMP());
