-- Restore the approved canonical SOLUTION -> PROPOSAL route as versioned
-- reference data. The route remains governed by server-side permission and
-- the coverage/solution evidence gates from docs/opportunity-workflow.md.
-- A later administrator-created version is never replaced.

SET @ntop_solution_proposal_effective_at = CURRENT_TIMESTAMP(3);

INSERT INTO `OpportunityTransitionPolicyVersion`
  (`id`, `policyCode`, `version`, `command`, `fromStage`, `toStage`, `requiredFields`, `requiredPermission`, `active`, `effectiveFrom`, `createdAt`)
SELECT
  'otp_solution_proposal_v2', 'SOLUTION_PROPOSAL', 2, 'FORWARD', 'SOLUTION', 'PROPOSAL',
  JSON_ARRAY('coverageConfirmed', 'solutionComplete'), 'opportunity.transition', true,
  @ntop_solution_proposal_effective_at, @ntop_solution_proposal_effective_at
FROM DUAL
WHERE NOT EXISTS (
  SELECT 1
  FROM `OpportunityTransitionPolicyVersion`
  WHERE `policyCode` = 'SOLUTION_PROPOSAL'
    AND `version` >= 2
);

UPDATE `OpportunityTransitionPolicyVersion`
SET `active` = false,
    `effectiveTo` = COALESCE(`effectiveTo`, @ntop_solution_proposal_effective_at)
WHERE `policyCode` = 'SOLUTION_PROPOSAL'
  AND `version` = 1
  AND `active` = true
  AND EXISTS (
    SELECT 1 FROM (
      SELECT `id`
      FROM `OpportunityTransitionPolicyVersion`
      WHERE `policyCode` = 'SOLUTION_PROPOSAL'
        AND `version` >= 2
      LIMIT 1
    ) AS `newer_solution_proposal_policy`
  );
