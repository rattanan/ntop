export type NTSPSiteSurveyRequestV1 = {
  schemaVersion: "1.0";
  correlationId: string;
  sourceSystem: "NT_ENTERPRISE_SALES_PLATFORM";
  requestNumber: string;
  requestedAt: string;
  opportunity: { opportunityId: string; opportunityNumber: string; opportunityName: string };
  customer: { accountId?: string; customerName: string; customerType?: string; taxId?: string };
  service: {
    serviceCategory: string;
    productCode?: string;
    productName?: string;
    requestedBandwidth?: string;
    accessTechnologyPreference?: string;
    redundancyRequired: boolean;
    primaryOrBackup?: "PRIMARY" | "BACKUP" | "BOTH";
    requestedSLA?: string;
    targetActivationDate?: string;
    specialRequirements?: string;
  };
  installationSite: {
    siteId: string;
    siteCode?: string;
    siteName: string;
    buildingName?: string;
    floor?: string;
    room?: string;
    addressLine1: string;
    addressLine2?: string;
    subdistrict?: string;
    district: string;
    province: string;
    postalCode?: string;
    latitude: number;
    longitude: number;
    landmark?: string;
    accessInstructions?: string;
    operatingHours?: string;
  };
  contacts: Array<{
    contactId?: string;
    fullName: string;
    jobTitle?: string;
    department?: string;
    phone: string;
    email?: string;
    preferredContactMethod?: string;
    primaryContact: boolean;
    notes?: string;
  }>;
  attachments?: Array<{ documentId: string; documentType: string; fileName: string; downloadReference: string }>;
};

export type NTSPSiteSurveyResponseV1 = {
  schemaVersion: "1.0";
  correlationId: string;
  externalRequestId: string;
  externalReferenceNumber?: string;
  responseStatus: "ACKNOWLEDGED" | "ASSIGNED" | "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "REJECTED" | "FAILED";
  updatedAt: string;
  surveyAssignment?: { surveyTeamCode?: string; surveyTeamName?: string; surveyEngineerName?: string; surveyEngineerPhone?: string; scheduledSurveyDate?: string };
  surveyResult?: {
    feasibilityStatus: "FEASIBLE" | "FEASIBLE_WITH_CONDITIONS" | "NOT_FEASIBLE" | "MORE_INFORMATION_REQUIRED";
    recommendedAccessTechnology?: string;
    availableBandwidth?: string;
    estimatedLeadTimeDays?: number;
    nearestNetworkNode?: string;
    estimatedDistanceMeters?: number;
    newFiberRequired?: boolean;
    civilWorkRequired?: boolean;
    permissionRequired?: boolean;
    sitePreparationRequired?: boolean;
    customerActionRequired?: boolean;
    technicalSummary?: string;
    conditions?: string[];
    risks?: string[];
    recommendations?: string[];
  };
  estimatedItems?: Array<{
    externalItemCode?: string;
    itemType: "MATERIAL" | "EQUIPMENT" | "LABOR" | "SERVICE" | "OTHER";
    itemName: string;
    description?: string;
    quantity: number;
    unit: string;
    estimatedUnitCost?: number;
    estimatedTotalCost?: number;
  }>;
  attachments?: Array<{ externalDocumentId?: string; documentType: string; fileName: string; downloadReference?: string }>;
  error?: { errorCode: string; errorMessage: string; retryable: boolean };
};

export type SiteSurveySubmissionResult = { accepted: boolean; provider: "MANUAL" | "MOCK_NTSP"; internalRequestId: string; externalRequestId?: string; status: string };
export type SiteSurveyStatusResult = { externalRequestId: string; status: NTSPSiteSurveyResponseV1["responseStatus"]; updatedAt: string };
export type SiteSurveyCancellationResult = { cancelled: boolean; externalRequestId: string; reason: string };

export interface SiteSurveyIntegrationProvider {
  submitSurveyRequest(request: NTSPSiteSurveyRequestV1): Promise<SiteSurveySubmissionResult>;
  getSurveyStatus(externalRequestId: string): Promise<SiteSurveyStatusResult>;
  getSurveyResult(externalRequestId: string): Promise<NTSPSiteSurveyResponseV1>;
  cancelSurveyRequest(externalRequestId: string, reason: string): Promise<SiteSurveyCancellationResult>;
}
