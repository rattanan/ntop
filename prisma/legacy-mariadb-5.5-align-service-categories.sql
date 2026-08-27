-- MariaDB 5.5 compatibility counterpart of
-- 20260827183000_align_service_categories_with_catalog.
-- Apply only to the legacy development environment, never through Prisma Migrate.
INSERT INTO `ServiceCategoryConfig` (
  `id`, `version`, `code`, `name`, `requiresSiteSurvey`, `requiresBoq`,
  `requiresPhysicalInstallation`, `active`, `displayOrder`, `deletedAt`,
  `deletedById`, `createdAt`, `updatedAt`
)
VALUES
  ('svc_category_broadband', 1, 'BROADBAND', 'Broadband', false, false, false, true, 10, NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('svc_category_datacom', 1, 'DATACOM', 'Datacom', false, false, false, true, 20, NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('svc_category_hard_infrastructure', 1, 'HARD_INFRASTRUCTURE', 'Hard Infrastructure', false, false, false, true, 30, NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('svc_category_international', 1, 'INTERNATIONAL', 'International', false, false, false, true, 40, NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('svc_category_satellite', 1, 'SATELLITE', 'Satellite', false, false, false, true, 50, NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('svc_category_voice', 1, 'VOICE', 'Voice', false, false, false, true, 60, NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON DUPLICATE KEY UPDATE
  `version` = `version` + IF(
    `active` = false OR `deletedAt` IS NOT NULL OR `name` <> VALUES(`name`)
      OR `requiresSiteSurvey` = true OR `requiresBoq` = true
      OR `requiresPhysicalInstallation` = true,
    1,
    0
  ),
  `name` = VALUES(`name`),
  `requiresSiteSurvey` = false,
  `requiresBoq` = false,
  `requiresPhysicalInstallation` = false,
  `active` = true,
  `displayOrder` = VALUES(`displayOrder`),
  `deletedAt` = NULL,
  `deletedById` = NULL,
  `updatedAt` = CURRENT_TIMESTAMP;

UPDATE `Product`
SET
  `serviceCategoryCode` = CASE `category`
    WHEN 'Broadband' THEN 'BROADBAND'
    WHEN 'Datacom' THEN 'DATACOM'
    WHEN 'Hard Infrastructure' THEN 'HARD_INFRASTRUCTURE'
    WHEN 'International' THEN 'INTERNATIONAL'
    WHEN 'Satellite' THEN 'SATELLITE'
    WHEN 'Voice' THEN 'VOICE'
  END,
  `requiresSiteSurvey` = false,
  `requiresBoq` = false,
  `requiresPhysicalInstallation` = false,
  `version` = `version` + 1,
  `updatedAt` = CURRENT_TIMESTAMP
WHERE `deletedAt` IS NULL
  AND `category` IN ('Broadband', 'Datacom', 'Hard Infrastructure', 'International', 'Satellite', 'Voice')
  AND (
    `serviceCategoryCode` IS NULL
    OR `serviceCategoryCode` <> CASE `category`
      WHEN 'Broadband' THEN 'BROADBAND'
      WHEN 'Datacom' THEN 'DATACOM'
      WHEN 'Hard Infrastructure' THEN 'HARD_INFRASTRUCTURE'
      WHEN 'International' THEN 'INTERNATIONAL'
      WHEN 'Satellite' THEN 'SATELLITE'
      WHEN 'Voice' THEN 'VOICE'
    END
    OR `requiresSiteSurvey` = true
    OR `requiresBoq` = true
    OR `requiresPhysicalInstallation` = true
  );
