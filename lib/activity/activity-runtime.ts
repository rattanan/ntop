import { Prisma } from "@prisma/client";

import { AppendOnlyAuditWriter } from "../audit/audit-writer";
import { HashChainedAuditStore } from "../audit/hash-chained-audit-store";
import { PrismaAuditLedgerRepository } from "../audit/prisma-audit-ledger-repository";
import { prisma } from "../prisma";
import { PrismaActivityRepository } from "./prisma-activity-repository";
import { ActivityService } from "./activity-service";

export function createActivityRuntime() {
  return new ActivityService(new PrismaActivityRepository(prisma), new AppendOnlyAuditWriter<Prisma.TransactionClient>({ store: new HashChainedAuditStore({ repository: new PrismaAuditLedgerRepository(), maxAttempts: 3 }) }));
}
