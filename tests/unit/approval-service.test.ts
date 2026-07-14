import { describe, expect, it, vi } from "vitest";

import type { AuditWriter } from "../../lib/audit/audit-writer";
import { ApprovalDecisionDeniedError, ApprovalService, type ApprovalRepository, type ApprovalRequestRecord } from "../../lib/commercial/approval-service";

type Tx = { id: string };
const tx = { id: "tx" };
const request: ApprovalRequestRecord = {
  id: "req", version: 1, status: "PENDING", makerId: "maker", quoteVersionId: "qv", quoteTotal: "5000000", customerSegment: "B1", organizationUnitId: "org", quoteVersionHash: "a".repeat(64),
  step: { id: "step", stepCode: "manager", requiredPermission: "approval.manager", assignedRoleCode: "TEAM_MANAGER", delegatedToActorId: null, makerChecker: true, minimumAuthority: null, maximumAuthority: "10000000", status: "PENDING" },
  policyInputSnapshot: { total: "5000000" }, previousDecisionHash: null,
};
function actor(id = "approver") { return { id, role: "SALES" as const, authorization: { actorId: id, assignments: [{ role: "TEAM_MANAGER" as const, scope: "ORG_UNIT" as const, organizationUnitId: "org" }] } }; }
function setup() {
  const repo: ApprovalRepository<Tx> = {
    transaction: vi.fn(async (work) => work(tx)), findReceipt: vi.fn().mockResolvedValue(null), saveReceipt: vi.fn().mockResolvedValue(undefined),
    findActionable: vi.fn().mockResolvedValue(request), findAuthority: vi.fn().mockResolvedValue({ id: "grant", roleCode: "TEAM_MANAGER", maximumAmount: "10000000" }),
    findDelegate: vi.fn().mockResolvedValue({ actorId: "delegate", roleCode: "TEAM_MANAGER", maximumAmount: "10000000" }),
    recordDecision: vi.fn().mockResolvedValue({ decisionId: "decision", requestStatus: "APPROVED", requestVersion: 2 }),
  };
  const audit: AuditWriter<Tx> = { append: vi.fn(async (event) => ({ ...event, id: "audit", recordedAt: new Date() })) };
  return { repo, audit, service: new ApprovalService(repo, audit, () => new Date("2026-07-13T00:00:00Z")) };
}

describe("ApprovalService", () => {
  it("enforces maker-checker", async () => {
    const { service, repo } = setup();
    await expect(service.decide(actor("maker"), { requestId: "req", stepId: "step", action: "APPROVE", reason: "ok", expectedVersion: 1 }, "corr", "idem")).rejects.toBeInstanceOf(ApprovalDecisionDeniedError);
    expect(repo.recordDecision).not.toHaveBeenCalled();
  });

  it("denies authority below quote total", async () => {
    const { service, repo } = setup();
    vi.mocked(repo.findAuthority).mockResolvedValue({ id: "grant", roleCode: "TEAM_MANAGER", maximumAmount: "1000" });
    await expect(service.decide(actor(), { requestId: "req", stepId: "step", action: "APPROVE", reason: "ok", expectedVersion: 1 }, "corr", "idem")).rejects.toBeInstanceOf(ApprovalDecisionDeniedError);
  });

  it("denies an actor whose role does not match the policy step", async () => {
    const { service, repo } = setup();
    const wrongRoleActor = {
      id: "pricing-approver",
      role: "SALES" as const,
      authorization: {
        actorId: "pricing-approver",
        assignments: [{
          role: "PRICING_APPROVER" as const,
          scope: "ORG_UNIT" as const,
          organizationUnitId: "org",
        }],
      },
    };
    await expect(service.decide(wrongRoleActor, { requestId: "req", stepId: "step", action: "APPROVE", reason: "ok", expectedVersion: 1 }, "corr", "idem")).rejects.toBeInstanceOf(ApprovalDecisionDeniedError);
    expect(repo.findAuthority).not.toHaveBeenCalled();
    expect(repo.recordDecision).not.toHaveBeenCalled();
  });

  it("records decision, audit and idempotency evidence in one transaction", async () => {
    const { service, repo, audit } = setup();
    await expect(service.decide(actor(), { requestId: "req", stepId: "step", action: "APPROVE", reason: "within authority", expectedVersion: 1 }, "corr", "idem")).resolves.toMatchObject({ decisionId: "decision" });
    expect(repo.recordDecision).toHaveBeenCalledWith(expect.objectContaining({ decisionHash: expect.stringMatching(/^[a-f0-9]{64}$/) }), tx);
    expect(audit.append).toHaveBeenCalled();
    expect(repo.saveReceipt).toHaveBeenCalled();
  });
});
