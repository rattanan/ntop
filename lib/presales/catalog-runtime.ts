import { Prisma } from "@prisma/client";

import { AppendOnlyAuditWriter } from "../audit/audit-writer";
import { HashChainedAuditStore } from "../audit/hash-chained-audit-store";
import { PrismaAuditLedgerRepository } from "../audit/prisma-audit-ledger-repository";
import { prisma } from "../prisma";
import { CatalogService } from "./catalog-service";
import { PrismaCatalogRepository } from "./prisma-catalog-repository";

export function createCatalogRuntime() {
  return new CatalogService(new PrismaCatalogRepository(prisma), new AppendOnlyAuditWriter<Prisma.TransactionClient>({ store: new HashChainedAuditStore({ repository: new PrismaAuditLedgerRepository(), maxAttempts: 3 }) }));
}
