import { Prisma } from "@prisma/client";

import { AppendOnlyAuditWriter } from "../audit/audit-writer";
import { HashChainedAuditStore } from "../audit/hash-chained-audit-store";
import { PrismaAuditLedgerRepository } from "../audit/prisma-audit-ledger-repository";
import { prisma } from "../prisma";
import { MeetingConfirmationService } from "./meeting-confirmation-service";
import { PrismaMeetingConfirmationRepository } from "./prisma-meeting-confirmation-repository";

export function createMeetingConfirmationRuntime() {
  const repository = new PrismaMeetingConfirmationRepository(prisma);
  const auditWriter = new AppendOnlyAuditWriter<Prisma.TransactionClient>({
    store: new HashChainedAuditStore({
      repository: new PrismaAuditLedgerRepository(),
      maxAttempts: 3,
    }),
  });
  return new MeetingConfirmationService(repository, auditWriter);
}
