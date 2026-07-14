import { Prisma } from "@prisma/client";

import { AppendOnlyAuditWriter } from "../audit/audit-writer";
import { HashChainedAuditStore } from "../audit/hash-chained-audit-store";
import { PrismaAuditLedgerRepository } from "../audit/prisma-audit-ledger-repository";
import { prisma } from "../prisma";
import { OpportunityService } from "./opportunity-service";
import { PrismaOpportunityRepository } from "./prisma-opportunity-repository";

export function createOpportunityRuntime() {
  return new OpportunityService(
    new PrismaOpportunityRepository(prisma),
    new AppendOnlyAuditWriter<Prisma.TransactionClient>({
      store: new HashChainedAuditStore({
        repository: new PrismaAuditLedgerRepository(),
        maxAttempts: 3,
      }),
    }),
  );
}
