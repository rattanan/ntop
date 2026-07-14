import { Prisma } from "@prisma/client";

import { AppendOnlyAuditWriter } from "../audit/audit-writer";
import { HashChainedAuditStore } from "../audit/hash-chained-audit-store";
import { PrismaAuditLedgerRepository } from "../audit/prisma-audit-ledger-repository";
import { prisma } from "../prisma";
import { ForecastService } from "./forecast-service";
import { loadForecastConfig } from "./forecast-config";
import { PrismaForecastRepository } from "./prisma-forecast-repository";

export function createForecastRuntime() {
  return new ForecastService(
    new PrismaForecastRepository(prisma),
    new AppendOnlyAuditWriter<Prisma.TransactionClient>({
      store: new HashChainedAuditStore({ repository: new PrismaAuditLedgerRepository(), maxAttempts: 3 }),
    }),
    undefined,
    loadForecastConfig(),
  );
}
