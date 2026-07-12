import { describe, expect, it, vi } from "vitest";

import type { AuditWriter } from "../../lib/audit/audit-writer";
import { PermissionDeniedError } from "../../lib/authorization/permission-policy";
import {
  DealRiskRuleService,
  DealRiskRuleValidationError,
  type DealRiskRuleRepository,
} from "../../lib/ai/deal-risk-rule-service";

type Transaction = { id: string };
const effectiveFrom = new Date("2026-07-12T00:00:00.000Z");
const input = {
  code: "follow-up-age",
  riskType: "FOLLOW_UP_AGE",
  effectiveFrom,
  effectiveTo: null,
  configuration: {
    condition: {
      metric: "LAST_ACTIVITY_AGE_DAYS" as const,
      operator: "GT" as const,
      threshold: 7,
      onMissing: "TRIGGER" as const,
    },
    scope: { segments: ["ENTERPRISE"] },
    severity: { band: "HIGH" },
  },
};

function setup() {
  const transaction = { id: "tx-1" };
  const repository: DealRiskRuleRepository<Transaction> = {
    transaction: vi.fn(async (work) => work(transaction)),
    findRuleByCode: vi.fn().mockResolvedValue(null),
    getLatestVersion: vi.fn().mockResolvedValue(null),
    createRule: vi.fn().mockResolvedValue({ id: "rule-1" }),
    createVersion: vi.fn().mockResolvedValue({
      id: "version-1",
      ruleId: "rule-1",
      version: 1,
      code: input.code,
      riskType: input.riskType,
      enabled: true,
      effectiveFrom,
      effectiveTo: null,
      configuration: input.configuration,
    }),
  };
  const auditWriter: AuditWriter<Transaction> = {
    append: vi.fn(async (event) => ({ ...event, id: "audit-1", recordedAt: effectiveFrom })),
  };
  return {
    service: new DealRiskRuleService({ repository, auditWriter }),
    repository,
    auditWriter,
    transaction,
  };
}

describe("DealRiskRuleService", () => {
  it("denies non-Admin before repository access", async () => {
    const { service, repository } = setup();

    await expect(
      service.createAndActivate({ id: "sales-1", role: "SALES" }, input, "request-1"),
    ).rejects.toBeInstanceOf(PermissionDeniedError);
    expect(repository.findRuleByCode).not.toHaveBeenCalled();
  });

  it("creates an immutable active version and audit event in one transaction", async () => {
    const { service, repository, auditWriter, transaction } = setup();

    await expect(
      service.createAndActivate({ id: "admin-1", role: "ADMIN" }, input, "request-2"),
    ).resolves.toMatchObject({ id: "version-1", version: 1 });
    expect(repository.createVersion).toHaveBeenCalledWith(
      expect.objectContaining({ version: 1, createdById: "admin-1" }),
      transaction,
    );
    expect(auditWriter.append).toHaveBeenCalledWith(
      expect.objectContaining({ targetVersion: "1" }),
      { transaction },
    );
  });

  it("increments version instead of overwriting history", async () => {
    const { service, repository } = setup();
    vi.mocked(repository.findRuleByCode).mockResolvedValue({ id: "rule-1" });
    vi.mocked(repository.getLatestVersion).mockResolvedValue({
      id: "version-1",
      ruleId: "rule-1",
      version: 4,
      code: input.code,
      riskType: input.riskType,
      enabled: true,
      effectiveFrom,
      effectiveTo: null,
      configuration: input.configuration,
    });

    await service.createAndActivate({ id: "admin-1", role: "ADMIN" }, input, "request-3");

    expect(repository.createVersion).toHaveBeenCalledWith(
      expect.objectContaining({ version: 5 }),
      expect.anything(),
    );
  });

  it("rejects invalid rules before writing", async () => {
    const { service, repository } = setup();

    await expect(
      service.createAndActivate(
        { id: "admin-1", role: "ADMIN" },
        { ...input, effectiveTo: new Date("2026-07-11T00:00:00.000Z") },
        "request-4",
      ),
    ).rejects.toBeInstanceOf(DealRiskRuleValidationError);
    expect(repository.findRuleByCode).not.toHaveBeenCalled();
  });
});
