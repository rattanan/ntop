import { Prisma, PrismaClient } from "@prisma/client";

import type { AuthorizationContext } from "../authorization/authorization-context";
import { buildOpportunityScopeWhere } from "../opportunity/opportunity-query";
import type { ProposalActor, ProposalRecord, ProposalRepository } from "./proposal-service";
import type { ProposalSectionInput } from "./contracts";

type Transaction = Prisma.TransactionClient;

const proposalInclude = {
  status: { select: { terminal: true } },
  versions: {
    orderBy: { versionNumber: "desc" as const },
    take: 1,
    include: { sections: { orderBy: { sortOrder: "asc" as const } } },
  },
} as const;

function stringArray(value: Prisma.JsonValue | null): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function sections(records: Array<{ sectionCode: string; title: string; sortOrder: number; contentType: string; content: string; structuredData: Prisma.JsonValue | null }>): ProposalSectionInput[] {
  return records.map((section) => ({
    sectionCode: section.sectionCode,
    title: section.title,
    sortOrder: section.sortOrder,
    contentType: section.contentType as ProposalSectionInput["contentType"],
    content: section.content,
    structuredData: section.structuredData && typeof section.structuredData === "object" && !Array.isArray(section.structuredData)
      ? section.structuredData as Record<string, unknown>
      : null,
  }));
}

function toRecord(record: Prisma.ProposalGetPayload<{ include: typeof proposalInclude }>): ProposalRecord {
  const latest = record.versions[0];
  if (!latest) throw new Error("Proposal version history is incomplete.");
  return {
    id: record.id,
    proposalNo: record.proposalNo,
    opportunityId: record.opportunityId,
    customerId: record.customerId,
    ownerId: record.ownerId,
    version: record.version,
    statusCode: record.statusCode,
    terminal: record.status.terminal,
    name: latest.name,
    description: latest.description,
    expireDate: latest.expireDate,
    tags: stringArray(latest.tags),
    templateVersionId: latest.templateVersionId,
    latestVersionId: latest.id,
    sections: sections(latest.sections),
  };
}

function status(value: { code: string; terminal: boolean; allowedTransitions: Prisma.JsonValue }) {
  return { code: value.code, terminal: value.terminal, allowedTransitions: stringArray(value.allowedTransitions) };
}

function json(value: Record<string, unknown> | null | undefined) {
  return value == null ? undefined : value as Prisma.InputJsonValue;
}

function sectionCreates(items: ProposalSectionInput[]) {
  return items.map((section) => ({
    sectionCode: section.sectionCode,
    title: section.title,
    sortOrder: section.sortOrder,
    contentType: section.contentType,
    content: section.content,
    structuredData: json(section.structuredData),
  }));
}

export class PrismaProposalRepository implements ProposalRepository<Transaction> {
  constructor(private readonly client: PrismaClient) {}

  transaction<T>(work: (transaction: Transaction) => Promise<T>) {
    return this.client.$transaction(work);
  }

  findReceipt(actorId: string, key: string, command: string, transaction: Transaction) {
    return transaction.proposalCommandReceipt.findUnique({
      where: { actorId_idempotencyKey_command: { actorId, idempotencyKey: key, command } },
      select: { proposalId: true, resultVersion: true },
    });
  }

  async saveReceipt(input: Parameters<ProposalRepository<Transaction>["saveReceipt"]>[0], transaction: Transaction) {
    await transaction.proposalCommandReceipt.create({ data: input });
  }

  async findOpportunity(input: { id: string; context: AuthorizationContext }, transaction: Transaction) {
    return transaction.opportunity.findFirst({
      where: { id: input.id, ...buildOpportunityScopeWhere(input.context) },
      select: { id: true, customerId: true },
    });
  }

  async findInitialStatus(transaction: Transaction) {
    const value = await transaction.proposalStatusDefinition.findFirst({
      where: { active: true, terminal: false },
      orderBy: { sortOrder: "asc" },
      select: { code: true, terminal: true, allowedTransitions: true },
    });
    return value ? status(value) : null;
  }

  async findStatus(code: string, transaction: Transaction) {
    const value = await transaction.proposalStatusDefinition.findFirst({
      where: { code, active: true },
      select: { code: true, terminal: true, allowedTransitions: true },
    });
    return value ? status(value) : null;
  }

  async findTransition(fromStatusCode: string, toStatusCode: string, transaction: Transaction) {
    return transaction.proposalStatusTransition.findFirst({
      where: { fromStatusCode, toStatusCode, active: true },
      select: { requiredPermission: true, makerChecker: true },
    });
  }

  async actorHasPermission(actor: ProposalActor, permissionCode: string, transaction: Transaction) {
    const roleCodes = [...new Set(actor.authorization.assignments.map((assignment) => assignment.role))];
    if (!roleCodes.length) return false;
    return (await transaction.rolePermissionGrant.count({ where: { roleCode: { in: roleCodes }, permissionCode } })) > 0;
  }

  async findTemplate(templateId: string, transaction: Transaction) {
    const template = await transaction.proposalTemplate.findFirst({
      where: { id: templateId, active: true, activeVersionId: { not: null } },
      select: {
        activeVersion: {
          select: {
            id: true,
            sections: { orderBy: { sortOrder: "asc" }, select: { sectionCode: true, title: true, sortOrder: true, contentType: true, defaultContent: true, structuredData: true } },
          },
        },
      },
    });
    if (!template?.activeVersion) return null;
    return {
      versionId: template.activeVersion.id,
      sections: template.activeVersion.sections.map((section) => ({
        sectionCode: section.sectionCode,
        title: section.title,
        sortOrder: section.sortOrder,
        contentType: section.contentType as ProposalSectionInput["contentType"],
        content: section.defaultContent,
        structuredData: section.structuredData && typeof section.structuredData === "object" && !Array.isArray(section.structuredData)
          ? section.structuredData as Record<string, unknown>
          : null,
      })),
    };
  }

  async nextProposalNumber(now: Date, transaction: Transaction) {
    const sequence = await transaction.proposalNumberSequence.upsert({
      where: { id: "PROPOSAL" },
      create: { id: "PROPOSAL", nextValue: 1 },
      update: { nextValue: { increment: 1 } },
      select: { nextValue: true },
    });
    const year = new Intl.DateTimeFormat("en-US", { year: "numeric", timeZone: "Asia/Bangkok" }).format(now);
    return `PR-${year}-${String(sequence.nextValue).padStart(6, "0")}`;
  }

  async create(input: Parameters<ProposalRepository<Transaction>["create"]>[0], transaction: Transaction) {
    const expireDate = input.draft.expireDate ? new Date(input.draft.expireDate) : null;
    const created = await transaction.proposal.create({
      data: {
        createDate: new Date(),
        proposalNo: input.proposalNo,
        name: input.draft.name,
        opportunityId: input.opportunityId,
        customerId: input.customerId,
        ownerId: input.actorId,
        statusCode: input.statusCode,
        expireDate,
        description: input.draft.description ?? null,
        tags: input.draft.tags,
        versions: {
          create: {
            versionNumber: 1,
            name: input.draft.name,
            statusCode: input.statusCode,
            description: input.draft.description ?? null,
            expireDate,
            tags: input.draft.tags,
            templateVersionId: input.templateVersionId,
            createdById: input.actorId,
            sections: { create: sectionCreates(input.sections) },
          },
        },
      },
      include: proposalInclude,
    });
    return toRecord(created);
  }

  async find(input: { id: string; actorId: string; context: AuthorizationContext }, transaction: Transaction) {
    const record = await transaction.proposal.findFirst({
      where: { id: input.id, deletedAt: null, OR: [{ ownerId: input.actorId }, { opportunity: buildOpportunityScopeWhere(input.context) }] },
      include: proposalInclude,
    });
    return record ? toRecord(record) : null;
  }

  async findVersion(input: { proposalId: string; versionNumber: number; actorId: string; context: AuthorizationContext }, transaction: Transaction) {
    const record = await transaction.proposalVersion.findFirst({
      where: { proposalId: input.proposalId, versionNumber: input.versionNumber, proposal: { deletedAt: null, OR: [{ ownerId: input.actorId }, { opportunity: buildOpportunityScopeWhere(input.context) }] } },
      include: { sections: { orderBy: { sortOrder: "asc" } }, proposal: { include: { status: { select: { terminal: true } } } } },
    });
    if (!record) return null;
    return {
      id: record.proposal.id,
      proposalNo: record.proposal.proposalNo,
      opportunityId: record.proposal.opportunityId,
      customerId: record.proposal.customerId,
      ownerId: record.proposal.ownerId,
      version: record.proposal.version,
      statusCode: record.statusCode,
      terminal: record.proposal.status.terminal,
      name: record.name,
      description: record.description,
      expireDate: record.expireDate,
      tags: stringArray(record.tags),
      templateVersionId: record.templateVersionId,
      latestVersionId: record.id,
      sections: sections(record.sections),
    };
  }

  async createVersion(input: Parameters<ProposalRepository<Transaction>["createVersion"]>[0], transaction: Transaction) {
    const updated = await transaction.proposal.updateMany({
      where: { id: input.proposal.id, version: input.expectedVersion, deletedAt: null },
      data: { version: { increment: 1 }, name: input.name, description: input.description, expireDate: input.expireDate, tags: input.tags, statusCode: input.statusCode },
    });
    if (updated.count !== 1) return null;
    await transaction.proposalVersion.create({
      data: {
        proposalId: input.proposal.id,
        versionNumber: input.expectedVersion + 1,
        name: input.name,
        statusCode: input.statusCode,
        description: input.description,
        expireDate: input.expireDate,
        tags: input.tags,
        templateVersionId: input.templateVersionId,
        restoredFromVersionId: input.restoredFromVersionId,
        aiProviderConfigurationVersionId: input.ai?.providerConfigurationVersionId,
        aiProviderModel: input.ai?.providerModel,
        aiPromptTemplateVersion: input.ai?.promptTemplateVersion,
        aiInputSourceReferences: input.ai?.inputSourceReferences,
        createdById: input.actorId,
        sections: { create: sectionCreates(input.sections) },
      },
    });
    return toRecord(await transaction.proposal.findUniqueOrThrow({ where: { id: input.proposal.id }, include: proposalInclude }));
  }

  async softDelete(input: { proposal: ProposalRecord; actorId: string; deletedAt: Date }, transaction: Transaction) {
    await transaction.proposal.update({ where: { id: input.proposal.id }, data: { deletedAt: input.deletedAt, deletedById: input.actorId } });
  }
}
