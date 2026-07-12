-- MySQL 8 production-target migration. Stores governed metadata and validated
-- structured output only; raw prompts and raw provider responses are excluded.
CREATE TABLE `AiJob` (
  `id` VARCHAR(191) NOT NULL,
  `idempotencyKey` VARCHAR(191) NOT NULL,
  `capability` VARCHAR(100) NOT NULL,
  `requestedById` VARCHAR(191) NOT NULL,
  `status` ENUM('QUEUED','RUNNING','SUCCEEDED','FAILED','CANCELLED') NOT NULL DEFAULT 'QUEUED',
  `attemptCount` INTEGER NOT NULL DEFAULT 0,
  `maxAttempts` INTEGER NOT NULL,
  `availableAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `leaseExpiresAt` DATETIME(3) NULL,
  `errorCode` VARCHAR(100) NULL,
  `startedAt` DATETIME(3) NULL,
  `completedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `AiJob_idempotencyKey_key`(`idempotencyKey`),
  INDEX `AiJob_status_availableAt_idx`(`status`, `availableAt`),
  INDEX `AiJob_requestedById_capability_createdAt_idx`(`requestedById`, `capability`, `createdAt`),
  PRIMARY KEY (`id`),
  CONSTRAINT `AiJob_retry_bounds_chk` CHECK (`maxAttempts` > 0 AND `attemptCount` >= 0 AND `attemptCount` <= `maxAttempts`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `AiOutput` (
  `id` VARCHAR(191) NOT NULL,
  `jobId` VARCHAR(191) NOT NULL,
  `providerConfigurationVersionId` VARCHAR(191) NOT NULL,
  `capability` VARCHAR(100) NOT NULL,
  `outputSchemaVersion` VARCHAR(100) NOT NULL,
  `providerModel` VARCHAR(255) NOT NULL,
  `promptTemplateVersion` VARCHAR(100) NOT NULL,
  `inputSourceReferences` JSON NOT NULL,
  `validatedOutput` JSON NULL,
  `status` ENUM('DRAFT','CONFIRMED','REJECTED','ABANDONED') NOT NULL DEFAULT 'DRAFT',
  `safetyResult` ENUM('PASSED','REJECTED','REVIEW_REQUIRED') NOT NULL,
  `confidenceBand` ENUM('LOW','MEDIUM','HIGH','UNKNOWN') NOT NULL DEFAULT 'UNKNOWN',
  `latencyMs` INTEGER NULL,
  `inputTokens` INTEGER NULL,
  `outputTokens` INTEGER NULL,
  `totalTokens` INTEGER NULL,
  `expiresAt` DATETIME(3) NULL,
  `legalHold` BOOLEAN NOT NULL DEFAULT false,
  `abandonedReason` VARCHAR(255) NULL,
  `confirmedById` VARCHAR(191) NULL,
  `confirmedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `AiOutput_jobId_key`(`jobId`),
  INDEX `AiOutput_status_expiresAt_legalHold_idx`(`status`, `expiresAt`, `legalHold`),
  INDEX `AiOutput_capability_createdAt_idx`(`capability`, `createdAt`),
  INDEX `AiOutput_providerConfigurationVersionId_idx`(`providerConfigurationVersionId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `AiFeedback` (
  `id` VARCHAR(191) NOT NULL,
  `outputId` VARCHAR(191) NOT NULL,
  `actorId` VARCHAR(191) NOT NULL,
  `rating` ENUM('HELPFUL','INCORRECT','UNSAFE') NOT NULL,
  `comment` VARCHAR(1000) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `AiFeedback_outputId_createdAt_idx`(`outputId`, `createdAt`),
  INDEX `AiFeedback_actorId_createdAt_idx`(`actorId`, `createdAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `AiJob` ADD CONSTRAINT `AiJob_requestedById_fkey`
  FOREIGN KEY (`requestedById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `AiOutput` ADD CONSTRAINT `AiOutput_jobId_fkey`
  FOREIGN KEY (`jobId`) REFERENCES `AiJob`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `AiOutput` ADD CONSTRAINT `AiOutput_providerConfigurationVersionId_fkey`
  FOREIGN KEY (`providerConfigurationVersionId`) REFERENCES `AiProviderConfigurationVersion`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `AiOutput` ADD CONSTRAINT `AiOutput_confirmedById_fkey`
  FOREIGN KEY (`confirmedById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `AiFeedback` ADD CONSTRAINT `AiFeedback_outputId_fkey`
  FOREIGN KEY (`outputId`) REFERENCES `AiOutput`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `AiFeedback` ADD CONSTRAINT `AiFeedback_actorId_fkey`
  FOREIGN KEY (`actorId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
