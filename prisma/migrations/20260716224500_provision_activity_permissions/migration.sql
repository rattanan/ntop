INSERT IGNORE INTO `RolePermissionGrant` (`id`, `roleCode`, `permissionCode`, `createdAt`) VALUES
  ('activity-permission-admin-assign', 'ADMIN', 'activity.assign', CURRENT_TIMESTAMP),
  ('activity-permission-admin-complete', 'ADMIN', 'activity.complete', CURRENT_TIMESTAMP),
  ('activity-permission-team-manager-assign', 'TEAM_MANAGER', 'activity.assign', CURRENT_TIMESTAMP),
  ('activity-permission-team-manager-complete', 'TEAM_MANAGER', 'activity.complete', CURRENT_TIMESTAMP),
  ('activity-permission-kam-complete', 'KAM', 'activity.complete', CURRENT_TIMESTAMP),
  ('activity-permission-presales-complete', 'PRESALES', 'activity.complete', CURRENT_TIMESTAMP),
  ('activity-permission-solution-architect-complete', 'SOLUTION_ARCHITECT', 'activity.complete', CURRENT_TIMESTAMP),
  ('activity-permission-coverage-complete', 'COVERAGE', 'activity.complete', CURRENT_TIMESTAMP),
  ('activity-permission-order-operations-complete', 'ORDER_OPERATIONS', 'activity.complete', CURRENT_TIMESTAMP);
