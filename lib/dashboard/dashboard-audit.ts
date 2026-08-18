import type { Prisma } from "@prisma/client";

import { AppendOnlyAuditWriter } from "../audit/audit-writer";
import { HashChainedAuditStore } from "../audit/hash-chained-audit-store";
import { PrismaAuditLedgerRepository } from "../audit/prisma-audit-ledger-repository";

export function createDashboardAuditWriter() {
  return new AppendOnlyAuditWriter<Prisma.TransactionClient>({
    store: new HashChainedAuditStore({
      repository: new PrismaAuditLedgerRepository(),
      maxAttempts: 3,
    }),
  });
}
