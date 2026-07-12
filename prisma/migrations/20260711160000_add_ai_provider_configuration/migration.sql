-- MySQL 8 production-target migration. Do not apply to legacy MariaDB 5.5.
CREATE TABLE `AiProviderConfiguration` (
  `id` VARCHAR(64) NOT NULL,
  `activeVersionId` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `AiProviderConfiguration_activeVersionId_key`(`activeVersionId`),
  PRIMARY KEY (`id`),
  CONSTRAINT `AiProviderConfiguration_singleton_chk` CHECK (`id` = 'default')
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `AiProviderConfigurationVersion` (
  `id` VARCHAR(191) NOT NULL,
  `configurationId` VARCHAR(64) NOT NULL,
  `version` INTEGER NOT NULL,
  `enabled` BOOLEAN NOT NULL DEFAULT false,
  `apiUrl` VARCHAR(2048) NOT NULL,
  `model` VARCHAR(255) NOT NULL,
  `requestTimeoutMs` INTEGER NOT NULL,
  `apiKeyCiphertext` VARBINARY(4096) NULL,
  `apiKeyNonce` VARBINARY(12) NULL,
  `apiKeyAuthTag` VARBINARY(16) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `AiProviderConfigurationVersion_configurationId_version_key`(`configurationId`, `version`),
  INDEX `AiProviderConfigurationVersion_configurationId_createdAt_idx`(`configurationId`, `createdAt`),
  PRIMARY KEY (`id`),
  CONSTRAINT `AiProviderConfigurationVersion_key_parts_chk` CHECK (
    (`apiKeyCiphertext` IS NULL AND `apiKeyNonce` IS NULL AND `apiKeyAuthTag` IS NULL)
    OR
    (`apiKeyCiphertext` IS NOT NULL AND `apiKeyNonce` IS NOT NULL AND `apiKeyAuthTag` IS NOT NULL)
  ),
  CONSTRAINT `AiProviderConfigurationVersion_timeout_chk` CHECK (`requestTimeoutMs` > 0)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `AiProviderConfigurationVersion`
  ADD CONSTRAINT `AiProviderConfigurationVersion_configurationId_fkey`
  FOREIGN KEY (`configurationId`) REFERENCES `AiProviderConfiguration`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `AiProviderConfiguration`
  ADD CONSTRAINT `AiProviderConfiguration_activeVersionId_fkey`
  FOREIGN KEY (`activeVersionId`) REFERENCES `AiProviderConfigurationVersion`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;
