import { describe, expect, it } from "vitest";

import { ProspectAccessError } from "../../lib/prospect/prospect-authorization";
import type { PrismaProspectRepository } from "../../lib/prospect/prospect-repository";
import { ProspectService } from "../../lib/prospect/prospect-service";

describe("Prospect service authorization", () => {
  it("requires the archive permission in the service layer", async () => {
    const service = new ProspectService(
      {} as PrismaProspectRepository,
      { append: async (event) => ({ ...event, id: "audit", recordedAt: new Date() }) },
    );
    const actor = {
      id: "actor-1",
      authorization: {
        actorId: "actor-1",
        assignments: [{ role: "KAM" as const, scope: "SELF" as const, organizationUnitId: null }],
      },
      permissions: new Set(["prospect.update"]),
    };

    await expect(
      service.changeStatus(
        actor,
        "prospect-1",
        { status: "ARCHIVED", expectedVersion: 1, reason: "duplicate" },
        "correlation-1",
        "idempotency-1",
      ),
    ).rejects.toBeInstanceOf(ProspectAccessError);
  });
});
