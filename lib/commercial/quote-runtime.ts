import { Prisma } from "@prisma/client";

import { AppendOnlyAuditWriter } from "../audit/audit-writer";
import { HashChainedAuditStore } from "../audit/hash-chained-audit-store";
import { PrismaAuditLedgerRepository } from "../audit/prisma-audit-ledger-repository";
import { prisma } from "../prisma";
import { PrismaQuoteRepository } from "./prisma-quote-repository";
import { QuoteService } from "./quote-service";

export function createQuoteRuntime() {
  return new QuoteService(
    new PrismaQuoteRepository(prisma),
    new AppendOnlyAuditWriter<Prisma.TransactionClient>({
      store: new HashChainedAuditStore({ repository: new PrismaAuditLedgerRepository(), maxAttempts: 3 }),
    }),
  );
}
