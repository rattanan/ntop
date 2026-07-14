import { Prisma } from "@prisma/client";

import { AppendOnlyAuditWriter } from "../audit/audit-writer";
import { HashChainedAuditStore } from "../audit/hash-chained-audit-store";
import { PrismaAuditLedgerRepository } from "../audit/prisma-audit-ledger-repository";
import { prisma } from "../prisma";
import { OpportunityRelatedService } from "./opportunity-related-service";
import { PrismaOpportunityRelatedRepository } from "./prisma-opportunity-related-repository";

export function createOpportunityRelatedRuntime(){return new OpportunityRelatedService(new PrismaOpportunityRelatedRepository(prisma),new AppendOnlyAuditWriter<Prisma.TransactionClient>({store:new HashChainedAuditStore({repository:new PrismaAuditLedgerRepository(),maxAttempts:3})}));}
