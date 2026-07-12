import type { Role } from "@prisma/client";
import { z } from "zod";

import type { AuditWriter } from "../audit/audit-writer";
import {
  assertPermission,
  PERMISSIONS,
  type PermissionPolicy,
  permissionPolicy,
} from "../authorization/permission-policy";
import {
  dealRiskRuleConfigurationSchema,
  type DealRiskRuleConfiguration,
} from "./deal-risk-evaluator";

const riskRuleInputSchema = z.strictObject({
  code: z.string().trim().min(1).max(100),
  riskType: z.string().trim().min(1).max(100),
  effectiveFrom: z.date(),
  effectiveTo: z.date().nullable(),
  configuration: dealRiskRuleConfigurationSchema,
});

export type DealRiskRuleVersionView = {
  id: string;
  ruleId: string;
  version: number;
  code: string;
  riskType: string;
  enabled: boolean;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  configuration: DealRiskRuleConfiguration;
};

export interface DealRiskRuleRepository<TTransaction> {
  transaction<T>(work: (transaction: TTransaction) => Promise<T>): Promise<T>;
  findRuleByCode(
    code: string,
    transaction: TTransaction,
  ): Promise<{ id: string } | null>;
  getLatestVersion(
    ruleId: string,
    transaction: TTransaction,
  ): Promise<DealRiskRuleVersionView | null>;
  createRule(
    input: { code: string },
    transaction: TTransaction,
  ): Promise<{ id: string }>;
  createVersion(
    input: Omit<DealRiskRuleVersionView, "id"> & { createdById: string },
    transaction: TTransaction,
  ): Promise<DealRiskRuleVersionView>;
}

export class DealRiskRuleValidationError extends Error {
  constructor() {
    super("Deal Risk rule configuration is invalid.");
    this.name = "DealRiskRuleValidationError";
  }
}

export class DealRiskRuleService<TTransaction> {
  private readonly repository: DealRiskRuleRepository<TTransaction>;
  private readonly auditWriter: AuditWriter<TTransaction>;
  private readonly policy: PermissionPolicy;

  constructor({
    repository,
    auditWriter,
    policy = permissionPolicy,
  }: {
    repository: DealRiskRuleRepository<TTransaction>;
    auditWriter: AuditWriter<TTransaction>;
    policy?: PermissionPolicy;
  }) {
    this.repository = repository;
    this.auditWriter = auditWriter;
    this.policy = policy;
  }

  async createAndActivate(
    actor: { id: string; role: Role },
    input: z.input<typeof riskRuleInputSchema>,
    correlationId: string,
  ) {
    assertPermission(actor, PERMISSIONS.aiConfigManage, this.policy);
    const parsed = riskRuleInputSchema.safeParse(input);
    if (
      !parsed.success ||
      (parsed.data.effectiveTo !== null &&
        parsed.data.effectiveTo <= parsed.data.effectiveFrom)
    ) {
      throw new DealRiskRuleValidationError();
    }

    return this.repository.transaction(async (transaction) => {
      const existing = await this.repository.findRuleByCode(
        parsed.data.code,
        transaction,
      );
      const rule = existing ?? (await this.repository.createRule(
        { code: parsed.data.code },
        transaction,
      ));
      const latest = await this.repository.getLatestVersion(rule.id, transaction);

      const version = await this.repository.createVersion(
        {
          ruleId: rule.id,
          version: (latest?.version ?? 0) + 1,
          code: parsed.data.code,
          riskType: parsed.data.riskType,
          enabled: true,
          effectiveFrom: parsed.data.effectiveFrom,
          effectiveTo: parsed.data.effectiveTo,
          configuration: parsed.data.configuration,
          createdById: actor.id,
        },
        transaction,
      );
      await this.auditWriter.append(
        {
          actorId: actor.id,
          action: "deal-risk.rule-version.activate",
          targetType: "DealRiskRuleVersion",
          targetId: version.id,
          targetVersion: String(version.version),
          outcome: "SUCCESS",
          correlationId,
          data: {
            ruleId: version.ruleId,
            riskType: version.riskType,
            effectiveFrom: version.effectiveFrom.toISOString(),
          },
        },
        { transaction },
      );
      return version;
    });
  }
}
