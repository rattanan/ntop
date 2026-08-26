ALTER TABLE `ContractDocumentVersion`
  ADD COLUMN `deletedAt` DATETIME(3) NULL,
  ADD COLUMN `deletedById` VARCHAR(191) NULL;

CREATE INDEX `ContractDocumentVersion_documentId_deletedAt_createdAt_idx`
  ON `ContractDocumentVersion`(`documentId`, `deletedAt`, `createdAt`);
