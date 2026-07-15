import type {
  NTSPSiteSurveyRequestV1,
  NTSPSiteSurveyResponseV1,
  SiteSurveyCancellationResult,
  SiteSurveyIntegrationProvider,
  SiteSurveyStatusResult,
  SiteSurveySubmissionResult,
} from "./contracts";

export class ManualSiteSurveyProvider implements SiteSurveyIntegrationProvider {
  async submitSurveyRequest(request: NTSPSiteSurveyRequestV1): Promise<SiteSurveySubmissionResult> {
    return { accepted: true, provider: "MANUAL", internalRequestId: request.requestNumber, status: "SUBMITTED" };
  }
  async getSurveyStatus(externalRequestId: string): Promise<SiteSurveyStatusResult> {
    return { externalRequestId, status: "ACKNOWLEDGED", updatedAt: new Date().toISOString() };
  }
  async getSurveyResult(externalRequestId: string): Promise<NTSPSiteSurveyResponseV1> {
    throw new Error(`Manual result for ${externalRequestId} must be entered by an authorized user.`);
  }
  async cancelSurveyRequest(externalRequestId: string, reason: string): Promise<SiteSurveyCancellationResult> {
    return { cancelled: true, externalRequestId, reason };
  }
}

export class MockNTSPSiteSurveyProvider implements SiteSurveyIntegrationProvider {
  constructor(environment = process.env.NODE_ENV) {
    if (environment === "production") throw new Error("Mock NTSP provider is disabled in production.");
  }
  async submitSurveyRequest(request: NTSPSiteSurveyRequestV1): Promise<SiteSurveySubmissionResult> {
    return { accepted: true, provider: "MOCK_NTSP", internalRequestId: request.requestNumber, externalRequestId: `MOCK-${request.requestNumber}`, status: "ACKNOWLEDGED" };
  }
  async getSurveyStatus(externalRequestId: string): Promise<SiteSurveyStatusResult> {
    return { externalRequestId, status: "COMPLETED", updatedAt: "2026-01-01T00:00:00.000Z" };
  }
  async getSurveyResult(externalRequestId: string): Promise<NTSPSiteSurveyResponseV1> {
    return { schemaVersion: "1.0", correlationId: externalRequestId, externalRequestId, responseStatus: "COMPLETED", updatedAt: "2026-01-01T00:00:00.000Z", surveyResult: { feasibilityStatus: "FEASIBLE", technicalSummary: "Deterministic local test response" }, estimatedItems: [] };
  }
  async cancelSurveyRequest(externalRequestId: string, reason: string): Promise<SiteSurveyCancellationResult> {
    return { cancelled: true, externalRequestId, reason };
  }
}

export function siteSurveyProviderFromEnvironment() {
  const mode = process.env.SITE_SURVEY_INTEGRATION_MODE ?? "MANUAL";
  if (mode === "MOCK_NTSP" && process.env.NODE_ENV !== "production") return new MockNTSPSiteSurveyProvider();
  return new ManualSiteSurveyProvider();
}
