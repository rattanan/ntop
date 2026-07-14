import { describe, expect, it, vi } from "vitest";

import type { AuditWriter } from "../../lib/audit/audit-writer";
import {
  OpportunityService,
  OpportunityTransitionDeniedError,
  OpportunityVersionConflictError,
  type OpportunityRepository,
  type OpportunityTransitionRecord,
} from "../../lib/opportunity/opportunity-service";

type Tx = { id: string };
const tx = { id: "tx" };
const actor = {
  id: "admin-1",
  role: "ADMIN" as const,
  authorization: {
    actorId: "admin-1",
    assignments: [{ role: "ADMIN" as const, scope: "ENTERPRISE" as const, organizationUnitId: null }],
  },
};
const current: OpportunityTransitionRecord = {
  id: "opp-1", version: 1, stage: "QUALIFY", ownerId: "admin-1", organizationUnitId: null,
  requirements: "Need", qualificationResult: "Qualified", stakeholderSummary: null,
  nextAction: "Discovery meeting", expectedCloseAt: new Date("2026-09-01T00:00:00Z"),
  coverageConfirmed: false, solutionComplete: false, quoteSubmitted: false,
  quoteApproved: false, quoteAccepted: false,
};
const profileInput = {
  name: "Enterprise WAN", customerId: "customer-1", flow: "DIRECT",
  estimatedValue: "1000.0000", currency: "THB", probability: 50, forecastCategory: "PIPELINE" as const,
  expectedCloseAt: null, organizationUnitId: null, ownerId: "admin-1", nextAction: null, requirements: null,
  qualificationResult: null, stakeholderSummary: null,
  assessment: { approach: "DIRECT" as const, confidence: 50, incumbentVendor: null, competitors: null, rationale: null },
};
const profile = { id: "opp-1", opportunityNumber: "OPP-2026-000001", probabilitySource: "STAGE_DEFAULT", version: 1, stage: "QUALIFY" as const, ...profileInput };

function setup() {
  const repository: OpportunityRepository<Tx> = {
    transaction: vi.fn(async (work) => work(tx)),
    findAccessible: vi.fn().mockResolvedValue(current),
    findAccessibleProfile: vi.fn().mockResolvedValue(profile),
    findAccessibleCustomer: vi.fn().mockResolvedValue({ id: "customer-1", organizationUnitId: null }),
    createProfile: vi.fn().mockResolvedValue(profile),
    updateProfileVersioned: vi.fn().mockResolvedValue({ ...profile, version: 2 }),
    overrideProbabilityVersioned: vi.fn().mockResolvedValue({ ...profile, probability: 65, probabilitySource: "MANUAL_OVERRIDE", version: 2 }),
    appendProbabilityHistory: vi.fn().mockResolvedValue(undefined),
    findPolicy: vi.fn().mockResolvedValue({ id: "policy-1", requiredFields: ["qualificationResult", "nextAction"], requiredPermission: "opportunity.transition" }),
    hasGrantedPermission: vi.fn().mockResolvedValue(false),
    findReceipt: vi.fn().mockResolvedValue(null),
    transitionVersioned: vi.fn().mockResolvedValue({ ...current, stage: "DISCOVER", version: 2 }),
    appendHistory: vi.fn().mockResolvedValue(undefined),
    saveReceipt: vi.fn().mockResolvedValue(undefined),
  };
  const audit: AuditWriter<Tx> = { append: vi.fn(async (event) => ({ ...event, id: "audit", recordedAt: new Date() })) };
  return { repository, audit, service: new OpportunityService(repository, audit, undefined, () => new Date("2026-07-13T00:00:00Z")) };
}

describe("OpportunityService", () => {
  it("creates through one transaction with audit and idempotency receipt", async () => {
    const { service, repository, audit } = setup();
    await expect(service.create(actor, profileInput, "corr-create", "idem-create")).resolves.toMatchObject({ id: "opp-1", stage: "QUALIFY" });
    expect(repository.createProfile).toHaveBeenCalledWith(expect.not.objectContaining({ stage: expect.anything() }), tx);
    expect(audit.append).toHaveBeenCalledWith(expect.objectContaining({ action: "opportunity.create" }), { transaction: tx });
    expect(repository.saveReceipt).toHaveBeenCalledWith(expect.objectContaining({ command: "opportunity.create" }), tx);
  });

  it("updates profile optimistically without accepting a direct stage mutation", async () => {
    const { service, repository } = setup();
    await expect(service.update(actor, "opp-1", 1, { ...profileInput, stage: "WON" }, "corr-update", "idem-update")).rejects.toMatchObject({ name: "OpportunityValidationError" });
    await expect(service.update(actor, "opp-1", 1, profileInput, "corr-update", "idem-update")).resolves.toMatchObject({ version: 2, stage: "QUALIFY" });
    expect(repository.updateProfileVersioned).toHaveBeenCalledWith("opp-1", 1, expect.objectContaining({ probability: profile.probability }), tx);
  });

  it("applies configured transition, history, audit and receipt atomically", async () => {
    const { service, repository, audit } = setup();
    await expect(service.transition(actor, "opp-1", { targetStage: "DISCOVER", command: "FORWARD", expectedVersion: 1 }, "corr-1", "idem-1")).resolves.toMatchObject({ stage: "DISCOVER", version: 2 });
    expect(repository.appendHistory).toHaveBeenCalledWith(expect.objectContaining({ fromStage: "QUALIFY", toStage: "DISCOVER", aggregateVersion: 2 }), tx);
    expect(audit.append).toHaveBeenCalledWith(expect.objectContaining({ action: "opportunity.transition" }), { transaction: tx });
    expect(repository.saveReceipt).toHaveBeenCalled();
  });

  it("denies a transition missing required configured evidence", async () => {
    const { service, repository } = setup();
    vi.mocked(repository.findAccessible).mockResolvedValue({ ...current, nextAction: null });
    await expect(service.transition(actor, "opp-1", { targetStage: "DISCOVER", command: "FORWARD", expectedVersion: 1 }, "corr", "idem")).rejects.toMatchObject({ missingFields: ["nextAction"] } satisfies Partial<OpportunityTransitionDeniedError>);
    expect(repository.transitionVersioned).not.toHaveBeenCalled();
  });

  it("returns conflict without history when aggregate version is stale", async () => {
    const { service, repository } = setup();
    await expect(service.transition(actor, "opp-1", { targetStage: "DISCOVER", command: "FORWARD", expectedVersion: 0 }, "corr", "idem")).rejects.toBeInstanceOf(OpportunityVersionConflictError);
    expect(repository.appendHistory).not.toHaveBeenCalled();
  });

  it("denies matrix entries absent from configured policy", async () => {
    const { service, repository } = setup();
    vi.mocked(repository.findPolicy).mockResolvedValue(null);
    await expect(service.transition(actor, "opp-1", { targetStage: "PROPOSAL", command: "FORWARD", expectedVersion: 1 }, "corr", "idem")).rejects.toBeInstanceOf(OpportunityTransitionDeniedError);
  });

  it("overrides probability with permission, history, audit and idempotency in one transaction", async () => {
    const { service, repository, audit } = setup();
    vi.mocked(repository.hasGrantedPermission).mockResolvedValue(true);
    await expect(service.overrideProbability(actor, "opp-1", { probability: 65, reason: "Manager forecast review", expectedVersion: 1 }, "corr-prob", "idem-prob")).resolves.toMatchObject({ probability: 65, probabilitySource: "MANUAL_OVERRIDE", version: 2 });
    expect(repository.appendProbabilityHistory).toHaveBeenCalledWith(expect.objectContaining({ previousProbability: 50, newProbability: 65, changedById: "admin-1", aggregateVersion: 2 }), tx);
    expect(audit.append).toHaveBeenCalledWith(expect.objectContaining({ action: "opportunity.probability.override" }), { transaction: tx });
    expect(repository.saveReceipt).toHaveBeenCalledWith(expect.objectContaining({ command: "opportunity.probability.override" }), tx);
  });

  it("rejects probability override without an explicit permission grant", async () => {
    const { service, repository } = setup();
    const salesActor = { ...actor, role: "SALES" as const, authorization: { ...actor.authorization, assignments: [{ role: "KAM" as const, scope: "SELF" as const, organizationUnitId: null }] } };
    await expect(service.overrideProbability(salesActor, "opp-1", { probability: 70, reason: "Unapproved change", expectedVersion: 1 }, "corr", "idem")).rejects.toMatchObject({ name: "OpportunityProbabilityOverrideDeniedError" });
    expect(repository.overrideProbabilityVersioned).not.toHaveBeenCalled();
  });
});
