import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { PermissionDeniedError } from "@/lib/authorization/permission-policy";
import { ApprovalAccessError, ApprovalDecisionDeniedError, ApprovalVersionConflictError } from "@/lib/commercial/approval-service";
import { ApprovalPolicyUnavailableError, QuoteAccessError, QuoteFloorPriceError, QuoteSubmissionGateError, QuoteVersionImmutableError } from "@/lib/commercial/quote-service";
import { ForecastValidationError } from "@/lib/forecast/forecast-service";
import { OpportunityAccessError, OpportunityIdempotencyConflictError, OpportunityProbabilityOverrideDeniedError, OpportunityTransitionDeniedError, OpportunityValidationError, OpportunityVersionConflictError } from "@/lib/opportunity/opportunity-service";
import { LeadAccessError, LeadConversionError, LeadDuplicateResolutionRequiredError, LeadIdempotencyConflictError, LeadMergeDeniedError, LeadValidationError, LeadVersionConflictError } from "@/lib/lead/lead-service";
import { AiConfigurationRuntimeError } from "@/lib/ai/provider-configuration-runtime";
import { OpenAiCompatibleProviderError } from "@/lib/ai/openai-compatible-client";
import { AiInputPolicyError, AiOutputValidationError } from "@/lib/ai/safety-policy";
import { ProposalAccessError, ProposalConfigurationError, ProposalTerminalError, ProposalTransitionError, ProposalVersionConflictError } from "@/lib/proposal/proposal-service";
import { ContractAccessError, ContractConfigurationError, ContractDateRangeError, ContractMakerCheckerError, ContractServiceOrderError, ContractSignatureRequiredError, ContractTerminalError, ContractTransitionError, ContractVersionConflictError } from "@/lib/contract/contract-service";
import { ContractFinancialError } from "@/lib/contract/contract-financials";
import { ContractDocumentValidationError } from "@/lib/contract/contract-document-service";

export function workflowCorrelationId(request: Request) {
  const supplied = request.headers.get("x-correlation-id")?.trim();
  return supplied && supplied.length <= 191 ? supplied : crypto.randomUUID();
}

export function workflowUnauthenticated(correlationId: string) {
  return NextResponse.json({ error: { code: "UNAUTHENTICATED", message: "Authentication required", retryable: false, correlationId } }, { status: 401 });
}

export function requireIdempotencyKey(request: Request, correlationId: string) {
  const value = request.headers.get("idempotency-key")?.trim();
  if (value && value.length <= 191) return value;
  return NextResponse.json({ error: { code: "IDEMPOTENCY_KEY_REQUIRED", message: "Idempotency-Key is required", retryable: false, correlationId } }, { status: 400 });
}

export function workflowApiError(error: unknown, correlationId: string) {
  let status = 500;
  let code = "INTERNAL_ERROR";
  const message = "ไม่สามารถดำเนินการได้";
  let fieldErrors: Array<{ field: string; code: string }> | undefined;
  if (error instanceof SyntaxError || error instanceof ZodError || error instanceof ForecastValidationError || error instanceof OpportunityValidationError || error instanceof LeadValidationError || error instanceof AiInputPolicyError || error instanceof AiOutputValidationError || error instanceof ContractFinancialError || error instanceof ContractDateRangeError || error instanceof ContractDocumentValidationError) {
    status = 400; code = "VALIDATION_FAILED";
  } else if (error instanceof PermissionDeniedError || error instanceof ApprovalDecisionDeniedError || error instanceof OpportunityProbabilityOverrideDeniedError) {
    status = 403; code = "FORBIDDEN";
  } else if (error instanceof OpportunityAccessError || error instanceof LeadAccessError || error instanceof QuoteAccessError || error instanceof ApprovalAccessError || error instanceof ProposalAccessError || error instanceof ContractAccessError) {
    status = 404; code = "RESOURCE_NOT_FOUND";
  } else if (error instanceof OpportunityVersionConflictError || error instanceof LeadVersionConflictError || error instanceof ApprovalVersionConflictError || error instanceof ProposalVersionConflictError || error instanceof ContractVersionConflictError) {
    status = 409; code = "VERSION_CONFLICT";
  } else if (error instanceof OpportunityIdempotencyConflictError || error instanceof LeadIdempotencyConflictError) {
    status = 409; code = "IDEMPOTENCY_CONFLICT";
  } else if (error instanceof OpportunityTransitionDeniedError) {
    status = 422; code = "OPPORTUNITY_TRANSITION_DENIED";
    fieldErrors = error.missingFields.map((field) => ({ field, code: "REQUIRED" }));
  } else if (error instanceof LeadDuplicateResolutionRequiredError) {
    status = 409; code = "LEAD_DUPLICATE_RESOLUTION_REQUIRED";
    fieldErrors = [{ field: "duplicateOverrideReason", code: String(error.duplicateCount) }];
  } else if (error instanceof LeadConversionError) {
    status = 422; code = "LEAD_CONVERSION_DENIED";
  } else if (error instanceof LeadMergeDeniedError) {
    status = 422; code = "LEAD_MERGE_DENIED";
  } else if (error instanceof QuoteSubmissionGateError) {
    status = 422; code = "QUOTE_SUBMISSION_GATES_INCOMPLETE";
    fieldErrors = error.missingGates.map((field) => ({ field, code: "REQUIRED" }));
  } else if (error instanceof QuoteFloorPriceError) {
    status = 422; code = "QUOTE_BELOW_FLOOR_PRICE";
    fieldErrors = error.violations.map((item) => ({ field: `items.${item.productId}.unitPrice`, code: "BELOW_FLOOR" }));
  } else if (error instanceof QuoteVersionImmutableError) {
    status = 409; code = "QUOTE_VERSION_IMMUTABLE";
  } else if (error instanceof ApprovalPolicyUnavailableError) {
    status = 503; code = "APPROVAL_POLICY_UNAVAILABLE";
  } else if (error instanceof ProposalTransitionError) {
    status = 422; code = "PROPOSAL_TRANSITION_DENIED";
  } else if (error instanceof ProposalTerminalError) {
    status = 409; code = "PROPOSAL_TERMINAL";
  } else if (error instanceof ProposalConfigurationError) {
    status = 503; code = "PROPOSAL_CONFIGURATION_UNAVAILABLE";
  } else if (error instanceof ContractTransitionError || error instanceof ContractMakerCheckerError || error instanceof ContractSignatureRequiredError || error instanceof ContractServiceOrderError) {
    status = 422; code = "CONTRACT_COMMAND_DENIED";
  } else if (error instanceof ContractTerminalError) {
    status = 409; code = "CONTRACT_TERMINAL";
  } else if (error instanceof ContractConfigurationError) {
    status = 503; code = "CONTRACT_CONFIGURATION_UNAVAILABLE";
  } else if (error instanceof AiConfigurationRuntimeError || error instanceof OpenAiCompatibleProviderError) {
    status = 503; code = "AI_PROVIDER_UNAVAILABLE";
  }
  return NextResponse.json({ error: { code, message, ...(fieldErrors ? { fieldErrors } : {}), retryable: status === 503, correlationId } }, { status });
}
