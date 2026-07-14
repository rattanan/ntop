import { Prisma } from "@prisma/client";
import { AppendOnlyAuditWriter } from "../audit/audit-writer";
import { HashChainedAuditStore } from "../audit/hash-chained-audit-store";
import { PrismaAuditLedgerRepository } from "../audit/prisma-audit-ledger-repository";
import { prisma } from "../prisma";
import { WorkflowAdminService } from "./workflow-admin-service";

export function createWorkflowAdminRuntime() {
  return new WorkflowAdminService(
    { transaction: <T>(work: (tx: Prisma.TransactionClient) => Promise<T>) => prisma.$transaction(work) },
    new AppendOnlyAuditWriter<Prisma.TransactionClient>({ store: new HashChainedAuditStore({ repository: new PrismaAuditLedgerRepository(), maxAttempts: 3 }) }),
  );
}
