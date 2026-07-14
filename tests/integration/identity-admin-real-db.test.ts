import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const prisma = new PrismaClient();
const run = process.env.RUN_DB_INTEGRATION === "1" ? describe : describe.skip;

run("identity administration real database", () => {
  beforeAll(() => prisma.$connect());
  afterAll(() => prisma.$disconnect());

  it("supports account lifecycle columns and rolls back login history atomically", async () => {
    const suffix = randomUUID();
    const userId = `identity-test-${suffix}`;
    await expect(prisma.$transaction(async (tx) => {
      await tx.user.create({ data: { id: userId, name: "Identity Integration Test", email: `${suffix}@integration.invalid`, passwordHash: "not-a-production-password", role: "VIEWER", active: false } });
      await tx.loginEvent.create({ data: { id: `login-${suffix}`, userId, identifierHash: "a".repeat(64), outcome: "DISABLED", correlationId: suffix } });
      throw new Error("ROLLBACK_IDENTITY_TEST");
    })).rejects.toThrow("ROLLBACK_IDENTITY_TEST");

    expect(await prisma.user.findUnique({ where: { id: userId } })).toBeNull();
    expect(await prisma.loginEvent.findUnique({ where: { id: `login-${suffix}` } })).toBeNull();
  });
});
