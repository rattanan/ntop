import { Prisma } from "@prisma/client";

import { AppendOnlyAuditWriter } from "../audit/audit-writer";
import { HashChainedAuditStore } from "../audit/hash-chained-audit-store";
import { PrismaAuditLedgerRepository } from "../audit/prisma-audit-ledger-repository";
import { prisma } from "../prisma";
import { PrismaProposalRepository } from "./prisma-proposal-repository";
import { ProposalService } from "./proposal-service";

export function createProposalRuntime() {
  const repository = new PrismaProposalRepository(prisma);
  const auditWriter = new AppendOnlyAuditWriter<Prisma.TransactionClient>({
    store: new HashChainedAuditStore({ repository: new PrismaAuditLedgerRepository(), maxAttempts: 3 }),
  });
  return { repository, service: new ProposalService(repository, auditWriter) };
}
