import { randomUUID } from "node:crypto";

import {
  redactAuditData,
  type AuditJsonValue,
} from "./redact-audit-data";

export const AUDIT_FAILURE_POLICY = "FAIL_CLOSED" as const;

export type AuditOutcome = "SUCCESS" | "DENIED" | "FAILURE";

export type AppendAuditEvent = {
  actorId: string;
  action: string;
  targetType: string;
  targetId: string;
  outcome: AuditOutcome;
  correlationId: string;
  reason?: string;
  targetVersion?: string;
  data?: AuditJsonValue;
};

export type AuditEvent = AppendAuditEvent & {
  id: string;
  recordedAt: Date;
  data?: AuditJsonValue;
};

export interface AuditAppendStore<TTransaction = unknown> {
  append(event: AuditEvent, transaction?: TTransaction): Promise<void>;
}

export interface AuditWriter<TTransaction = unknown> {
  append(
    event: AppendAuditEvent,
    options?: { transaction?: TTransaction },
  ): Promise<AuditEvent>;
}

export class AuditWriteError extends Error {
  constructor() {
    super("Required audit event could not be recorded.");
    this.name = "AuditWriteError";
  }
}

type AuditWriterDependencies<TTransaction> = {
  store: AuditAppendStore<TTransaction>;
  createId?: () => string;
  now?: () => Date;
};

export class AppendOnlyAuditWriter<TTransaction = unknown>
  implements AuditWriter<TTransaction>
{
  private readonly store: AuditAppendStore<TTransaction>;
  private readonly createId: () => string;
  private readonly now: () => Date;

  constructor({
    store,
    createId = randomUUID,
    now = () => new Date(),
  }: AuditWriterDependencies<TTransaction>) {
    this.store = store;
    this.createId = createId;
    this.now = now;
  }

  async append(
    input: AppendAuditEvent,
    options?: { transaction?: TTransaction },
  ) {
    const event: AuditEvent = {
      ...input,
      id: this.createId(),
      recordedAt: this.now(),
      ...(input.data === undefined
        ? {}
        : { data: redactAuditData(input.data) }),
    };

    try {
      await this.store.append(event, options?.transaction);
    } catch {
      throw new AuditWriteError();
    }

    return event;
  }
}
