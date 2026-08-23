-- Phase 1 Presales navigation was deployed independently from its domain
-- permissions. Keep every existing grant and backfill read access only for
-- roles that can already see the corresponding navigation entry.
INSERT IGNORE INTO `RolePermissionGrant` (`id`, `roleCode`, `permissionCode`, `createdAt`)
SELECT UUID(), navigation_grants.roleCode, permission_map.permissionCode, CURRENT_TIMESTAMP(3)
FROM `RolePermissionGrant` navigation_grants
INNER JOIN (
  SELECT 'navigation.solution-designs.view' navigationPermission, 'solution-design.view' permissionCode
  UNION ALL SELECT 'navigation.site-surveys.view', 'site-survey.view'
  UNION ALL SELECT 'navigation.boqs.view', 'boq.view'
) permission_map ON permission_map.navigationPermission = navigation_grants.permissionCode;

-- ADMIN is the operational break-glass role in the approved baseline and must
-- retain the complete governed Presales capability set. Mutations still pass
-- the same server-side scope, workflow, maker-checker and audit enforcement.
INSERT IGNORE INTO `RolePermissionGrant` (`id`, `roleCode`, `permissionCode`, `createdAt`)
SELECT UUID(), 'ADMIN', admin_permissions.permissionCode, CURRENT_TIMESTAMP(3)
FROM (
  SELECT 'solution-design.view' permissionCode
  UNION ALL SELECT 'solution-design.manage'
  UNION ALL SELECT 'solution-design.submit'
  UNION ALL SELECT 'solution-design.technical.approve'
  UNION ALL SELECT 'solution-design.commercial.approve'
  UNION ALL SELECT 'site-survey.view'
  UNION ALL SELECT 'site-survey.request'
  UNION ALL SELECT 'site-survey.coordinate'
  UNION ALL SELECT 'site-survey.perform'
  UNION ALL SELECT 'site-survey.result.approve'
  UNION ALL SELECT 'boq.view'
  UNION ALL SELECT 'boq.manage'
  UNION ALL SELECT 'boq.cost.view'
  UNION ALL SELECT 'boq.approve'
) admin_permissions;
