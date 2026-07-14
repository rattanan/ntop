import { describe, expect, it, vi } from "vitest";

import type { AuditWriter } from "../../lib/audit/audit-writer";
import { SalesTargetOverlapError, SalesTargetService } from "../../lib/forecast/sales-target-service";

const input = { targetType: "USER", userId: "manager", revenueType: "TOTAL_REVENUE", periodType: "MONTH", fiscalYear: 2027, fiscalMonth: 1, targetAmount: "1000000.0000", currency: "THB", status: "ACTIVE", effectiveFrom: "2026-10-01T00:00:00.000Z" };
const actor = { id: "manager", authorization: { actorId: "manager", assignments: [{ role: "TEAM_MANAGER" as const, scope: "SELF" as const, organizationUnitId: null }] }, permissions: new Set(["forecast.target.manage"]) };

describe("SalesTargetService", () => {
  it("creates a decimal-safe target and audit in one transaction", async () => {
    const transaction = { salesTarget: { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn().mockImplementation(async ({ data }) => ({ id: "target", version: 1, ...data })) } };
    const client = { $transaction: vi.fn(async (work) => work(transaction)) };
    const audit: AuditWriter<unknown> = { append: vi.fn(async (event) => ({ ...event, id: "audit", recordedAt: new Date() })) };
    const service = new SalesTargetService(client as never, audit as never);
    await expect(service.create(actor, input, "corr")).resolves.toMatchObject({ id: "target", targetAmount: expect.anything() });
    expect(audit.append).toHaveBeenCalledWith(expect.objectContaining({ action: "forecast.target.create" }), { transaction });
  });

  it("rejects an overlapping active target", async () => {
    const transaction = { salesTarget: { findFirst: vi.fn().mockResolvedValue({ id: "prior" }), create: vi.fn() } };
    const client = { $transaction: vi.fn(async (work) => work(transaction)) };
    const service = new SalesTargetService(client as never, { append: vi.fn() } as never);
    await expect(service.create(actor, input, "corr")).rejects.toBeInstanceOf(SalesTargetOverlapError);
    expect(transaction.salesTarget.create).not.toHaveBeenCalled();
  });
});
