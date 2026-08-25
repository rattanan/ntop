-- Version the QUALIFY -> DISCOVER policy so qualificationResult becomes
-- optional while nextAction remains the minimum actionable sales gate.
-- The guarded insert preserves any later administrator-created version.

SET @ntop_qualify_discover_effective_at = CURRENT_TIMESTAMP(3);

UPDATE `OpportunityTransitionPolicyVersion`
SET `active` = false,
    `effectiveTo` = COALESCE(`effectiveTo`, @ntop_qualify_discover_effective_at)
WHERE `policyCode` = 'QUALIFY_DISCOVER'
  AND `version` = 1
  AND `active` = true;

INSERT INTO `OpportunityTransitionPolicyVersion`
  (`id`, `policyCode`, `version`, `command`, `fromStage`, `toStage`, `requiredFields`, `requiredPermission`, `active`, `effectiveFrom`, `createdAt`)
SELECT
  'otp_qualify_discover_v2', 'QUALIFY_DISCOVER', 2, 'FORWARD', 'QUALIFY', 'DISCOVER',
  JSON_ARRAY('nextAction'), 'opportunity.transition', true,
  @ntop_qualify_discover_effective_at, @ntop_qualify_discover_effective_at
FROM DUAL
WHERE NOT EXISTS (
  SELECT 1
  FROM `OpportunityTransitionPolicyVersion`
  WHERE `policyCode` = 'QUALIFY_DISCOVER'
    AND `version` >= 2
);
