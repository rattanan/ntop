-- Additive Activity lifecycle fields. Deletion remains reversible at the data
-- layer and existing Activity relations are preserved.
ALTER TABLE `Activity`
  ADD COLUMN `version` INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN `deletedAt` DATETIME(3) NULL,
  ADD COLUMN `deletedById` VARCHAR(191) NULL,
  ADD INDEX `Activity_owner_deleted_created_idx` (`ownerId`(80), `deletedAt`, `createdAt`);
