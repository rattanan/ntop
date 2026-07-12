import { describe, expect, it, vi } from "vitest";

import { PrismaAiGovernanceRepository } from "../../lib/ai/prisma-governance-repository";

describe("PrismaAiGovernanceRepository", () => {
  it("scopes output access through the requesting AI job", async () => {
    const findFirst = vi.fn().mockResolvedValue(null);
    const repository = new PrismaAiGovernanceRepository({} as never);

    await repository.findAuthorizedOutput(
      "output-1",
      "user-1",
      { aiOutput: { findFirst } } as never,
    );

    expect(findFirst).toHaveBeenCalledWith({
      where: { id: "output-1", job: { requestedById: "user-1" } },
      select: { id: true, status: true },
    });
  });

  it("abandons output by clearing structured content, not deleting evidence", async () => {
    const update = vi.fn().mockResolvedValue({});
    const repository = new PrismaAiGovernanceRepository({} as never);

    await repository.markAbandoned(
      {
        outputId: "output-1",
        reason: "User rejected",
        expiresAt: new Date("2026-08-11T00:00:00.000Z"),
        clearValidatedOutput: true,
      },
      { aiOutput: { update } } as never,
    );

    expect(update).toHaveBeenCalledWith({
      where: { id: "output-1" },
      data: expect.objectContaining({
        status: "ABANDONED",
        abandonedReason: "User rejected",
      }),
    });
    expect(update.mock.calls[0][0].data.validatedOutput).toBeDefined();
  });
});
