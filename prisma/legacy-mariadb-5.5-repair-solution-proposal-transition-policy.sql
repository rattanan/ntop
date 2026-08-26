-- MariaDB 5.5 compatibility path for
-- 20260826140000_repair_solution_proposal_transition.

SET @ntop_solution_proposal_effective_at = NOW();

INSERT INTO `OpportunityTransitionPolicyVersion`
  (`id`, `policyCode`, `version`, `command`, `fromStage`, `toStage`, `requiredFields`, `requiredPermission`, `active`, `effectiveFrom`, `createdAt`)
SELECT
  'otp_solution_proposal_v2', 'SOLUTION_PROPOSAL', 2, 'FORWARD', 'SOLUTION', 'PROPOSAL',
  '["coverageConfirmed","solutionComplete"]', 'opportunity.transition', 1,
  @ntop_solution_proposal_effective_at, @ntop_solution_proposal_effective_at
FROM DUAL
WHERE NOT EXISTS (
  SELECT 1
  FROM `OpportunityTransitionPolicyVersion`
  WHERE `policyCode` = 'SOLUTION_PROPOSAL'
    AND `version` >= 2
);

UPDATE `OpportunityTransitionPolicyVersion`
SET `active` = 0,
    `effectiveTo` = IFNULL(`effectiveTo`, @ntop_solution_proposal_effective_at)
WHERE `policyCode` = 'SOLUTION_PROPOSAL'
  AND `version` = 1
  AND `active` = 1
  AND EXISTS (
    SELECT 1 FROM (
      SELECT `id`
      FROM `OpportunityTransitionPolicyVersion`
      WHERE `policyCode` = 'SOLUTION_PROPOSAL'
        AND `version` >= 2
      LIMIT 1
    ) AS `newer_solution_proposal_policy`
  );
