import { Prisma } from "@prisma/client";

import { AppendOnlyAuditWriter } from "../audit/audit-writer";
import { HashChainedAuditStore } from "../audit/hash-chained-audit-store";
import { PrismaAuditLedgerRepository } from "../audit/prisma-audit-ledger-repository";
import { prisma } from "../prisma";
import { PrismaCustomerRepository } from "./prisma-customer-repository";
import { CustomerService } from "./customer-service";

export function createCustomerRuntime() {
  const repository = new PrismaCustomerRepository(prisma);
  const auditWriter = new AppendOnlyAuditWriter<Prisma.TransactionClient>({
    store: new HashChainedAuditStore({
      repository: new PrismaAuditLedgerRepository(),
      maxAttempts: 3,
    }),
  });
  return new CustomerService(repository, auditWriter);
}
