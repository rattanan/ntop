import { prisma } from "../prisma";

export const APPROVAL_MODES = ["DISABLED", "ENFORCED"] as const;
export type ApprovalMode = (typeof APPROVAL_MODES)[number];

export const APPROVAL_WORKFLOW_CODES = [
  "QUOTE_APPROVAL",
  "PROPOSAL_APPROVAL",
  "SOLUTION_TECHNICAL_REVIEW",
  "SOLUTION_COMMERCIAL_APPROVAL",
  "SITE_SURVEY_RESULT_APPROVAL",
  "BOQ_APPROVAL",
  "CONTRACT_APPROVAL",
] as const;
export type ApprovalWorkflowCode = (typeof APPROVAL_WORKFLOW_CODES)[number];

export const APPROVAL_WORKFLOW_REFERENCE: ReadonlyArray<{
  id: string;
  code: ApprovalWorkflowCode;
  name: string;
  moduleCode: string;
  amountSource: string | null;
  policyId: string;
  policyCode: string;
  displayOrder: number;
}> = [
  { id: "approval_workflow_quote", code: "QUOTE_APPROVAL", name: "Quotation Approval", moduleCode: "COMMERCIAL", amountSource: "QuoteVersion.total", policyId: "approval_quote", policyCode: "QUOTE_APPROVAL", displayOrder: 10 },
  { id: "approval_workflow_proposal", code: "PROPOSAL_APPROVAL", name: "Proposal Approval", moduleCode: "PROPOSAL", amountSource: null, policyId: "approval_proposal", policyCode: "PROPOSAL_APPROVAL", displayOrder: 20 },
  { id: "approval_workflow_solution_technical", code: "SOLUTION_TECHNICAL_REVIEW", name: "Solution Technical Review", moduleCode: "PRESALES", amountSource: null, policyId: "approval_solution_technical", policyCode: "SOLUTION_TECHNICAL_REVIEW", displayOrder: 30 },
  { id: "approval_workflow_solution_commercial", code: "SOLUTION_COMMERCIAL_APPROVAL", name: "Solution Commercial Approval", moduleCode: "PRESALES", amountSource: "SolutionDesign.estimatedPrice", policyId: "approval_solution_commercial", policyCode: "SOLUTION_COMMERCIAL_APPROVAL", displayOrder: 40 },
  { id: "approval_workflow_site_survey", code: "SITE_SURVEY_RESULT_APPROVAL", name: "Site Survey Result Approval", moduleCode: "PRESALES", amountSource: null, policyId: "approval_site_survey", policyCode: "SITE_SURVEY_RESULT_APPROVAL", displayOrder: 50 },
  { id: "approval_workflow_boq", code: "BOQ_APPROVAL", name: "BOQ Approval", moduleCode: "PRESALES", amountSource: "BoqHeader.totalContractValue", policyId: "approval_boq", policyCode: "BOQ_APPROVAL", displayOrder: 60 },
  { id: "approval_workflow_contract", code: "CONTRACT_APPROVAL", name: "Contract Approval", moduleCode: "CONTRACT", amountSource: "Contract.totalContractValue", policyId: "approval_contract", policyCode: "CONTRACT_APPROVAL", displayOrder: 70 },
];

export class ApprovalWorkflowDisabledError extends Error {
  constructor(readonly workflowCode: ApprovalWorkflowCode) {
    super(`Approval workflow ${workflowCode} is disabled.`);
    this.name = "ApprovalWorkflowDisabledError";
  }
}

function mode(value: string | null | undefined): ApprovalMode {
  return APPROVAL_MODES.includes(value as ApprovalMode) ? value as ApprovalMode : "DISABLED";
}

export async function getApprovalControlState(workflowCode: ApprovalWorkflowCode) {
  if (process.env.APPROVAL_EMERGENCY_DISABLED === "true") {
    return { globalMode: "DISABLED" as const, workflowMode: "DISABLED" as const, effectiveMode: "DISABLED" as const, configured: false, emergencyDisabled: true };
  }
  const [system, workflow] = await Promise.all([
    prisma.approvalSystemConfiguration.findUnique({ where: { id: "approval_system" }, select: { mode: true } }),
    prisma.approvalWorkflowConfiguration.findUnique({ where: { code: workflowCode }, select: { mode: true, policy: { select: { activeVersionId: true } } } }),
  ]);
  const globalMode = mode(system?.mode);
  const workflowMode = mode(workflow?.mode);
  const effectiveMode: ApprovalMode = globalMode === "DISABLED" || workflowMode === "DISABLED" ? "DISABLED" : "ENFORCED";
  return { globalMode, workflowMode, effectiveMode, configured: Boolean(workflow?.policy.activeVersionId), emergencyDisabled: false };
}

export async function isApprovalWorkflowEnforced(workflowCode: ApprovalWorkflowCode) {
  return (await getApprovalControlState(workflowCode)).effectiveMode === "ENFORCED";
}

export async function assertApprovalWorkflowEnforced(workflowCode: ApprovalWorkflowCode) {
  if (!await isApprovalWorkflowEnforced(workflowCode)) throw new ApprovalWorkflowDisabledError(workflowCode);
}

export function approvalDefinitionHasSteps(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const definition = value as { rules?: unknown; fallbackSteps?: unknown };
  const ruleSteps = Array.isArray(definition.rules) && definition.rules.some((rule) => {
    if (!rule || typeof rule !== "object" || Array.isArray(rule)) return false;
    return Array.isArray((rule as { steps?: unknown }).steps) && ((rule as { steps: unknown[] }).steps.length > 0);
  });
  return ruleSteps || (Array.isArray(definition.fallbackSteps) && definition.fallbackSteps.length > 0);
}
