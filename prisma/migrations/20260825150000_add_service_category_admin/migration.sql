-- Service Category administration remains additive. Existing categories stay
-- active and keep version 1; delete operations are soft deletes.
ALTER TABLE `ServiceCategoryConfig`
  ADD COLUMN `version` INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN `deletedAt` DATETIME(3) NULL,
  ADD COLUMN `deletedById` VARCHAR(191) NULL;

CREATE INDEX `ServiceCategoryConfig_deletedAt_active_displayOrder_name_idx`
  ON `ServiceCategoryConfig`(`deletedAt`, `active`, `displayOrder`, `name`);

-- Preserve existing navigation grants and expose Service Category management
-- only to roles that already own Product Catalog administration.
INSERT IGNORE INTO `RolePermissionGrant` (`id`, `roleCode`, `permissionCode`, `createdAt`)
SELECT UUID(), grants.roleCode, 'navigation.admin.service-categories.view', CURRENT_TIMESTAMP(3)
FROM `RolePermissionGrant` grants
WHERE grants.permissionCode = 'product.catalog.manage';

-- Some development databases pre-date permission-driven navigation. Backfill
-- Quotation navigation from the governed Quote mutation capabilities.
INSERT IGNORE INTO `RolePermissionGrant` (`id`, `roleCode`, `permissionCode`, `createdAt`)
SELECT UUID(), grants.roleCode, 'navigation.quotes.view', CURRENT_TIMESTAMP(3)
FROM `RolePermissionGrant` grants
WHERE grants.permissionCode IN ('quote.manage', 'quote.submit');

INSERT IGNORE INTO `RolePermissionGrant` (`id`, `roleCode`, `permissionCode`, `createdAt`)
VALUES
  (UUID(), 'ADMIN', 'navigation.admin.service-categories.view', CURRENT_TIMESTAMP(3)),
  (UUID(), 'ADMIN', 'navigation.quotes.view', CURRENT_TIMESTAMP(3));
