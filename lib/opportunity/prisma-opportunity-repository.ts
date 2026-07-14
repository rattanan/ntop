import { Prisma, PrismaClient } from "@prisma/client";

import type { AuthorizationContext } from "../authorization/authorization-context";
import { buildCustomerScopeWhere } from "../customer/customer-query-service";
import { buildOpportunityScopeWhere } from "./opportunity-query";
import type {
  OpportunityRepository,
  OpportunityTransitionInput,
  OpportunityTransitionRecord,
  OpportunityProfileInput,
  OpportunityProfileRecord,
  TransitionCommand,
} from "./opportunity-service";

type Transaction = Prisma.TransactionClient;

const profileSelect = {
  id: true, opportunityNumber: true, probabilitySource: true, version: true, stage: true, name: true, customerId: true, flow: true,
  estimatedValue: true, currency: true, probability: true, forecastCategory: true,
  expectedCloseAt: true, organizationUnitId: true, ownerId: true, nextAction: true,
  requirements: true, qualificationResult: true, stakeholderSummary: true,
  vendorAssessment: { select: { incumbentVendor: true, competitors: true, approach: true, confidence: true, rationale: true } },
} as const;

type ProfilePayload = Prisma.OpportunityGetPayload<{ select: typeof profileSelect }>;

function toProfile(record: ProfilePayload): OpportunityProfileRecord {
  const { vendorAssessment, ...opportunity } = record;
  return {
    ...opportunity,
    estimatedValue: record.estimatedValue.toString(),
    assessment: vendorAssessment ?? { approach: "DIRECT", confidence: 0 },
  };
}

function requiredFields(value: Prisma.JsonValue): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function toRecord(record: {
  id: string;
  version: number;
  stage: OpportunityTransitionRecord["stage"];
  ownerId: string;
  organizationUnitId: string | null;
  requirements: string | null;
  qualificationResult: string | null;
  stakeholderSummary: string | null;
  structuredRequirements: Array<{ id: string }>;
  stakeholders: Array<{ id: string }>;
  nextAction: string | null;
  expectedCloseAt: Date | null;
  coverageChecks: Array<{ status: string; confirmedCost: Prisma.Decimal | null }>;
  solutionDesign: { estimatedCost: Prisma.Decimal; marginPct: Prisma.Decimal } | null;
  quotes: Array<{
    versions: Array<{
      status: string;
      approvalRequests: Array<{ status: string }>;
    }>;
  }>;
}): OpportunityTransitionRecord {
  const versions = record.quotes.flatMap((quote) => quote.versions);
  return {
    id: record.id,
    version: record.version,
    stage: record.stage,
    ownerId: record.ownerId,
    organizationUnitId: record.organizationUnitId,
    requirements: record.requirements ?? (record.structuredRequirements.length ? "STRUCTURED_REQUIREMENTS_PRESENT" : null),
    qualificationResult: record.qualificationResult,
    stakeholderSummary: record.stakeholderSummary ?? (record.stakeholders.length ? "STRUCTURED_STAKEHOLDERS_PRESENT" : null),
    nextAction: record.nextAction,
    expectedCloseAt: record.expectedCloseAt,
    coverageConfirmed: record.coverageChecks.some(
      (item) => item.status === "CONFIRMED" && item.confirmedCost !== null,
    ),
    solutionComplete: record.solutionDesign !== null,
    quoteSubmitted: versions.some((item) => item.status !== "DRAFT"),
    quoteApproved: versions.some(
      (item) =>
        item.status === "APPROVED" || item.status === "ACCEPTED" ||
        item.approvalRequests.some((request) => request.status === "APPROVED"),
    ),
    quoteAccepted: versions.some((item) => item.status === "ACCEPTED"),
  };
}

const include = {
  structuredRequirements: { select: { id: true }, take: 1 },
  stakeholders: { select: { id: true }, take: 1 },
  coverageChecks: { select: { status: true, confirmedCost: true } },
  solutionDesign: { select: { estimatedCost: true, marginPct: true } },
  quotes: {
    select: {
      versions: {
        select: {
          status: true,
          approvalRequests: { select: { status: true } },
        },
      },
    },
  },
} as const;

export class PrismaOpportunityRepository
  implements OpportunityRepository<Transaction>
{
  constructor(private readonly client: PrismaClient) {}

  transaction<T>(work: (transaction: Transaction) => Promise<T>) {
    return this.client.$transaction(work);
  }

  async findAccessible(
    id: string,
    context: AuthorizationContext,
    transaction: Transaction,
  ) {
    const result = await transaction.opportunity.findFirst({
      where: { id, ...buildOpportunityScopeWhere(context) },
      include,
    });
    return result ? toRecord(result) : null;
  }

  async findAccessibleProfile(id: string, context: AuthorizationContext, transaction: Transaction) {
    const result = await transaction.opportunity.findFirst({ where: { id, ...buildOpportunityScopeWhere(context) }, select: profileSelect });
    return result ? toProfile(result) : null;
  }

  async findAccessibleCustomer(id: string, context: AuthorizationContext, transaction: Transaction) {
    return transaction.customer.findFirst({
      where: { id, mergedIntoCustomerId: null, ...buildCustomerScopeWhere(context) },
      select: { id: true, organizationUnitId: true },
    });
  }

  async createProfile(input: OpportunityProfileInput, transaction: Transaction) {
    const { assessment, ...data } = input;
    const year = new Intl.DateTimeFormat("en", { timeZone: "Asia/Bangkok", year: "numeric" }).format(new Date());
    const sequenceId = `OPP-${year}`;
    await transaction.opportunityNumberSequence.upsert({ where: { id: sequenceId }, update: {}, create: { id: sequenceId, nextValue: 0 } });
    const sequence = await transaction.opportunityNumberSequence.update({ where: { id: sequenceId }, data: { nextValue: { increment: 1 } } });
    const opportunityNumber = `OPP-${year}-${String(sequence.nextValue).padStart(6, "0")}`;
    const result = await transaction.opportunity.create({
      data: { ...data, opportunityNumber, vendorAssessment: { create: assessment } }, select: profileSelect,
    });
    return toProfile(result);
  }

  async overrideProbabilityVersioned(id: string, expectedVersion: number, probability: number, transaction: Transaction) {
    const result = await transaction.opportunity.updateMany({ where: { id, version: expectedVersion }, data: { probability, probabilitySource: "MANUAL_OVERRIDE", version: { increment: 1 } } });
    if (result.count !== 1) return null;
    return toProfile(await transaction.opportunity.findUniqueOrThrow({ where: { id }, select: profileSelect }));
  }

  async appendProbabilityHistory(input: Parameters<OpportunityRepository<Transaction>["appendProbabilityHistory"]>[0], transaction: Transaction) {
    await transaction.opportunityProbabilityHistory.create({ data: input });
  }

  async updateProfileVersioned(id: string, expectedVersion: number, input: OpportunityProfileInput, transaction: Transaction) {
    const { assessment, ...data } = input;
    const result = await transaction.opportunity.updateMany({ where: { id, version: expectedVersion }, data: { ...data, version: { increment: 1 } } });
    if (result.count !== 1) return null;
    await transaction.vendorAssessment.upsert({ where: { opportunityId: id }, create: { opportunityId: id, ...assessment }, update: assessment });
    return toProfile(await transaction.opportunity.findUniqueOrThrow({ where: { id }, select: profileSelect }));
  }

  async findPolicy(
    from: OpportunityTransitionRecord["stage"],
    to: OpportunityTransitionRecord["stage"],
    command: TransitionCommand,
    at: Date,
    transaction: Transaction,
  ) {
    const result = await transaction.opportunityTransitionPolicyVersion.findFirst({
      where: {
        fromStage: from,
        toStage: to,
        command,
        active: true,
        effectiveFrom: { lte: at },
        OR: [{ effectiveTo: null }, { effectiveTo: { gt: at } }],
      },
      orderBy: { version: "desc" },
      select: { id: true, requiredFields: true, requiredPermission: true },
    });
    return result
      ? { ...result, requiredFields: requiredFields(result.requiredFields) }
      : null;
  }

  async hasGrantedPermission(
    roleCodes: readonly string[],
    permissionCode: string,
    transaction: Transaction,
  ) {
    if (!roleCodes.length) return false;
    return (
      (await transaction.rolePermissionGrant.findFirst({
        where: { roleCode: { in: [...roleCodes] }, permissionCode },
        select: { id: true },
      })) !== null
    );
  }

  findReceipt(
    actorId: string,
    idempotencyKey: string,
    command: string,
    transaction: Transaction,
  ) {
    return transaction.opportunityCommandReceipt.findUnique({
      where: { actorId_idempotencyKey_command: { actorId, idempotencyKey, command } },
      select: { opportunityId: true, resultVersion: true },
    });
  }

  async transitionVersioned(
    current: OpportunityTransitionRecord,
    input: OpportunityTransitionInput,
    at: Date,
    transaction: Transaction,
  ) {
    const result = await transaction.opportunity.updateMany({
      where: { id: current.id, version: input.expectedVersion, stage: current.stage },
      data: {
        stage: input.targetStage,
        version: { increment: 1 },
        stageEnteredAt: at,
        ...(input.expectedCloseAt ? { expectedCloseAt: input.expectedCloseAt } : {}),
        ...(input.targetStage === "LOST"
          ? { lostReason: input.lostReason ?? input.reason, lostCategory: input.lostCategory }
          : {}),
        ...(input.targetStage === "CANCELLED"
          ? { cancelledReason: input.cancelledReason ?? input.reason }
          : {}),
      },
    });
    if (result.count !== 1) return null;
    return toRecord(
      await transaction.opportunity.findUniqueOrThrow({
        where: { id: current.id },
        include,
      }),
    );
  }

  async appendHistory(
    input: Parameters<OpportunityRepository<Transaction>["appendHistory"]>[0],
    transaction: Transaction,
  ) {
    await transaction.opportunityStageHistory.create({
      data: {
        ...input,
        evidenceSnapshot: input.evidenceSnapshot as Prisma.InputJsonValue,
      },
    });
  }

  async saveReceipt(
    input: Parameters<OpportunityRepository<Transaction>["saveReceipt"]>[0],
    transaction: Transaction,
  ) {
    await transaction.opportunityCommandReceipt.create({ data: input });
  }
}
