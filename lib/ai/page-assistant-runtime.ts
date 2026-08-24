import { Prisma } from "@prisma/client";

import { AppendOnlyAuditWriter } from "../audit/audit-writer";
import { HashChainedAuditStore } from "../audit/hash-chained-audit-store";
import { PrismaAuditLedgerRepository } from "../audit/prisma-audit-ledger-repository";
import { prisma } from "../prisma";
import { PAGE_ASSISTANT_PROMPT_VERSION } from "./page-assistant-service";

function auditWriter() {
  return new AppendOnlyAuditWriter<Prisma.TransactionClient>({
    store: new HashChainedAuditStore({ repository: new PrismaAuditLedgerRepository(), maxAttempts: 3 }),
  });
}

export async function appendPageAssistantAudit(input: {
  actorId: string;
  correlationId: string;
  pathname: string;
  questionCharacters: number;
  pageContextCharacters: number;
  conversationTurns: number;
  outcome: "SUCCESS" | "FAILURE";
  providerConfigurationVersionId?: string;
  providerModel?: string;
  usage?: { inputTokens?: number; outputTokens?: number; totalTokens?: number };
  error?: { name: string; code?: string; cause?: { name: string; code?: string } };
}) {
  await prisma.$transaction(async (transaction) => {
    await auditWriter().append({
      actorId: input.actorId,
      action: "ai.page-assistant.ask",
      targetType: "AiPageAssistant",
      targetId: input.correlationId,
      outcome: input.outcome,
      correlationId: input.correlationId,
      data: {
        pathname: input.pathname,
        questionCharacters: input.questionCharacters,
        pageContextCharacters: input.pageContextCharacters,
        conversationTurns: input.conversationTurns,
        promptTemplateVersion: PAGE_ASSISTANT_PROMPT_VERSION,
        ...(input.providerConfigurationVersionId ? { providerConfigurationVersionId: input.providerConfigurationVersionId } : {}),
        ...(input.providerModel ? { providerModel: input.providerModel } : {}),
        ...(input.usage ? { usage: input.usage } : {}),
        ...(input.error ? { error: input.error } : {}),
      },
    }, { transaction });
  });
}
