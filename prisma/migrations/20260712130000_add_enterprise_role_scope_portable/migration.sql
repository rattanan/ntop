CREATE TABLE IF NOT EXISTS `OrganizationUnit` (
  `id` VARCHAR(191) NOT NULL,
  `code` VARCHAR(100) NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `parentId` VARCHAR(191) NULL,
  `active` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME NOT NULL,
  `updatedAt` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `OrganizationUnit_code_key` (`code`),
  INDEX `OrganizationUnit_parentId_active_idx` (`parentId`, `active`),
  CONSTRAINT `OrganizationUnit_parentId_fkey`
    FOREIGN KEY (`parentId`) REFERENCES `OrganizationUnit`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `UserRoleAssignment` (
  `id` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `roleCode` VARCHAR(100) NOT NULL,
  `scopeCode` VARCHAR(32) NOT NULL,
  `organizationUnitId` VARCHAR(191) NULL,
  `effectiveFrom` DATETIME NOT NULL,
  `effectiveTo` DATETIME NULL,
  `active` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME NOT NULL,
  `updatedAt` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `UserRoleAssignment_unique_assignment`
    (`userId`, `roleCode`, `scopeCode`, `organizationUnitId`, `effectiveFrom`),
  INDEX `UserRoleAssignment_user_effective_idx`
    (`userId`, `active`, `effectiveFrom`, `effectiveTo`),
  INDEX `UserRoleAssignment_org_role_idx`
    (`organizationUnitId`, `roleCode`, `active`),
  CONSTRAINT `UserRoleAssignment_userId_fkey`
    FOREIGN KEY (`userId`) REFERENCES `User`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `UserRoleAssignment_organizationUnitId_fkey`
    FOREIGN KEY (`organizationUnitId`) REFERENCES `OrganizationUnit`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;

ALTER TABLE `Customer`
  ADD COLUMN `organizationUnitId` VARCHAR(191) NULL,
  ADD INDEX `Customer_organizationUnitId_updatedAt_idx` (`organizationUnitId`, `updatedAt`),
  ADD INDEX `Customer_ownerId_updatedAt_idx` (`ownerId`, `updatedAt`),
  ADD CONSTRAINT `Customer_organizationUnitId_fkey`
    FOREIGN KEY (`organizationUnitId`) REFERENCES `OrganizationUnit`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE;
