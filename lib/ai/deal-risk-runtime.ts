import { Prisma } from "@prisma/client";

import { AppendOnlyAuditWriter } from "../audit/audit-writer";
import { HashChainedAuditStore } from "../audit/hash-chained-audit-store";
import { PrismaAuditLedgerRepository } from "../audit/prisma-audit-ledger-repository";
import { prisma } from "../prisma";
import { loadAuthorizationContext } from "../authorization/authorization-context";
import { DealRiskRuleService } from "./deal-risk-rule-service";
import {
  evaluateAndPersistOpportunityRisks,
  PrismaDealRiskRuleRepository,
} from "./prisma-deal-risk-repository";

function auditWriter() {
  return new AppendOnlyAuditWriter<Prisma.TransactionClient>({
    store: new HashChainedAuditStore({
      repository: new PrismaAuditLedgerRepository(),
      maxAttempts: 3,
    }),
  });
}

export function createDealRiskRuleRuntime() {
  const repository = new PrismaDealRiskRuleRepository(prisma);
  return new DealRiskRuleService({
    repository,
    auditWriter: auditWriter(),
  });
}

export async function evaluateOpportunityRisks(
  actor: { id: string; role: "ADMIN" | "SALES" | "VIEWER" },
  opportunityId: string,
  correlationId: string,
) {
  const authorization = await loadAuthorizationContext({ actorId: actor.id, legacyRole: actor.role });
  return evaluateAndPersistOpportunityRisks({
    client: prisma,
    auditWriter: auditWriter(),
    actor: { ...actor, authorization },
    opportunityId,
    correlationId,
  });
}
