-- MariaDB 5.5 compatibility path for
-- 20260825180000_relax_qualify_discover_transition_policy.

SET @ntop_qualify_discover_effective_at = NOW();

UPDATE `OpportunityTransitionPolicyVersion`
SET `active` = 0,
    `effectiveTo` = IFNULL(`effectiveTo`, @ntop_qualify_discover_effective_at)
WHERE `policyCode` = 'QUALIFY_DISCOVER'
  AND `version` = 1
  AND `active` = 1;

INSERT INTO `OpportunityTransitionPolicyVersion`
  (`id`, `policyCode`, `version`, `command`, `fromStage`, `toStage`, `requiredFields`, `requiredPermission`, `active`, `effectiveFrom`, `createdAt`)
SELECT
  'otp_qualify_discover_v2', 'QUALIFY_DISCOVER', 2, 'FORWARD', 'QUALIFY', 'DISCOVER',
  '["nextAction"]', 'opportunity.transition', 1,
  @ntop_qualify_discover_effective_at, @ntop_qualify_discover_effective_at
FROM DUAL
WHERE NOT EXISTS (
  SELECT 1
  FROM `OpportunityTransitionPolicyVersion`
  WHERE `policyCode` = 'QUALIFY_DISCOVER'
    AND `version` >= 2
);
