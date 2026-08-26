import type { OpportunityStage, Role } from "@prisma/client";
import { z } from "zod";

import type { AuditWriter } from "../audit/audit-writer";
import type { AuthorizationContext } from "../authorization/authorization-context";
import {
  assertPermission,
  PERMISSIONS,
  type PermissionPolicy,
  permissionPolicy,
} from "../authorization/permission-policy";

export type TransitionCommand =
  | "FORWARD"
  | "RETURN"
  | "LOST"
  | "REOPEN"
  | "CANCEL"
  | "EXPIRE"
  | "WON";

export type OpportunityTransitionInput = {
  targetStage: OpportunityStage;
  command?: TransitionCommand;
  reason?: string;
  expectedVersion: number;
  lostReason?: string;
  lostCategory?: string;
  cancelledReason?: string;
  expectedCloseAt?: Date;
};

export const opportunityProfileSchema = z.strictObject({
  name: z.string().trim().min(2).max(255),
  customerId: z.string().trim().min(1).max(191),
  flow: z.string().trim().min(1).max(191),
  estimatedValue: z.string().regex(/^\d+(\.\d{1,4})?$/),
  currency: z.string().trim().length(3).default("THB"),
  probability: z.number().int().min(0).max(100),
  forecastCategory: z.enum(["COMMIT", "BEST_CASE", "PIPELINE", "OMITTED"]).default("PIPELINE"),
  expectedCloseAt: z.date().nullable().optional(),
  organizationUnitId: z.string().trim().min(1).nullable().optional(),
  ownerId: z.string().trim().min(1).max(191),
  nextAction: z.string().trim().max(1_000).nullable().optional(),
  requirements: z.string().trim().max(10_000).nullable().optional(),
  qualificationResult: z.string().trim().max(10_000).nullable().optional(),
  stakeholderSummary: z.string().trim().max(10_000).nullable().optional(),
  assessment: z.strictObject({
    incumbentVendor: z.string().trim().max(255).nullable().optional(),
    competitors: z.string().trim().max(10_000).nullable().optional(),
    approach: z.enum(["DIRECT", "PARTNER", "DISPLACE"]),
    confidence: z.number().int().min(0).max(100),
    rationale: z.string().trim().max(10_000).nullable().optional(),
  }),
});

export type OpportunityProfileInput = z.infer<typeof opportunityProfileSchema>;
export type OpportunityProfileRecord = OpportunityProfileInput & {
  id: string;
  opportunityNumber: string | null;
  probabilitySource: string;
  version: number;
  stage: OpportunityStage;
};

export type OpportunityTransitionRecord = {
  id: string;
  version: number;
  stage: OpportunityStage;
  ownerId: string;
  organizationUnitId: string | null;
  requirements: string | null;
  qualificationResult: string | null;
  stakeholderSummary: string | null;
  nextAction: string | null;
  expectedCloseAt: Date | null;
  coverageConfirmed: boolean;
  solutionComplete: boolean;
  quoteSubmitted: boolean;
  quoteApproved: boolean;
  quoteAccepted: boolean;
};

export interface OpportunityRepository<TTransaction> {
  transaction<T>(work: (transaction: TTransaction) => Promise<T>): Promise<T>;
  findAccessible(
    id: string,
    context: AuthorizationContext,
    transaction: TTransaction,
  ): Promise<OpportunityTransitionRecord | null>;
  findAccessibleProfile(
    id: string,
    context: AuthorizationContext,
    transaction: TTransaction,
  ): Promise<OpportunityProfileRecord | null>;
  findAccessibleCustomer(
    id: string,
    context: AuthorizationContext,
    transaction: TTransaction,
  ): Promise<{ id: string; organizationUnitId: string | null } | null>;
  createProfile(
    input: OpportunityProfileInput,
    transaction: TTransaction,
  ): Promise<OpportunityProfileRecord>;
  overrideProbabilityVersioned(
    id: string,
    expectedVersion: number,
    probability: number,
    transaction: TTransaction,
  ): Promise<OpportunityProfileRecord | null>;
  appendProbabilityHistory(
    input: {
      opportunityId: string;
      previousProbability: number;
      newProbability: number;
      reason: string;
      changedById: string;
      aggregateVersion: number;
      correlationId: string;
      changedAt: Date;
    },
    transaction: TTransaction,
  ): Promise<void>;
  updateProfileVersioned(
    id: string,
    expectedVersion: number,
    input: OpportunityProfileInput,
    transaction: TTransaction,
  ): Promise<OpportunityProfileRecord | null>;
  hasGrantedPermission(
    roleCodes: readonly string[],
    permission: string,
    transaction: TTransaction,
  ): Promise<boolean>;
  findReceipt(
    actorId: string,
    idempotencyKey: string,
    command: string,
    transaction: TTransaction,
  ): Promise<{ opportunityId: string; resultVersion: number } | null>;
  transitionVersioned(
    current: OpportunityTransitionRecord,
    input: OpportunityTransitionInput,
    at: Date,
    transaction: TTransaction,
  ): Promise<OpportunityTransitionRecord | null>;
  appendHistory(
    input: {
      opportunityId: string;
      fromStage: OpportunityStage;
      toStage: OpportunityStage;
      command: TransitionCommand;
      reason: string | null;
      actorId: string;
      policyVersionId: string;
      evidenceSnapshot: Record<string, unknown>;
      aggregateVersion: number;
      correlationId: string;
      transitionedAt: Date;
    },
    transaction: TTransaction,
  ): Promise<void>;
  saveReceipt(
    input: {
      actorId: string;
      idempotencyKey: string;
      command: string;
      opportunityId: string;
      resultVersion: number;
    },
    transaction: TTransaction,
  ): Promise<void>;
}

type Actor = {
  id: string;
  role: Role;
  authorization: AuthorizationContext;
};

export class OpportunityAccessError extends Error {
  constructor() {
    super("Opportunity is unavailable.");
    this.name = "OpportunityAccessError";
  }
}

export class OpportunityTransitionDeniedError extends Error {
  constructor(readonly missingFields: readonly string[] = []) {
    super("Opportunity transition is denied.");
    this.name = "OpportunityTransitionDeniedError";
  }
}

export class OpportunityValidationError extends Error {
  constructor(readonly issues?: Record<string, string[]>) {
    super("Opportunity input is invalid.");
    this.name = "OpportunityValidationError";
  }
}

export class OpportunityVersionConflictError extends Error {
  constructor() {
    super("Opportunity version is stale.");
    this.name = "OpportunityVersionConflictError";
  }
}

export class OpportunityIdempotencyConflictError extends Error {
  constructor() {
    super("Idempotency key belongs to another Opportunity.");
    this.name = "OpportunityIdempotencyConflictError";
  }
}

export class OpportunityProbabilityOverrideDeniedError extends Error {
  constructor() {
    super("Opportunity probability override is denied.");
    this.name = "OpportunityProbabilityOverrideDeniedError";
  }
}

export const UNRESTRICTED_STAGE_POLICY_VERSION_ID = "UNRESTRICTED_STAGE_SELECTION_V1";

const activeStages: readonly OpportunityStage[] = ["QUALIFY", "DISCOVER", "SOLUTION", "PROPOSAL", "NEGOTIATION"];
const opportunityStages: readonly OpportunityStage[] = [...activeStages, "WON", "LOST", "CANCELLED", "EXPIRED"];

export function opportunityTransitionCommand(fromStage: OpportunityStage, toStage: OpportunityStage): TransitionCommand {
  if (toStage === "WON") return "WON";
  if (toStage === "LOST") return "LOST";
  if (toStage === "CANCELLED") return "CANCEL";
  if (toStage === "EXPIRED") return "EXPIRE";
  if (!activeStages.includes(fromStage)) return "REOPEN";
  return activeStages.indexOf(toStage) > activeStages.indexOf(fromStage) ? "FORWARD" : "RETURN";
}

function transitionMissingFields(current: OpportunityTransitionRecord, input: OpportunityTransitionInput) {
  const missingFields: string[] = [];
  if (!opportunityStages.includes(input.targetStage) || current.stage === input.targetStage) missingFields.push("targetStage");
  if (!input.reason?.trim() || input.reason.trim().length > 1000) missingFields.push("reason");
  if (input.targetStage === "LOST") {
    if (!input.lostReason?.trim() || input.lostReason.trim().length > 1000) missingFields.push("lostReason");
    if (!input.lostCategory?.trim() || input.lostCategory.trim().length > 100) missingFields.push("lostCategory");
  }
  if (input.targetStage === "CANCELLED" && (!input.cancelledReason?.trim() || input.cancelledReason.trim().length > 1000)) {
    missingFields.push("cancelledReason");
  }
  return missingFields;
}

export class OpportunityService<TTransaction> {
  constructor(
    private readonly repository: OpportunityRepository<TTransaction>,
    private readonly auditWriter: AuditWriter<TTransaction>,
    private readonly permissions: PermissionPolicy = permissionPolicy,
    private readonly now: () => Date = () => new Date(),
  ) {}

  private parse(input: unknown) {
    const parsed = opportunityProfileSchema.safeParse(input);
    if (!parsed.success) {
      throw new OpportunityValidationError(parsed.error.flatten().fieldErrors);
    }
    return parsed.data;
  }

  private normalizeOwnership(actor: Actor, input: OpportunityProfileInput) {
    const canManageAll = this.permissions.allows(actor, PERMISSIONS.recordViewAll);
    return {
      ...input,
      ownerId: canManageAll ? input.ownerId : actor.id,
      organizationUnitId: canManageAll ? input.organizationUnitId ?? null : undefined,
    };
  }

  async create(
    actor: Actor,
    input: unknown,
    correlationId: string,
    idempotencyKey: string,
  ) {
    assertPermission(actor, PERMISSIONS.recordCreate, this.permissions);
    const parsed = this.normalizeOwnership(actor, this.parse(input));
    if (!idempotencyKey.trim() || idempotencyKey.length > 191) {
      throw new OpportunityValidationError({ idempotencyKey: ["Required"] });
    }
    return this.repository.transaction(async (transaction) => {
      const receipt = await this.repository.findReceipt(actor.id, idempotencyKey, "opportunity.create", transaction);
      if (receipt) {
        const existing = await this.repository.findAccessibleProfile(receipt.opportunityId, actor.authorization, transaction);
        if (!existing) throw new OpportunityAccessError();
        return existing;
      }
      const customer = await this.repository.findAccessibleCustomer(parsed.customerId, actor.authorization, transaction);
      if (!customer) throw new OpportunityAccessError();
      const created = await this.repository.createProfile(
        { ...parsed, organizationUnitId: parsed.organizationUnitId ?? customer.organizationUnitId },
        transaction,
      );
      await this.auditWriter.append({ actorId: actor.id, action: "opportunity.create", targetType: "Opportunity", targetId: created.id, targetVersion: String(created.version), outcome: "SUCCESS", correlationId, data: { customerId: created.customerId } }, { transaction });
      await this.repository.saveReceipt({ actorId: actor.id, idempotencyKey, command: "opportunity.create", opportunityId: created.id, resultVersion: created.version }, transaction);
      return created;
    });
  }

  async update(
    actor: Actor,
    id: string,
    expectedVersion: number,
    input: unknown,
    correlationId: string,
    idempotencyKey: string,
  ) {
    assertPermission(actor, PERMISSIONS.recordUpdate, this.permissions);
    const parsed = this.normalizeOwnership(actor, this.parse(input));
    if (!Number.isInteger(expectedVersion) || expectedVersion < 1 || !idempotencyKey.trim() || idempotencyKey.length > 191) {
      throw new OpportunityValidationError();
    }
    return this.repository.transaction(async (transaction) => {
      const receipt = await this.repository.findReceipt(actor.id, idempotencyKey, "opportunity.update", transaction);
      if (receipt) {
        if (receipt.opportunityId !== id) throw new OpportunityIdempotencyConflictError();
        const existing = await this.repository.findAccessibleProfile(id, actor.authorization, transaction);
        if (!existing) throw new OpportunityAccessError();
        return existing;
      }
      const current = await this.repository.findAccessibleProfile(id, actor.authorization, transaction);
      if (!current) throw new OpportunityAccessError();
      if (current.version !== expectedVersion) throw new OpportunityVersionConflictError();
      const customer = await this.repository.findAccessibleCustomer(parsed.customerId, actor.authorization, transaction);
      if (!customer) throw new OpportunityAccessError();
      const updated = await this.repository.updateProfileVersioned(id, expectedVersion, {
        ...parsed,
        probability: current.probability,
        ownerId: this.permissions.allows(actor, PERMISSIONS.recordViewAll) ? parsed.ownerId : current.ownerId,
        organizationUnitId: parsed.organizationUnitId ?? customer.organizationUnitId,
      }, transaction);
      if (!updated) throw new OpportunityVersionConflictError();
      await this.auditWriter.append({ actorId: actor.id, action: "opportunity.update", targetType: "Opportunity", targetId: id, targetVersion: String(updated.version), outcome: "SUCCESS", correlationId, data: { stagePreserved: current.stage } }, { transaction });
      await this.repository.saveReceipt({ actorId: actor.id, idempotencyKey, command: "opportunity.update", opportunityId: id, resultVersion: updated.version }, transaction);
      return updated;
    });
  }

  async transition(
    actor: Actor,
    opportunityId: string,
    input: OpportunityTransitionInput,
    correlationId: string,
    idempotencyKey: string,
  ) {
    assertPermission(actor, PERMISSIONS.opportunityTransition, this.permissions);
    if (!idempotencyKey.trim() || idempotencyKey.length > 191) {
      throw new OpportunityTransitionDeniedError(["idempotencyKey"]);
    }
    const at = this.now();
    return this.repository.transaction(async (transaction) => {
      const receipt = await this.repository.findReceipt(
        actor.id,
        idempotencyKey,
        "opportunity.transition",
        transaction,
      );
      if (receipt) {
        if (receipt.opportunityId !== opportunityId) {
          throw new OpportunityIdempotencyConflictError();
        }
        const existing = await this.repository.findAccessible(
          opportunityId,
          actor.authorization,
          transaction,
        );
        if (!existing) throw new OpportunityAccessError();
        return existing;
      }
      const current = await this.repository.findAccessible(
        opportunityId,
        actor.authorization,
        transaction,
      );
      if (!current) throw new OpportunityAccessError();
      if (current.version !== input.expectedVersion) {
        throw new OpportunityVersionConflictError();
      }
      const missingFields = transitionMissingFields(current, input);
      if (missingFields.length) {
        throw new OpportunityTransitionDeniedError(missingFields);
      }
      const command = opportunityTransitionCommand(current.stage, input.targetStage);
      const transitionInput = { ...input, command };
      const updated = await this.repository.transitionVersioned(
        current,
        transitionInput,
        at,
        transaction,
      );
      if (!updated) throw new OpportunityVersionConflictError();
      const evidenceSnapshot = {
        mode: "UNRESTRICTED_STAGE_SELECTION",
        reason: input.reason?.trim(),
        ...(input.lostReason ? { lostReason: input.lostReason.trim() } : {}),
        ...(input.lostCategory ? { lostCategory: input.lostCategory.trim() } : {}),
        ...(input.cancelledReason ? { cancelledReason: input.cancelledReason.trim() } : {}),
      };
      await this.repository.appendHistory(
        {
          opportunityId,
          fromStage: current.stage,
          toStage: input.targetStage,
          command,
          reason: input.reason!.trim(),
          actorId: actor.id,
          policyVersionId: UNRESTRICTED_STAGE_POLICY_VERSION_ID,
          evidenceSnapshot,
          aggregateVersion: updated.version,
          correlationId,
          transitionedAt: at,
        },
        transaction,
      );
      await this.auditWriter.append(
        {
          actorId: actor.id,
          action: "opportunity.transition",
          targetType: "Opportunity",
          targetId: opportunityId,
          targetVersion: String(updated.version),
          outcome: "SUCCESS",
          correlationId,
          reason: input.reason,
          data: {
            fromStage: current.stage,
            toStage: input.targetStage,
            command,
            policyVersionId: UNRESTRICTED_STAGE_POLICY_VERSION_ID,
            transitionMode: "UNRESTRICTED_STAGE_SELECTION",
          },
        },
        { transaction },
      );
      await this.repository.saveReceipt(
        {
          actorId: actor.id,
          idempotencyKey,
          command: "opportunity.transition",
          opportunityId,
          resultVersion: updated.version,
        },
        transaction,
      );
      return updated;
    });
  }

  async overrideProbability(
    actor: Actor,
    opportunityId: string,
    input: { probability: number; reason: string; expectedVersion: number },
    correlationId: string,
    idempotencyKey: string,
  ) {
    assertPermission(actor, PERMISSIONS.recordUpdate, this.permissions);
    if (!Number.isInteger(input.probability) || input.probability < 0 || input.probability > 100 ||
      input.reason.trim().length < 5 || input.reason.length > 1000 ||
      !Number.isInteger(input.expectedVersion) || input.expectedVersion < 1 ||
      !idempotencyKey.trim() || idempotencyKey.length > 191) {
      throw new OpportunityValidationError();
    }
    const at = this.now();
    return this.repository.transaction(async (transaction) => {
      const receipt = await this.repository.findReceipt(actor.id, idempotencyKey, "opportunity.probability.override", transaction);
      if (receipt) {
        if (receipt.opportunityId !== opportunityId) throw new OpportunityIdempotencyConflictError();
        const existing = await this.repository.findAccessibleProfile(opportunityId, actor.authorization, transaction);
        if (!existing) throw new OpportunityAccessError();
        return existing;
      }
      const roleCodes = actor.authorization.assignments.map((item) => item.role);
      const granted = await this.repository.hasGrantedPermission(roleCodes, PERMISSIONS.opportunityProbabilityOverride, transaction);
      if (!this.permissions.allows(actor, PERMISSIONS.opportunityProbabilityOverride) && !granted) {
        throw new OpportunityProbabilityOverrideDeniedError();
      }
      const current = await this.repository.findAccessibleProfile(opportunityId, actor.authorization, transaction);
      if (!current) throw new OpportunityAccessError();
      if (current.version !== input.expectedVersion) throw new OpportunityVersionConflictError();
      const updated = await this.repository.overrideProbabilityVersioned(opportunityId, input.expectedVersion, input.probability, transaction);
      if (!updated) throw new OpportunityVersionConflictError();
      await this.repository.appendProbabilityHistory({
        opportunityId,
        previousProbability: current.probability,
        newProbability: input.probability,
        reason: input.reason.trim(),
        changedById: actor.id,
        aggregateVersion: updated.version,
        correlationId,
        changedAt: at,
      }, transaction);
      await this.auditWriter.append({
        actorId: actor.id,
        action: "opportunity.probability.override",
        targetType: "Opportunity",
        targetId: opportunityId,
        targetVersion: String(updated.version),
        outcome: "SUCCESS",
        correlationId,
        reason: input.reason.trim(),
        data: { previousProbability: current.probability, newProbability: input.probability },
      }, { transaction });
      await this.repository.saveReceipt({ actorId: actor.id, idempotencyKey, command: "opportunity.probability.override", opportunityId, resultVersion: updated.version }, transaction);
      return updated;
    });
  }
}
