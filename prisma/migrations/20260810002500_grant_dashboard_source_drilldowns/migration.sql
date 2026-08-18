-- Every KPI drill-down keeps the caller's existing SELF/TEAM/ORG_UNIT/ENTERPRISE
-- data scope. These grants expose only the read/navigation surface required to
-- reach the same scoped source records used by the dashboard.
INSERT IGNORE INTO `RolePermissionGrant` (`id`, `roleCode`, `permissionCode`, `createdAt`)
SELECT UUID(), dashboard_roles.roleCode, source_permissions.permissionCode, CURRENT_TIMESTAMP
FROM (
  SELECT DISTINCT `roleCode`
  FROM `RolePermissionGrant`
  WHERE `permissionCode` = 'dashboard.view'
) dashboard_roles
CROSS JOIN (
  SELECT 'nav.prospects' permissionCode
  UNION ALL SELECT 'nav.leads'
  UNION ALL SELECT 'nav.customers'
  UNION ALL SELECT 'nav.opportunities'
  UNION ALL SELECT 'nav.pipeline'
  UNION ALL SELECT 'nav.approvals'
  UNION ALL SELECT 'nav.activities'
  UNION ALL SELECT 'nav.contracts'
  UNION ALL SELECT 'prospect.view'
  UNION ALL SELECT 'prospect.view_all'
  UNION ALL SELECT 'contract.view'
) source_permissions;
