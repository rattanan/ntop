import { Prisma } from "@prisma/client";

import { AppendOnlyAuditWriter } from "../audit/audit-writer";
import { HashChainedAuditStore } from "../audit/hash-chained-audit-store";
import { PrismaAuditLedgerRepository } from "../audit/prisma-audit-ledger-repository";
import { prisma } from "../prisma";
import { PrismaApprovalRepository } from "./prisma-approval-repository";
import { ApprovalService } from "./approval-service";

export function createApprovalRuntime() {
  return new ApprovalService(
    new PrismaApprovalRepository(prisma),
    new AppendOnlyAuditWriter<Prisma.TransactionClient>({
      store: new HashChainedAuditStore({ repository: new PrismaAuditLedgerRepository(), maxAttempts: 3 }),
    }),
  );
}
