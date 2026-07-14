import { Prisma, PrismaClient } from "@prisma/client";

import type { AuthorizationContext } from "../authorization/authorization-context";
import { buildCustomerScopeWhere } from "./customer-query-service";
import type {
  CustomerCommand,
  CustomerContactCommand,
  CustomerRecord,
  CustomerRepository,
} from "./customer-service";
import { CustomerIdentityConflictError } from "./customer-service";

export type CustomerTransaction = Prisma.TransactionClient;

const customerSelect = {
  id: true,
  version: true,
  name: true,
  taxId: true,
  type: true,
  segment: true,
  province: true,
  address: true,
  status: true,
  ownerId: true,
  organizationUnitId: true,
  mergedIntoCustomerId: true,
} as const;

function toRecord(record: {
  id: string;
  version: number;
  name: string;
  taxId: string;
  type: "B2G" | "B2B";
  segment: string;
  province: string;
  address: string | null;
  status: "PROSPECT" | "ACTIVE" | "INACTIVE" | "BLACKLISTED" | "CLOSED";
  ownerId: string;
  organizationUnitId: string | null;
  mergedIntoCustomerId: string | null;
}): CustomerRecord {
  return {
    ...record,
    address: record.address ?? undefined,
    organizationUnitId: record.organizationUnitId,
    externalIds: [],
  };
}

function contactData(contact: CustomerCommand["contact"]) {
  if (!contact) return undefined;
  return {
    name: contact.name,
    title: contact.title || null,
    phone: contact.phone || null,
    email: contact.email || null,
    relationship: contact.relationship || null,
    purpose: contact.purpose || null,
    isPrimary: contact.isPrimary ?? false,
  };
}

export class PrismaCustomerRepository
  implements CustomerRepository<CustomerTransaction>
{
  constructor(private readonly client: PrismaClient) {}

  transaction<T>(work: (transaction: CustomerTransaction) => Promise<T>) {
    return this.client.$transaction(work);
  }

  async findAccessible(
    id: string,
    context: AuthorizationContext,
    transaction: CustomerTransaction,
  ) {
    const record = await transaction.customer.findFirst({
      where: { id, ...buildCustomerScopeWhere(context) },
      select: customerSelect,
    });
    return record ? toRecord(record) : null;
  }

  findCommandReceipt(
    actorId: string,
    idempotencyKey: string,
    command: string,
    transaction: CustomerTransaction,
  ) {
    return transaction.customerCommandReceipt.findUnique({
      where: {
        actorId_idempotencyKey_command: {
          actorId,
          idempotencyKey,
          command,
        },
      },
      select: { targetId: true, targetVersion: true },
    });
  }

  async saveCommandReceipt(
    input: {
      actorId: string;
      idempotencyKey: string;
      command: string;
      targetId: string;
      targetVersion: number | null;
    },
    transaction: CustomerTransaction,
  ) {
    await transaction.customerCommandReceipt.create({ data: input });
  }

  async hasGrantedPermission(
    roleCodes: readonly string[],
    permissionCode: string,
    transaction: CustomerTransaction,
  ) {
    if (!roleCodes.length) return false;
    const grant = await transaction.rolePermissionGrant.findFirst({
      where: {
        roleCode: { in: [...roleCodes] },
        permissionCode,
      },
      select: { id: true },
    });
    return grant !== null;
  }

  async create(
    input: CustomerCommand,
    actorId: string,
    transaction: CustomerTransaction,
  ) {
    const created = await transaction.customer.create({
      data: {
        name: input.name,
        taxId: input.taxId,
        type: input.type,
        segment: input.segment,
        province: input.province,
        address: input.address || null,
        status: input.status,
        ownerId: input.ownerId,
        organizationUnitId: input.organizationUnitId ?? null,
        externalIds: input.externalIds?.length
          ? { create: input.externalIds }
          : undefined,
        contacts: input.contact
          ? { create: contactData(input.contact) as NonNullable<ReturnType<typeof contactData>> }
          : undefined,
      },
      select: customerSelect,
    });
    await transaction.customerOwnershipAssignment.create({
      data: {
        customerId: created.id,
        ownerId: created.ownerId,
        organizationUnitId: created.organizationUnitId,
        validFrom: new Date(),
        assignedById: actorId,
        reason: "Customer created",
      },
    });
    return toRecord(created);
  }

  async updateVersioned(
    id: string,
    expectedVersion: number,
    input: CustomerCommand,
    transaction: CustomerTransaction,
  ) {
    const updated = await transaction.customer.updateMany({
      where: { id, version: expectedVersion, mergedIntoCustomerId: null },
      data: {
        name: input.name,
        taxId: input.taxId,
        type: input.type,
        segment: input.segment,
        province: input.province,
        address: input.address || null,
        status: input.status,
        ownerId: input.ownerId,
        organizationUnitId: input.organizationUnitId ?? null,
        version: { increment: 1 },
      },
    });
    if (updated.count !== 1) return null;
    if (input.contact) {
      const data = contactData(input.contact);
      if (data?.isPrimary) {
        await transaction.contact.updateMany({
          where: {
            customerId: id,
            purpose: data.purpose,
            ...(input.contact.id ? { id: { not: input.contact.id } } : {}),
          },
          data: { isPrimary: false },
        });
      }
      if (input.contact.id && data) {
        await transaction.contact.updateMany({
          where: { id: input.contact.id, customerId: id },
          data,
        });
      } else if (data) {
        await transaction.contact.create({
          data: { customerId: id, ...data },
        });
      }
    }
    if (input.externalIds?.length) {
      for (const externalId of input.externalIds) {
        const existing = await transaction.customerExternalId.findUnique({
          where: {
            sourceSystem_externalId: externalId,
          },
          select: { customerId: true },
        });
        if (existing?.customerId !== undefined && existing.customerId !== id) {
          throw new CustomerIdentityConflictError();
        }
        if (!existing) {
          await transaction.customerExternalId.create({
            data: { customerId: id, ...externalId },
          });
        }
      }
    }
    return toRecord(
      await transaction.customer.findUniqueOrThrow({
        where: { id },
        select: customerSelect,
      }),
    );
  }

  async replaceActiveOwnership(
    input: {
      customerId: string;
      ownerId: string;
      organizationUnitId: string | null;
      assignedById: string;
      reason: string | null;
      effectiveAt: Date;
    },
    transaction: CustomerTransaction,
  ) {
    await transaction.customerOwnershipAssignment.updateMany({
      where: { customerId: input.customerId, validTo: null },
      data: { validTo: input.effectiveAt },
    });
    await transaction.customerOwnershipAssignment.create({
      data: {
        customerId: input.customerId,
        ownerId: input.ownerId,
        organizationUnitId: input.organizationUnitId,
        assignedById: input.assignedById,
        reason: input.reason,
        validFrom: input.effectiveAt,
      },
    });
  }

  async incrementVersion(id: string, expectedVersion: number, transaction: CustomerTransaction) {
    const updated = await transaction.customer.updateMany({ where: { id, version: expectedVersion, mergedIntoCustomerId: null }, data: { version: { increment: 1 } } });
    if (updated.count !== 1) return null;
    return toRecord(await transaction.customer.findUniqueOrThrow({ where: { id }, select: customerSelect }));
  }

  findContact(id: string, customerId: string, transaction: CustomerTransaction) {
    return transaction.contact.findFirst({ where: { id, customerId }, select: { id: true } });
  }

  async createContact(customerId: string, input: CustomerContactCommand, transaction: CustomerTransaction) {
    const data = contactData(input)!;
    if (data?.isPrimary) await transaction.contact.updateMany({ where: { customerId, isPrimary: true }, data: { isPrimary: false } });
    return transaction.contact.create({ data: { customerId, ...data }, select: { id: true } });
  }

  async updateContact(id: string, customerId: string, input: CustomerContactCommand, transaction: CustomerTransaction) {
    const data = contactData(input)!;
    if (data?.isPrimary) await transaction.contact.updateMany({ where: { customerId, id: { not: id }, isPrimary: true }, data: { isPrimary: false } });
    const updated = await transaction.contact.updateMany({ where: { id, customerId }, data });
    return updated.count === 1 ? { id } : null;
  }

  findDeterministicDuplicates(
    input: Pick<CustomerCommand, "name" | "province" | "type">,
    excludeCustomerId: string,
    transaction: CustomerTransaction,
  ) {
    return transaction.customer.findMany({
      where: {
        id: { not: excludeCustomerId },
        mergedIntoCustomerId: null,
        name: input.name,
        province: input.province,
        type: input.type,
      },
      select: { id: true },
      take: 20,
    });
  }

  async recordDuplicateCandidate(
    input: {
      customerAId: string;
      customerBId: string;
      matchSignals: Record<string, string>;
    },
    transaction: CustomerTransaction,
  ) {
    const [customerAId, customerBId] = [
      input.customerAId,
      input.customerBId,
    ].sort();
    await transaction.customerDuplicateCandidate.upsert({
      where: { customerAId_customerBId: { customerAId, customerBId } },
      create: {
        customerAId,
        customerBId,
        matchScore: new Prisma.Decimal("1.0000"),
        matchSignals: input.matchSignals,
      },
      update: { matchSignals: input.matchSignals },
    });
  }

  async wouldCreateRelationshipCycle(
    parentCustomerId: string,
    childCustomerId: string,
    transaction: CustomerTransaction,
  ) {
    if (parentCustomerId === childCustomerId) return true;
    let frontier = [childCustomerId];
    const visited = new Set(frontier);
    while (frontier.length && visited.size <= 1_000) {
      const relationships = await transaction.customerRelationship.findMany({
        where: { parentCustomerId: { in: frontier }, effectiveTo: null },
        select: { childCustomerId: true },
      });
      const next: string[] = [];
      for (const relationship of relationships) {
        if (relationship.childCustomerId === parentCustomerId) return true;
        if (!visited.has(relationship.childCustomerId)) {
          visited.add(relationship.childCustomerId);
          next.push(relationship.childCustomerId);
        }
      }
      frontier = next;
    }
    return visited.size > 1_000;
  }

  createRelationship(
    input: {
      parentCustomerId: string;
      childCustomerId: string;
      relationshipType: string;
      effectiveFrom: Date;
      effectiveTo: Date | null;
    },
    transaction: CustomerTransaction,
  ) {
    return transaction.customerRelationship.create({
      data: input,
      select: { id: true },
    });
  }

  async merge(
    input: {
      source: CustomerRecord;
      target: CustomerRecord;
      actorId: string;
      reason: string;
      mergedAt: Date;
    },
    transaction: CustomerTransaction,
  ) {
    await transaction.customer.update({
      where: { id: input.source.id },
      data: {
        mergedIntoCustomerId: input.target.id,
        version: { increment: 1 },
      },
    });
    await transaction.customer.update({
      where: { id: input.target.id },
      data: { version: { increment: 1 } },
    });
    await transaction.customerOwnershipAssignment.updateMany({
      where: { customerId: input.source.id, validTo: null },
      data: { validTo: input.mergedAt },
    });
    await transaction.customerDuplicateCandidate.updateMany({
      where: {
        resolvedAt: null,
        OR: [
          { customerAId: input.source.id },
          { customerBId: input.source.id },
        ],
      },
      data: {
        resolvedAt: input.mergedAt,
        resolutionReason: input.reason,
        mergedIntoCustomerId: input.target.id,
      },
    });
    return transaction.customerMergeHistory.create({
      data: {
        sourceCustomerId: input.source.id,
        targetCustomerId: input.target.id,
        mergedById: input.actorId,
        reason: input.reason,
        mergedAt: input.mergedAt,
        sourceSnapshot: {
          id: input.source.id,
          version: input.source.version,
          name: input.source.name,
          taxId: input.source.taxId,
          ownerId: input.source.ownerId,
          organizationUnitId: input.source.organizationUnitId ?? null,
        },
      },
      select: { id: true },
    });
  }
}

export async function getCustomer360(
  client: PrismaClient,
  context: AuthorizationContext,
  id: string,
) {
  return client.customer.findFirst({
    where: { id, ...buildCustomerScopeWhere(context) },
    include: {
      owner: true,
      organizationUnit: true,
      contacts: { orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] },
      externalIds: { orderBy: [{ sourceSystem: "asc" }, { externalId: "asc" }] },
      parentRelationships: {
        where: { effectiveTo: null },
        include: { childCustomer: { select: { id: true, name: true } } },
      },
      childRelationships: {
        where: { effectiveTo: null },
        include: { parentCustomer: { select: { id: true, name: true } } },
      },
      ownershipHistory: {
        include: {
          owner: { select: { id: true, name: true } },
          organizationUnit: { select: { id: true, name: true } },
        },
        orderBy: { validFrom: "desc" },
      },
      mergeAliases: {
        include: {
          externalIds: true,
          contacts: true,
          opportunities: { orderBy: { updatedAt: "desc" } },
          leads: { orderBy: { updatedAt: "desc" } },
          activities: {
            where: { deletedAt: null },
            include: { owner: true },
            orderBy: { createdAt: "desc" },
            take: 8,
          },
        },
        orderBy: { updatedAt: "desc" },
      },
      mergedIntoCustomer: { select: { id: true, name: true } },
      duplicateCandidatesA: {
        where: { resolvedAt: null },
        include: { customerB: { select: { id: true, name: true, taxId: true } } },
      },
      duplicateCandidatesB: {
        where: { resolvedAt: null },
        include: { customerA: { select: { id: true, name: true, taxId: true } } },
      },
      opportunities: { orderBy: { updatedAt: "desc" } },
      leads: { orderBy: { updatedAt: "desc" } },
      activities: {
        where: { deletedAt: null },
        include: { owner: true },
        orderBy: { createdAt: "desc" },
        take: 8,
      },
    },
  });
}

export async function hasConfiguredCustomerPermission(
  client: PrismaClient,
  context: AuthorizationContext,
  permissionCode: string,
) {
  const roleCodes = context.assignments.map((assignment) => assignment.role);
  if (!roleCodes.length) return false;
  return (
    (await client.rolePermissionGrant.findFirst({
      where: { roleCode: { in: roleCodes }, permissionCode },
      select: { id: true },
    })) !== null
  );
}
