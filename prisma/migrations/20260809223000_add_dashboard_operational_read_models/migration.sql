-- MariaDB/MySQL DDL can partially commit. Keep the ALTER safe when a failed
-- deployment is resolved and replayed.
SET @service_order_dashboard_alter = IF(
  EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'ContractServiceOrder'
      AND COLUMN_NAME = 'targetCompletionAt'
  ),
  'SELECT 1',
  'ALTER TABLE `ContractServiceOrder`
    ADD COLUMN `targetCompletionAt` DATETIME(3) NULL,
    ADD COLUMN `installationCompletedAt` DATETIME(3) NULL,
    ADD COLUMN `testingCompletedAt` DATETIME(3) NULL,
    ADD COLUMN `handoverCompletedAt` DATETIME(3) NULL,
    ADD COLUMN `completedAt` DATETIME(3) NULL,
    ADD INDEX `ContractServiceOrder_targetCompletionAt_completedAt_status_idx` (`targetCompletionAt`, `completedAt`, `status`)'
);
PREPARE service_order_dashboard_statement FROM @service_order_dashboard_alter;
EXECUTE service_order_dashboard_statement;
DEALLOCATE PREPARE service_order_dashboard_statement;

CREATE TABLE IF NOT EXISTS `CustomerIncident` (
  `id` VARCHAR(191) NOT NULL,
  `incidentNo` VARCHAR(60) NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `customerId` VARCHAR(191) NOT NULL,
  `ownerId` VARCHAR(191) NOT NULL,
  `organizationUnitId` VARCHAR(191) NULL,
  `severityCode` VARCHAR(40) NOT NULL,
  `statusCode` VARCHAR(40) NOT NULL,
  `openedAt` DATETIME(3) NOT NULL,
  `slaDueAt` DATETIME(3) NULL,
  `resolvedAt` DATETIME(3) NULL,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `CustomerIncident_incidentNo_key` (`incidentNo`),
  INDEX `CustomerIncident_organizationUnitId_statusCode_updatedAt_idx` (`organizationUnitId`, `statusCode`, `updatedAt`),
  INDEX `CustomerIncident_ownerId_statusCode_slaDueAt_idx` (`ownerId`, `statusCode`, `slaDueAt`),
  INDEX `CustomerIncident_customerId_statusCode_updatedAt_idx` (`customerId`, `statusCode`, `updatedAt`),
  INDEX `CustomerIncident_slaDueAt_resolvedAt_idx` (`slaDueAt`, `resolvedAt`),
  PRIMARY KEY (`id`),
  CONSTRAINT `CustomerIncident_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `Customer` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `CustomerIncident_ownerId_fkey` FOREIGN KEY (`ownerId`) REFERENCES `User` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `CustomerIncident_organizationUnitId_fkey` FOREIGN KEY (`organizationUnitId`) REFERENCES `OrganizationUnit` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT IGNORE INTO `RolePermissionGrant` (`id`,`roleCode`,`permissionCode`,`createdAt`)
SELECT UUID(), roles.roleCode, 'dashboard.view', CURRENT_TIMESTAMP
FROM (
  SELECT 'ADMIN' roleCode UNION ALL SELECT 'SYSTEM_ADMIN' UNION ALL SELECT 'EXECUTIVE' UNION ALL
  SELECT 'SALES_DIRECTOR' UNION ALL SELECT 'TEAM_MANAGER' UNION ALL SELECT 'KAM' UNION ALL
  SELECT 'PRESALES' UNION ALL SELECT 'SOLUTION_ARCHITECT' UNION ALL SELECT 'MARKETING' UNION ALL
  SELECT 'COVERAGE' UNION ALL SELECT 'PRICING_APPROVER' UNION ALL SELECT 'LEGAL' UNION ALL
  SELECT 'ORDER_OPERATIONS' UNION ALL SELECT 'CUSTOMER_SUCCESS' UNION ALL SELECT 'VIEWER' UNION ALL
  SELECT 'AUDITOR' UNION ALL SELECT 'CUSTOMER_DATA_OWNER' UNION ALL SELECT 'DATA_STEWARD' UNION ALL
  SELECT 'COMMERCIAL_COMMITTEE'
) roles;

INSERT IGNORE INTO `RolePermissionGrant` (`id`,`roleCode`,`permissionCode`,`createdAt`)
SELECT UUID(), roles.roleCode, 'dashboard.export', CURRENT_TIMESTAMP
FROM (
  SELECT 'ADMIN' roleCode UNION ALL SELECT 'SYSTEM_ADMIN' UNION ALL SELECT 'EXECUTIVE' UNION ALL
  SELECT 'SALES_DIRECTOR' UNION ALL SELECT 'TEAM_MANAGER' UNION ALL SELECT 'KAM' UNION ALL
  SELECT 'PRESALES' UNION ALL SELECT 'SOLUTION_ARCHITECT' UNION ALL SELECT 'MARKETING' UNION ALL
  SELECT 'COVERAGE' UNION ALL SELECT 'PRICING_APPROVER' UNION ALL SELECT 'LEGAL' UNION ALL
  SELECT 'ORDER_OPERATIONS' UNION ALL SELECT 'CUSTOMER_SUCCESS' UNION ALL SELECT 'AUDITOR' UNION ALL
  SELECT 'CUSTOMER_DATA_OWNER' UNION ALL SELECT 'DATA_STEWARD' UNION ALL SELECT 'COMMERCIAL_COMMITTEE'
) roles;

INSERT IGNORE INTO `RolePermissionGrant` (`id`,`roleCode`,`permissionCode`,`createdAt`) VALUES
  (UUID(),'ADMIN','dashboard.section.executive',CURRENT_TIMESTAMP),
  (UUID(),'ADMIN','dashboard.section.sales',CURRENT_TIMESTAMP),
  (UUID(),'ADMIN','dashboard.section.sales-manager',CURRENT_TIMESTAMP),
  (UUID(),'ADMIN','dashboard.section.solution',CURRENT_TIMESTAMP),
  (UUID(),'ADMIN','dashboard.section.approver',CURRENT_TIMESTAMP),
  (UUID(),'ADMIN','dashboard.section.operations',CURRENT_TIMESTAMP),
  (UUID(),'ADMIN','dashboard.section.customer-success',CURRENT_TIMESTAMP),
  (UUID(),'ADMIN','dashboard.section.admin',CURRENT_TIMESTAMP),
  (UUID(),'SYSTEM_ADMIN','dashboard.section.admin',CURRENT_TIMESTAMP),
  (UUID(),'EXECUTIVE','dashboard.section.executive',CURRENT_TIMESTAMP),
  (UUID(),'SALES_DIRECTOR','dashboard.section.executive',CURRENT_TIMESTAMP),
  (UUID(),'SALES_DIRECTOR','dashboard.section.sales-manager',CURRENT_TIMESTAMP),
  (UUID(),'SALES_DIRECTOR','dashboard.section.approver',CURRENT_TIMESTAMP),
  (UUID(),'TEAM_MANAGER','dashboard.section.sales-manager',CURRENT_TIMESTAMP),
  (UUID(),'TEAM_MANAGER','dashboard.section.approver',CURRENT_TIMESTAMP),
  (UUID(),'KAM','dashboard.section.sales',CURRENT_TIMESTAMP),
  (UUID(),'MARKETING','dashboard.section.sales',CURRENT_TIMESTAMP),
  (UUID(),'PRESALES','dashboard.section.solution',CURRENT_TIMESTAMP),
  (UUID(),'SOLUTION_ARCHITECT','dashboard.section.solution',CURRENT_TIMESTAMP),
  (UUID(),'COVERAGE','dashboard.section.solution',CURRENT_TIMESTAMP),
  (UUID(),'PRICING_APPROVER','dashboard.section.approver',CURRENT_TIMESTAMP),
  (UUID(),'LEGAL','dashboard.section.approver',CURRENT_TIMESTAMP),
  (UUID(),'COMMERCIAL_COMMITTEE','dashboard.section.approver',CURRENT_TIMESTAMP),
  (UUID(),'ORDER_OPERATIONS','dashboard.section.operations',CURRENT_TIMESTAMP),
  (UUID(),'CUSTOMER_SUCCESS','dashboard.section.customer-success',CURRENT_TIMESTAMP),
  (UUID(),'CUSTOMER_DATA_OWNER','dashboard.section.customer-success',CURRENT_TIMESTAMP),
  (UUID(),'DATA_STEWARD','dashboard.section.customer-success',CURRENT_TIMESTAMP),
  (UUID(),'AUDITOR','dashboard.section.executive',CURRENT_TIMESTAMP),
  (UUID(),'AUDITOR','dashboard.section.admin',CURRENT_TIMESTAMP),
  (UUID(),'CUSTOMER_SUCCESS','nav.customers',CURRENT_TIMESTAMP),
  (UUID(),'CUSTOMER_SUCCESS','nav.activities',CURRENT_TIMESTAMP),
  (UUID(),'CUSTOMER_SUCCESS','nav.contracts',CURRENT_TIMESTAMP),
  (UUID(),'CUSTOMER_SUCCESS','quick-create.activity',CURRENT_TIMESTAMP),
  (UUID(),'CUSTOMER_SUCCESS','activity.complete',CURRENT_TIMESTAMP),
  (UUID(),'CUSTOMER_SUCCESS','contract.view',CURRENT_TIMESTAMP);
