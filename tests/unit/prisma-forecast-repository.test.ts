import type { Prisma, PrismaClient } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import type { AuthorizationContext } from "../../lib/authorization/authorization-context";
import { PrismaForecastRepository } from "../../lib/forecast/prisma-forecast-repository";

const context: AuthorizationContext = {
  actorId: "owner-1",
  assignments: [{ role: "KAM", scope: "SELF", organizationUnitId: null }],
  organizationUnitIds: [],
};

function transaction() {
  const findMany = vi.fn().mockResolvedValue([]);
  return {
    findMany,
    value: { opportunity: { findMany } } as unknown as Prisma.TransactionClient,
  };
}

describe("PrismaForecastRepository.listFacts", () => {
  const periodStart = new Date("2026-01-01T00:00:00.000Z");
  const periodEnd = new Date("2027-01-01T00:00:00.000Z");
  const cutoffAt = new Date("2026-08-25T00:00:00.000Z");

  it("keeps API and snapshot reads strictly inside the requested period", async () => {
    const tx = transaction();
    const repository = new PrismaForecastRepository({} as PrismaClient);

    await repository.listFacts({ context, periodStart, periodEnd, cutoffAt }, tx.value);

    expect(tx.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        OR: [{ ownerId: "owner-1", organizationUnitId: null }],
        AND: [{ expectedCloseAt: { gte: periodStart, lt: periodEnd } }],
      }),
    }));
  });

  it("can include unscheduled opportunities in the annual dashboard without dropping authorization scope", async () => {
    const tx = transaction();
    const repository = new PrismaForecastRepository({} as PrismaClient);

    await repository.listFacts({ context, periodStart, periodEnd, cutoffAt, includeUnscheduled: true }, tx.value);

    expect(tx.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        OR: [{ ownerId: "owner-1", organizationUnitId: null }],
        AND: [{ OR: [
          { expectedCloseAt: { gte: periodStart, lt: periodEnd } },
          { expectedCloseAt: null },
        ] }],
      }),
    }));
  });
});
