import type { Role } from "@prisma/client";

import type { AuditWriter } from "../audit/audit-writer";
import type { AuthorizationContext } from "../authorization/authorization-context";
import { assertPermission, PERMISSIONS, type PermissionPolicy, permissionPolicy } from "../authorization/permission-policy";
import { calculateForecast, type PipelineFact } from "./forecast-calculator";
import { loadForecastConfig } from "./forecast-config";

export interface ForecastRepository<TTransaction> {
  transaction<T>(work: (transaction: TTransaction) => Promise<T>): Promise<T>;
  findSnapshot(key: string, context: AuthorizationContext, transaction: TTransaction): Promise<{ id: string; snapshotKey: string; pipelineAmount: string; weightedAmount: string } | null>;
  listFacts(input: { context: AuthorizationContext; periodStart: Date; periodEnd: Date; cutoffAt: Date }, transaction: TTransaction): Promise<PipelineFact[]>;
  createSnapshot(input: { snapshotKey: string; periodStart: Date; periodEnd: Date; cutoffAt: Date; timezone: string; formulaVersion: string; scopeSnapshot: Record<string, unknown>; createdById: string; calculation: ReturnType<typeof calculateForecast> }, transaction: TTransaction): Promise<{ id: string; snapshotKey: string; pipelineAmount: string; weightedAmount: string }>;
}

type Actor = { id: string; role: Role; authorization: AuthorizationContext };

export class ForecastValidationError extends Error {
  constructor() { super("Forecast snapshot input is invalid."); this.name = "ForecastValidationError"; }
}

export class ForecastService<TTransaction> {
  constructor(
    private readonly repository: ForecastRepository<TTransaction>,
    private readonly auditWriter: AuditWriter<TTransaction>,
    private readonly permissions: PermissionPolicy = permissionPolicy,
    private readonly config = loadForecastConfig(),
  ) {}

  async createSnapshot(actor: Actor, input: { snapshotKey: string; periodStart: Date; periodEnd: Date; cutoffAt: Date; formulaVersion: string }, correlationId: string) {
    assertPermission(actor, PERMISSIONS.forecastSnapshotCreate, this.permissions);
    if (!input.snapshotKey.trim() || input.snapshotKey.length > 191 || input.periodEnd <= input.periodStart || input.cutoffAt < input.periodStart) {
      throw new ForecastValidationError();
    }
    return this.repository.transaction(async (transaction) => {
      const existing = await this.repository.findSnapshot(input.snapshotKey, actor.authorization, transaction);
      if (existing) return existing;
      const facts = await this.repository.listFacts({ ...input, context: actor.authorization }, transaction);
      const calculation = calculateForecast(facts);
      const qualitySnapshot = {
        itemCount: calculation.items.length,
        incompleteCount: calculation.items.filter((item) => Object.keys(item.qualitySnapshot).length > 0).length,
        reconciled: true,
      };
      const created = await this.repository.createSnapshot({
        ...input,
        timezone: this.config.timezone,
        scopeSnapshot: { assignments: actor.authorization.assignments },
        createdById: actor.id,
        calculation: { ...calculation, qualitySnapshot } as ReturnType<typeof calculateForecast> & { qualitySnapshot: typeof qualitySnapshot },
      }, transaction);
      await this.auditWriter.append({
        actorId: actor.id,
        action: "forecast.snapshot.create",
        targetType: "ForecastSnapshot",
        targetId: created.id,
        outcome: "SUCCESS",
        correlationId,
        data: { snapshotKey: input.snapshotKey, formulaVersion: input.formulaVersion, itemCount: facts.length },
      }, { transaction });
      return created;
    });
  }
}
