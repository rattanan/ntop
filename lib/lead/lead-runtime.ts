import { Prisma } from "@prisma/client";

import { AppendOnlyAuditWriter } from "../audit/audit-writer";
import { HashChainedAuditStore } from "../audit/hash-chained-audit-store";
import { PrismaAuditLedgerRepository } from "../audit/prisma-audit-ledger-repository";
import { PrismaCustomerRepository } from "../customer/prisma-customer-repository";
import { prisma } from "../prisma";
import { LeadService } from "./lead-service";
import { PrismaLeadRepository } from "./prisma-lead-repository";

export function createLeadRuntime() {
  const auditWriter = createLeadAuditWriter();
  return new LeadService(
    new PrismaLeadRepository(prisma),
    new PrismaCustomerRepository(prisma),
    auditWriter,
  );
}

export function createLeadAuditWriter() {
  return new AppendOnlyAuditWriter<Prisma.TransactionClient>({ store: new HashChainedAuditStore({ repository: new PrismaAuditLedgerRepository(), maxAttempts: 3 }) });
}
