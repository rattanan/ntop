-- MySQL 8 production-target migration. Existing Activity records remain valid;
-- confirmations are additive and retain provenance to one validated AI output.
CREATE TABLE `MeetingDraftConfirmation` (
  `id` VARCHAR(191) NOT NULL,
  `idempotencyKey` VARCHAR(191) NOT NULL,
  `aiOutputId` VARCHAR(191) NOT NULL,
  `activityId` VARCHAR(191) NOT NULL,
  `selectedFields` JSON NOT NULL,
  `finalContent` JSON NOT NULL,
  `confirmedById` VARCHAR(191) NOT NULL,
  `confirmedAt` DATETIME(3) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `MeetingDraftConfirmation_idempotencyKey_key`(`idempotencyKey`),
  UNIQUE INDEX `MeetingDraftConfirmation_aiOutputId_key`(`aiOutputId`),
  UNIQUE INDEX `MeetingDraftConfirmation_activityId_key`(`activityId`),
  INDEX `MeetingDraftConfirmation_confirmedById_confirmedAt_idx`(`confirmedById`, `confirmedAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `MeetingDraftConfirmation` ADD CONSTRAINT `MeetingDraftConfirmation_aiOutputId_fkey`
  FOREIGN KEY (`aiOutputId`) REFERENCES `AiOutput`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `MeetingDraftConfirmation` ADD CONSTRAINT `MeetingDraftConfirmation_activityId_fkey`
  FOREIGN KEY (`activityId`) REFERENCES `Activity`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `MeetingDraftConfirmation` ADD CONSTRAINT `MeetingDraftConfirmation_confirmedById_fkey`
  FOREIGN KEY (`confirmedById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
