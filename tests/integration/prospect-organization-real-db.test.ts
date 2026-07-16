import { randomUUID } from "node:crypto";

import type { Prisma } from "@prisma/client";
import { afterAll, describe, expect, it } from "vitest";

import { AppendOnlyAuditWriter } from "../../lib/audit/audit-writer";
import { HashChainedAuditStore } from "../../lib/audit/hash-chained-audit-store";
import { PrismaAuditLedgerRepository } from "../../lib/audit/prisma-audit-ledger-repository";
import { PrismaProspectRepository } from "../../lib/prospect/prospect-repository";
import { ProspectService } from "../../lib/prospect/prospect-service";
import { prisma } from "../../lib/prisma";

const run = process.env.RUN_DB_INTEGRATION === "1" ? describe : describe.skip;
const rollback = new Error("ROLLBACK");

run("Prospect organization inheritance", () => {
  afterAll(() => prisma.$disconnect());

  it("inherits the actor's single organization unit and carries it to the converted Lead", async () => {
    const tag = randomUUID();
    const ids: { prospect?: string; lead?: string } = {};

    await expect(
      prisma.$transaction(async (transaction) => {
        const [admin, organizationUnit] = await Promise.all([
          transaction.user.findFirstOrThrow({ where: { role: "ADMIN" } }),
          transaction.organizationUnit.findFirstOrThrow({ where: { active: true } }),
        ]);
        const repository = new PrismaProspectRepository(prisma);
        repository.transaction = ((work) => work(transaction)) as typeof repository.transaction;
        const service = new ProspectService(
          repository,
          new AppendOnlyAuditWriter<Prisma.TransactionClient>({
            store: new HashChainedAuditStore({
              repository: new PrismaAuditLedgerRepository(),
              maxAttempts: 3,
            }),
          }),
        );
        const actor = {
          id: admin.id,
          authorization: {
            actorId: admin.id,
            assignments: [
              {
                role: "ADMIN" as const,
                scope: "ENTERPRISE" as const,
                organizationUnitId: organizationUnit.id,
              },
            ],
          },
          permissions: new Set(["prospect.view", "prospect.create", "prospect.convert"]),
        };

        const prospect = await service.create(
          actor,
          {
            companyName: `Organization inheritance ${tag}`,
            source: "REFERRAL",
            status: "QUALIFIED",
            businessPainPoints: "Need enterprise connectivity",
            contact: {
              name: "Integration Contact",
              email: `organization-${tag}@integration.invalid`,
              isPrimary: true,
            },
          },
          tag,
          `create-${tag}`,
        );
        ids.prospect = prospect.id;
        expect(prospect.responsibleBusinessUnitId).toBe(organizationUnit.id);

        const converted = await service.convert(
          actor,
          prospect.id,
          { expectedVersion: prospect.version, qualificationNote: "Qualified for organization inheritance test" },
          tag,
          `convert-${tag}`,
        );
        ids.lead = converted.leadId;
        const lead = await transaction.lead.findUniqueOrThrow({ where: { id: converted.leadId } });
        expect(lead.organizationUnitId).toBe(organizationUnit.id);

        throw rollback;
      }),
    ).rejects.toBe(rollback);

    expect(await prisma.prospect.count({ where: { id: ids.prospect } })).toBe(0);
    expect(await prisma.lead.count({ where: { id: ids.lead } })).toBe(0);
  }, 90_000);
});
