import { describe, expect, it, vi } from "vitest";

import type { AuditWriter } from "../../lib/audit/audit-writer";
import { QuoteFloorPriceError, QuoteService, QuoteSubmissionGateError, type QuoteRepository, type QuoteVersionRecord } from "../../lib/commercial/quote-service";

type Tx = { id: string }; const tx = { id: "tx" };
const actor = { id: "admin", role: "ADMIN" as const, authorization: { actorId: "admin", assignments: [{ role: "ADMIN" as const, scope: "ENTERPRISE" as const, organizationUnitId: null }] } };
const version: QuoteVersionRecord = { id: "qv", quoteId: "q", versionNumber: 1, status: "DRAFT", makerId: "admin", opportunityId: "opp", customerId: "customer", customerSegment: "B1", coverageConfirmed: false, solutionComplete: false, opportunityRisk: "NONE", total: "1000.0000", discountPct: "0.0000", grossMarginPct: "20.0000", productCategories: ["Network"], costConfirmed: false, nonStandardTerms: false };

function setup() {
  const repository: QuoteRepository<Tx> = {
    transaction: vi.fn(async (work) => work(tx)), findReceipt: vi.fn().mockResolvedValue(null), saveReceipt: vi.fn().mockResolvedValue(undefined),
    findOpportunity: vi.fn().mockResolvedValue({ id: "opp", customerId: "customer", customerSegment: "B1", coverageConfirmed: false, solutionComplete: false, opportunityRisk: "NONE" }),
    findProposal: vi.fn().mockResolvedValue({ id: "proposal", opportunityId: "opp", customerId: "customer" }),
    findQuote: vi.fn().mockResolvedValue(null), loadProducts: vi.fn().mockResolvedValue([{ id: "product", code: "P", name: "Product", category: "Network", listPrice: "1000.0000", floorPrice: null, standardCost: "800.0000", costConfirmed: true }]),
    createVersion: vi.fn().mockResolvedValue(version), findVersion: vi.fn().mockResolvedValue(version), transitionVersion: vi.fn().mockImplementation(async ({ toStatus }) => ({ ...version, status: toStatus })),
    activeApprovalPolicy: vi.fn().mockResolvedValue({ id: "policy-v1", definition: { submissionGates: { coverageRequired: true, solutionRequired: true, confirmedCostRequired: true }, rules: [], fallbackSteps: [{ code: "manager", sequence: 1, executionMode: "SEQUENTIAL", requiredPermission: "approval.manager", makerChecker: true }] } }),
    submitVersion: vi.fn().mockResolvedValue({ requestId: "request" }),
  };
  const audit: AuditWriter<Tx> = { append: vi.fn(async (event) => ({ ...event, id: "audit", recordedAt: new Date() })) };
  return { repository, audit, service: new QuoteService(repository, audit) };
}

describe("QuoteService", () => {
  it("creates an Opportunity-bound immutable version with a receipt", async () => {
    const { service, repository } = setup();
    await service.createVersion(actor, { opportunityId: "opp", currency: "THB", items: [{ productId: "product", quantity: "1", discountPct: "10" }] }, "corr", "idem");
    expect(repository.createVersion).toHaveBeenCalledWith(expect.objectContaining({ versionNumber: 1, opportunity: expect.objectContaining({ id: "opp" }) }), tx);
    expect(repository.saveReceipt).toHaveBeenCalled();
  });

  it("supports multiple detail lines and an explicit selling price", async () => {
    const { service, repository } = setup();
    await service.createVersion(actor, { opportunityId: "opp", currency: "THB", items: [{ productId: "product", quantity: "2", unitPrice: "900.0000", discountPct: "0" }, { productId: "product", quantity: "1", unitPrice: "1100.0000", discountPct: "10" }] }, "corr", "multi-line");
    const input = vi.mocked(repository.createVersion).mock.calls[0][0];
    expect(input.calculations.lines).toHaveLength(2);
    expect(input.calculations.total.toFixed(4)).toBe("2790.0000");
  });

  it("creates the next immutable revision on the same Quote after return or rejection", async () => {
    const { service, repository } = setup();
    vi.mocked(repository.findQuote).mockResolvedValue({ id: "q", opportunityId: "opp", proposalId: null, makerId: "admin", latestVersion: 1 });
    await service.createVersion(actor, { quoteId: "q", opportunityId: "opp", currency: "THB", items: [{ productId: "product", quantity: "1" }] }, "corr", "revision");
    expect(repository.createVersion).toHaveBeenCalledWith(expect.objectContaining({ versionNumber: 2, draft: expect.objectContaining({ quoteId: "q" }) }), tx);
  });

  it("links a Proposal only when it belongs to the same Opportunity and Customer", async () => {
    const { service, repository } = setup();
    await service.createVersion(actor, { proposalId: "proposal", opportunityId: "opp", currency: "THB", items: [{ productId: "product", quantity: "1" }] }, "corr", "proposal-quote");
    expect(repository.findProposal).toHaveBeenCalled();
    expect(repository.createVersion).toHaveBeenCalledWith(expect.objectContaining({ draft: expect.objectContaining({ proposalId: "proposal" }) }), tx);
    vi.mocked(repository.findProposal!).mockResolvedValue({ id: "proposal", opportunityId: "other", customerId: "customer" });
    await expect(service.createVersion(actor, { proposalId: "proposal", opportunityId: "opp", currency: "THB", items: [{ productId: "product", quantity: "1" }] }, "corr", "invalid-proposal-quote")).rejects.toThrow("Quote is unavailable");
  });

  it("rejects a net unit price below configured floor price", async () => {
    const { service, repository } = setup();
    vi.mocked(repository.loadProducts).mockResolvedValue([{ id: "product", code: "P", name: "Product", category: "Network", listPrice: "1000.0000", floorPrice: "950.0000", standardCost: "800.0000", costConfirmed: true }]);
    await expect(service.createVersion(actor, { opportunityId: "opp", currency: "THB", items: [{ productId: "product", quantity: "1", unitPrice: "1000.0000", discountPct: "10" }] }, "corr", "below-floor")).rejects.toMatchObject({ violations: [{ productId: "product", floorPrice: "950.0000", effectiveUnitPrice: "900.0000" }] } satisfies Partial<QuoteFloorPriceError>);
    expect(repository.createVersion).not.toHaveBeenCalled();
  });

  it("blocks submit when configured server gates are incomplete", async () => {
    const { service, repository } = setup();
    await expect(service.submit(actor, "qv", "corr", "idem")).rejects.toMatchObject({ missingGates: ["coverageConfirmed", "solutionComplete", "costConfirmed"] } satisfies Partial<QuoteSubmissionGateError>);
    expect(repository.submitVersion).not.toHaveBeenCalled();
  });

  it("returns the prior request for an idempotent submit retry", async () => {
    const { service, repository } = setup();
    vi.mocked(repository.findReceipt).mockResolvedValue({ targetId: "request", resultVersion: 1 });
    await expect(service.submit(actor, "qv", "corr", "idem")).resolves.toEqual({ requestId: "request" });
    expect(repository.findVersion).not.toHaveBeenCalled();
  });

  it("moves an approved quote through sent to accepted with audit and idempotency receipts", async () => {
    const { service, repository, audit } = setup();
    vi.mocked(repository.findVersion).mockResolvedValue({ ...version, status: "APPROVED" });
    await expect(service.transition(actor, "qv", "SENT", "corr", "send")).resolves.toMatchObject({ status: "SENT" });
    expect(repository.transitionVersion).toHaveBeenCalledWith(expect.objectContaining({ toStatus: "SENT" }), tx);
    expect(audit.append).toHaveBeenCalledWith(expect.objectContaining({ action: "quote.version.sent" }), { transaction: tx });
    expect(repository.saveReceipt).toHaveBeenCalledWith(expect.objectContaining({ command: "quote.version.sent" }), tx);

    vi.mocked(repository.findVersion).mockResolvedValue({ ...version, status: "SENT" });
    await expect(service.transition(actor, "qv", "ACCEPTED", "corr", "accept")).resolves.toMatchObject({ status: "ACCEPTED" });
  });

  it("rejects commercial quote transitions that skip the approved and sent sequence", async () => {
    const { service, repository } = setup();
    vi.mocked(repository.findVersion).mockResolvedValue(version);
    await expect(service.transition(actor, "qv", "ACCEPTED", "corr", "skip")).rejects.toThrow("not allowed");
    expect(repository.transitionVersion).not.toHaveBeenCalled();
  });
});
