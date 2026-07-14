ALTER TABLE `Prospect`
  ADD COLUMN `deleteReason` VARCHAR(100) NULL AFTER `deletedById`;

ALTER TABLE `Lead`
  MODIFY COLUMN `status` ENUM(
    'NEW','ASSIGNED','CONTACTED','QUALIFIED','NURTURING','CONVERTED',
    'DISQUALIFIED','INVALID','DUPLICATE','NOT_INTERESTED','NO_BUDGET','ARCHIVED'
  ) NOT NULL DEFAULT 'NEW';

ALTER TABLE `Opportunity`
  MODIFY COLUMN `stage` ENUM(
    'QUALIFY','DISCOVER','SOLUTION','PROPOSAL','NEGOTIATION',
    'WON','LOST','CANCELLED','EXPIRED'
  ) NOT NULL DEFAULT 'QUALIFY';

ALTER TABLE `OpportunityTransitionPolicyVersion`
  MODIFY COLUMN `fromStage` ENUM('QUALIFY','DISCOVER','SOLUTION','PROPOSAL','NEGOTIATION','WON','LOST','CANCELLED','EXPIRED') NOT NULL,
  MODIFY COLUMN `toStage` ENUM('QUALIFY','DISCOVER','SOLUTION','PROPOSAL','NEGOTIATION','WON','LOST','CANCELLED','EXPIRED') NOT NULL;

ALTER TABLE `OpportunityStageHistory`
  MODIFY COLUMN `fromStage` ENUM('QUALIFY','DISCOVER','SOLUTION','PROPOSAL','NEGOTIATION','WON','LOST','CANCELLED','EXPIRED') NOT NULL,
  MODIFY COLUMN `toStage` ENUM('QUALIFY','DISCOVER','SOLUTION','PROPOSAL','NEGOTIATION','WON','LOST','CANCELLED','EXPIRED') NOT NULL;

ALTER TABLE `ForecastItem`
  MODIFY COLUMN `stage` ENUM('QUALIFY','DISCOVER','SOLUTION','PROPOSAL','NEGOTIATION','WON','LOST','CANCELLED','EXPIRED') NOT NULL;

UPDATE `OpportunityTransitionPolicyVersion`
SET `requiredFields`='["reason","cancelledReason"]'
WHERE `command`='CANCEL' AND `toStage`='CANCELLED';

ALTER TABLE `Customer`
  MODIFY COLUMN `status` ENUM(
    'PROSPECT','ACTIVE','INACTIVE','BLACKLISTED','CLOSED'
  ) NOT NULL DEFAULT 'PROSPECT';

INSERT IGNORE INTO `RolePermissionGrant` (`id`,`roleCode`,`permissionCode`,`createdAt`) VALUES
  (UUID(),'TEAM_MANAGER','prospect.soft_delete',NOW()),
  (UUID(),'ADMIN','prospect.soft_delete',NOW()),
  (UUID(),'ADMIN','prospect.view_deleted',NOW()),
  (UUID(),'ADMIN','prospect.restore',NOW()),
  (UUID(),'ADMIN','lead.archive',NOW()),
  (UUID(),'ADMIN','customer.lifecycle.manage',NOW()),
  (UUID(),'SYSTEM_ADMIN','prospect.view_deleted',NOW()),
  (UUID(),'SYSTEM_ADMIN','prospect.restore',NOW()),
  (UUID(),'SYSTEM_ADMIN','prospect.permanent_delete',NOW());

INSERT IGNORE INTO `OpportunityTransitionPolicyVersion`
  (`id`,`policyCode`,`version`,`command`,`fromStage`,`toStage`,`requiredFields`,`requiredPermission`,`active`,`effectiveFrom`,`createdAt`)
VALUES
  (UUID(),'RETENTION-EXPIRE-QUALIFY',1,'EXPIRE','QUALIFY','EXPIRED','["reason"]','opportunity.transition',1,'2026-01-01 00:00:00.000',NOW()),
  (UUID(),'RETENTION-EXPIRE-DISCOVER',1,'EXPIRE','DISCOVER','EXPIRED','["reason"]','opportunity.transition',1,'2026-01-01 00:00:00.000',NOW()),
  (UUID(),'RETENTION-EXPIRE-SOLUTION',1,'EXPIRE','SOLUTION','EXPIRED','["reason"]','opportunity.transition',1,'2026-01-01 00:00:00.000',NOW()),
  (UUID(),'RETENTION-EXPIRE-PROPOSAL',1,'EXPIRE','PROPOSAL','EXPIRED','["reason"]','opportunity.transition',1,'2026-01-01 00:00:00.000',NOW()),
  (UUID(),'RETENTION-EXPIRE-NEGOTIATION',1,'EXPIRE','NEGOTIATION','EXPIRED','["reason"]','opportunity.transition',1,'2026-01-01 00:00:00.000',NOW());
