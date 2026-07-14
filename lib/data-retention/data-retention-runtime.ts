import { Prisma } from "@prisma/client";

import { AppendOnlyAuditWriter } from "../audit/audit-writer";
import { HashChainedAuditStore } from "../audit/hash-chained-audit-store";
import { PrismaAuditLedgerRepository } from "../audit/prisma-audit-ledger-repository";
import { prisma } from "../prisma";
import { DataRetentionService } from "./data-retention-service";

export function createDataRetentionRuntime() {
  const audit = new AppendOnlyAuditWriter<Prisma.TransactionClient>({ store: new HashChainedAuditStore({ repository: new PrismaAuditLedgerRepository(), maxAttempts: 3 }) });
  return new DataRetentionService(prisma, audit);
}
