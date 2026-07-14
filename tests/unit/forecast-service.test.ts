import { describe, expect, it, vi } from "vitest";

import type { AuditWriter } from "../../lib/audit/audit-writer";
import { ForecastService, type ForecastRepository } from "../../lib/forecast/forecast-service";

type Tx = { id: string }; const tx = { id: "tx" };
const actor = { id: "admin", role: "ADMIN" as const, authorization: { actorId: "admin", assignments: [{ role: "ADMIN" as const, scope: "ENTERPRISE" as const, organizationUnitId: null }] } };

describe("ForecastService", () => {
  it("returns the immutable prior snapshot on retry without reading changed sources", async () => {
    const repository: ForecastRepository<Tx> = {
      transaction: vi.fn(async (work) => work(tx)),
      findSnapshot: vi.fn().mockResolvedValue({ id: "snapshot", snapshotKey: "2026-07-enterprise", pipelineAmount: "100.0000", weightedAmount: "80.0000" }),
      listFacts: vi.fn().mockResolvedValue([]), createSnapshot: vi.fn(),
    };
    const audit: AuditWriter<Tx> = { append: vi.fn(async (event) => ({ ...event, id: "audit", recordedAt: new Date() })) };
    const service = new ForecastService(repository, audit);
    await expect(service.createSnapshot(actor, { snapshotKey: "2026-07-enterprise", periodStart: new Date("2026-07-01Z"), periodEnd: new Date("2026-08-01Z"), cutoffAt: new Date("2026-07-31Z"), formulaVersion: "v1" }, "corr")).resolves.toMatchObject({ id: "snapshot", pipelineAmount: "100.0000" });
    expect(repository.listFacts).not.toHaveBeenCalled();
    expect(repository.createSnapshot).not.toHaveBeenCalled();
  });

  it("persists the configured working timezone in a new snapshot", async () => {
    const repository: ForecastRepository<Tx> = {
      transaction: vi.fn(async (work) => work(tx)),
      findSnapshot: vi.fn().mockResolvedValue(null),
      listFacts: vi.fn().mockResolvedValue([]),
      createSnapshot: vi.fn().mockImplementation(async (input) => ({ id: "snapshot", snapshotKey: input.snapshotKey, pipelineAmount: "0.0000", weightedAmount: "0.0000" })),
    };
    const audit: AuditWriter<Tx> = { append: vi.fn(async (event) => ({ ...event, id: "audit", recordedAt: new Date() })) };
    const service = new ForecastService(repository, audit, undefined, { fiscalYearStartMonth: 4, timezone: "UTC", currency: "THB", reportingCutoffHour: 17 });
    await service.createSnapshot(actor, { snapshotKey: "2026-q1", periodStart: new Date("2026-04-01Z"), periodEnd: new Date("2026-07-01Z"), cutoffAt: new Date("2026-06-30Z"), formulaVersion: "v2" }, "corr");
    expect(repository.createSnapshot).toHaveBeenCalledWith(expect.objectContaining({ timezone: "UTC" }), tx);
  });
});
