import { LeadSource, LeadStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { PrismaLeadRepository } from "../../lib/lead/prisma-lead-repository";
import type { LeadRecord } from "../../lib/lead/lead-service";

describe("PrismaLeadRepository conversion mapping", () => {
  it("copies the requirement summary and converts from the current active status", async () => {
    const opportunityData: Array<Record<string, unknown>> = [];
    const updateWhere: Array<Record<string, unknown>> = [];
    const lead: LeadRecord = {
      id: "lead-1",
      company: "Acme",
      contactName: "Ada",
      contactEmail: "ada@acme.test",
      source: LeadSource.WEBSITE,
      status: LeadStatus.ASSIGNED,
      score: 80,
      recommendedProducts: "Managed network",
      requirementSummary: "Connect three branches with managed SD-WAN",
      notes: "Internal follow-up note",
      ownerId: "owner-1",
      organizationUnitId: "org-1",
      customerId: null,
      version: 3,
    };
    const transaction = {
      contact: {
        findFirst: async () => null,
        create: async () => ({ id: "contact-1" }),
      },
      opportunityNumberSequence: {
        upsert: async () => ({}),
        update: async () => ({ nextValue: 1 }),
      },
      opportunity: {
        create: async ({ data }: { data: Record<string, unknown> }) => {
          opportunityData.push(data);
          return { id: "opportunity-1" };
        },
      },
      lead: {
        updateMany: async ({ where }: { where: Record<string, unknown> }) => { updateWhere.push(where); return { count: 1 }; },
        findUniqueOrThrow: async () => ({ ...lead, status: LeadStatus.CONVERTED, customerId: "customer-1", contactId: "contact-1", version: 4 }),
      },
    };

    const repository = new PrismaLeadRepository({} as never);
    await repository.completeConversion({ lead, expectedVersion: 3, customerId: "customer-1", opportunityName: "Acme SD-WAN", opportunityFlow: "DIRECT", estimatedValue: "100000.0000", expectedCloseAt: new Date("2026-12-01T00:00:00Z"), probability: 40, productInterest: "Managed network" }, transaction as never);

    expect(opportunityData).toHaveLength(1);
    expect(opportunityData[0]).toMatchObject({
      requirements: `${lead.requirementSummary}\n\n${lead.notes}`,
      nextAction: "Managed network",
      sourceLeadId: lead.id,
    });
    expect(updateWhere).toEqual([{ id: lead.id, version: 3, status: LeadStatus.ASSIGNED }]);
  });
});
