-- MariaDB 5.5 compatibility counterpart for
-- migrations/20260711160000_add_ai_provider_configuration/migration.sql.
-- MySQL 8 CHECK constraints are enforced by the application service because
-- this legacy database version does not enforce them consistently.

CREATE TABLE `AiProviderConfiguration` (
  `id` VARCHAR(64) NOT NULL,
  `activeVersionId` VARCHAR(191) NULL,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `AiProviderConfiguration_activeVersionId_key` (`activeVersionId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `AiProviderConfigurationVersion` (
  `id` VARCHAR(191) NOT NULL,
  `configurationId` VARCHAR(64) NOT NULL,
  `version` INTEGER NOT NULL,
  `enabled` TINYINT(1) NOT NULL DEFAULT 0,
  `apiUrl` VARCHAR(2048) NOT NULL,
  `model` VARCHAR(255) NOT NULL,
  `requestTimeoutMs` INTEGER NOT NULL,
  `apiKeyCiphertext` VARBINARY(4096) NULL,
  `apiKeyNonce` VARBINARY(12) NULL,
  `apiKeyAuthTag` VARBINARY(16) NULL,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `AiProviderConfigurationVersion_configurationId_version_key` (`configurationId`, `version`),
  KEY `AiProviderConfigurationVersion_configurationId_createdAt_idx` (`configurationId`, `createdAt`),
  CONSTRAINT `AiProviderConfigurationVersion_configurationId_fkey`
    FOREIGN KEY (`configurationId`) REFERENCES `AiProviderConfiguration` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

ALTER TABLE `AiProviderConfiguration`
  ADD CONSTRAINT `AiProviderConfiguration_activeVersionId_fkey`
  FOREIGN KEY (`activeVersionId`) REFERENCES `AiProviderConfigurationVersion` (`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO `LegacySchemaMigration` (`id`, `appliedAt`)
VALUES ('20260711160000_add_ai_provider_configuration', UTC_TIMESTAMP());
