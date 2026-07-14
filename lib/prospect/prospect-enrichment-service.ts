import { z } from "zod";

import type { AuditWriter } from "../audit/audit-writer";
import { createActiveProviderClient } from "../ai/provider-configuration-runtime";
import { PERMISSIONS } from "../authorization/permission-policy";
import { ProspectAccessError, requireProspectPermission } from "./prospect-authorization";
import type { ProspectTransaction, PrismaProspectRepository } from "./prospect-repository";
import type { ProspectActor } from "./prospect-service";

const outputSchema = z.strictObject({
  companySummary: z.string().max(5000),
  businessClassification: z.string().max(1000),
  estimatedCompanySize: z.string().max(500),
  potentialBusinessNeeds: z.array(z.string().max(500)).max(20),
  recommendedProducts: z.array(z.string().max(500)).max(20),
  opportunityScore: z.number().int().min(0).max(100),
  riskScore: z.number().int().min(0).max(100),
  confidenceScore: z.number().int().min(0).max(100),
  suggestedDiscoveryQuestions: z.array(z.string().max(1000)).max(30),
  suggestedNextAction: z.string().max(2000),
  suggestedContactStrategy: z.string().max(2000),
  missingInformation: z.array(z.string().max(500)).max(30),
});

export interface ProspectEnrichmentProvider {
  enrich(input: Record<string, unknown>): Promise<{
    data: z.infer<typeof outputSchema>;
    providerVersionId: string;
    model: string;
  }>;
}

export class ConfiguredProspectEnrichmentProvider implements ProspectEnrichmentProvider {
  async enrich(input: Record<string, unknown>) {
    const provider = await createActiveProviderClient();
    const result = await provider.client.createChatCompletion([
      {
        role: "system",
        content:
          "Analyze the supplied synthetic/business prospect facts only. Do not browse or invent facts. Return JSON only with keys companySummary,businessClassification,estimatedCompanySize,potentialBusinessNeeds,recommendedProducts,opportunityScore,riskScore,confidenceScore,suggestedDiscoveryQuestions,suggestedNextAction,suggestedContactStrategy,missingInformation.",
      },
      { role: "user", content: JSON.stringify(input) },
    ]);
    const parsed = outputSchema.parse(JSON.parse(result.content));
    return {
      data: parsed,
      providerVersionId: provider.configurationVersionId,
      model: provider.model,
    };
  }
}

export class ProspectEnrichmentService {
  constructor(
    private repository: PrismaProspectRepository,
    private audit: AuditWriter<ProspectTransaction>,
    private provider: ProspectEnrichmentProvider = new ConfiguredProspectEnrichmentProvider(),
  ) {}

  async enrich(actor: ProspectActor, id: string, correlationId: string) {
    requireProspectPermission(actor.permissions, PERMISSIONS.prospectUpdate);
    const prospect = await this.repository.transaction(async (tx) => {
      const value = await this.repository.findAccessible(
        id,
        actor.authorization,
        actor.permissions,
        tx,
      );
      if (!value) throw new ProspectAccessError();
      await tx.prospect.update({
        where: { id },
        data: { enrichmentStatus: "PROCESSING", updatedById: actor.id },
      });
      return value;
    });

    try {
      const result = await this.provider.enrich({
        companyName: prospect.companyName,
        website: prospect.website,
        industryId: prospect.industryId,
        companyDescription: prospect.companyDescription,
        currentTelecomProvider: prospect.currentTelecomProvider,
        currentInternetProvider: prospect.currentInternetProvider,
        currentCloudProvider: prospect.currentCloudProvider,
        currentSecurityProvider: prospect.currentSecurityProvider,
        businessPainPoints: prospect.businessPainPoints,
        source: prospect.source,
        expectedBudget: prospect.expectedBudget?.toString(),
        numberOfBranches: prospect.numberOfBranches,
        numberOfEmployees: prospect.numberOfEmployees,
      });

      return this.repository.transaction(async (tx) => {
        await tx.prospect.update({
          where: { id },
          data: {
            enrichmentStatus: "READY",
            enrichmentData: {
              output: result.data,
              provenance: {
                providerVersionId: result.providerVersionId,
                model: result.model,
                generatedAt: new Date().toISOString(),
              },
            },
            enrichmentUpdatedAt: new Date(),
            updatedById: actor.id,
          },
        });
        await this.audit.append(
          {
            actorId: actor.id,
            action: "prospect.enrichment.generate",
            targetType: "Prospect",
            targetId: id,
            outcome: "SUCCESS",
            correlationId,
            data: {
              providerVersionId: result.providerVersionId,
              model: result.model,
            },
          },
          { transaction: tx },
        );
        return result.data;
      });
    } catch (error) {
      await this.repository.transaction(async (tx) => {
        await tx.prospect.update({
          where: { id },
          data: { enrichmentStatus: "FAILED", updatedById: actor.id },
        });
        await this.audit.append(
          {
            actorId: actor.id,
            action: "prospect.enrichment.generate",
            targetType: "Prospect",
            targetId: id,
            outcome: "FAILURE",
            correlationId,
            data: { errorType: error instanceof Error ? error.name : "UnknownError" },
          },
          { transaction: tx },
        );
      });
      throw error;
    }
  }

  async confirm(actor: ProspectActor, id: string, correlationId: string) {
    requireProspectPermission(actor.permissions, PERMISSIONS.prospectUpdate);
    return this.repository.transaction(async (tx) => {
      const prospect = await this.repository.findAccessible(
        id,
        actor.authorization,
        actor.permissions,
        tx,
      );
      if (!prospect || prospect.enrichmentStatus !== "READY") throw new ProspectAccessError();
      const record = prospect.enrichmentData as { output?: unknown };
      const data = outputSchema.parse(record?.output);
      const updated = await tx.prospect.update({
        where: { id },
        data: {
          aiSummary: data.companySummary,
          aiOpportunityScore: data.opportunityScore,
          aiRiskScore: data.riskScore,
          aiConfidenceScore: data.confidenceScore,
          recommendedProducts: data.recommendedProducts.join(", "),
          suggestedQuestions: data.suggestedDiscoveryQuestions,
          suggestedNextAction: data.suggestedNextAction,
          enrichmentStatus: "CONFIRMED",
          updatedById: actor.id,
          version: { increment: 1 },
        },
      });
      await this.audit.append(
        {
          actorId: actor.id,
          action: "prospect.enrichment.confirm",
          targetType: "Prospect",
          targetId: id,
          targetVersion: String(updated.version),
          outcome: "SUCCESS",
          correlationId,
          data: {
            confirmedFields: [
              "aiSummary",
              "aiOpportunityScore",
              "aiRiskScore",
              "aiConfidenceScore",
              "recommendedProducts",
              "suggestedQuestions",
              "suggestedNextAction",
            ],
          },
        },
        { transaction: tx },
      );
      return updated;
    });
  }
}
