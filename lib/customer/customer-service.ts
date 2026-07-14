import type { CustomerStatus, CustomerType, Role } from "@prisma/client";
import { z } from "zod";

import type { AuditWriter } from "../audit/audit-writer";
import type { AuthorizationContext } from "../authorization/authorization-context";
import {
  assertPermission,
  PERMISSIONS,
  type PermissionPolicy,
  permissionPolicy,
} from "../authorization/permission-policy";

const externalIdSchema = z.strictObject({
  sourceSystem: z.string().trim().min(1).max(100),
  externalId: z.string().trim().min(1).max(255),
});

export const customerContactCommandSchema = z.strictObject({
  id: z.string().trim().min(1).optional(),
  name: z.string().trim().min(1).max(255),
  title: z.string().trim().max(255).optional(),
  phone: z.string().trim().max(100).optional(),
  email: z.union([z.string().trim().email(), z.literal("")]).optional(),
  relationship: z.string().trim().max(100).optional(),
  purpose: z.string().trim().max(100).optional(),
  isPrimary: z.boolean().optional(),
});
export type CustomerContactCommand = z.infer<typeof customerContactCommandSchema>;

export const customerCommandSchema = z.strictObject({
  name: z.string().trim().min(2).max(255),
  taxId: z.string().trim().regex(/^\d{13}$/),
  type: z.enum(["B2G", "B2B"]),
  segment: z.string().trim().min(1).max(100),
  province: z.string().trim().min(1).max(255),
  address: z.string().trim().max(10_000).optional(),
  status: z.enum(["PROSPECT", "ACTIVE", "INACTIVE", "BLACKLISTED", "CLOSED"]),
  ownerId: z.string().trim().min(1),
  organizationUnitId: z.string().trim().min(1).nullable().optional(),
  externalIds: z.array(externalIdSchema).max(20).optional(),
  contact: customerContactCommandSchema.optional(),
});

export type CustomerCommand = z.infer<typeof customerCommandSchema>;
export type CustomerRecord = CustomerCommand & {
  id: string;
  version: number;
  mergedIntoCustomerId: string | null;
};

export interface CustomerRepository<TTransaction> {
  transaction<T>(work: (transaction: TTransaction) => Promise<T>): Promise<T>;
  findAccessible(
    id: string,
    context: AuthorizationContext,
    transaction: TTransaction,
  ): Promise<CustomerRecord | null>;
  findCommandReceipt(
    actorId: string,
    idempotencyKey: string,
    command: string,
    transaction: TTransaction,
  ): Promise<{ targetId: string; targetVersion: number | null } | null>;
  saveCommandReceipt(
    input: {
      actorId: string;
      idempotencyKey: string;
      command: string;
      targetId: string;
      targetVersion: number | null;
    },
    transaction: TTransaction,
  ): Promise<void>;
  hasGrantedPermission(
    roleCodes: readonly string[],
    permissionCode: string,
    transaction: TTransaction,
  ): Promise<boolean>;
  create(
    input: CustomerCommand,
    actorId: string,
    transaction: TTransaction,
  ): Promise<CustomerRecord>;
  updateVersioned(
    id: string,
    expectedVersion: number,
    input: CustomerCommand,
    transaction: TTransaction,
  ): Promise<CustomerRecord | null>;
  replaceActiveOwnership(
    input: {
      customerId: string;
      ownerId: string;
      organizationUnitId: string | null;
      assignedById: string;
      reason: string | null;
      effectiveAt: Date;
    },
    transaction: TTransaction,
  ): Promise<void>;
  incrementVersion(id: string, expectedVersion: number, transaction: TTransaction): Promise<CustomerRecord | null>;
  findContact(id: string, customerId: string, transaction: TTransaction): Promise<{ id: string } | null>;
  createContact(customerId: string, input: CustomerContactCommand, transaction: TTransaction): Promise<{ id: string }>;
  updateContact(id: string, customerId: string, input: CustomerContactCommand, transaction: TTransaction): Promise<{ id: string } | null>;
  findDeterministicDuplicates(
    input: Pick<CustomerCommand, "name" | "province" | "type">,
    excludeCustomerId: string,
    transaction: TTransaction,
  ): Promise<Array<{ id: string }>>;
  recordDuplicateCandidate(
    input: {
      customerAId: string;
      customerBId: string;
      matchSignals: Record<string, string>;
    },
    transaction: TTransaction,
  ): Promise<void>;
  wouldCreateRelationshipCycle(
    parentCustomerId: string,
    childCustomerId: string,
    transaction: TTransaction,
  ): Promise<boolean>;
  createRelationship(
    input: {
      parentCustomerId: string;
      childCustomerId: string;
      relationshipType: string;
      effectiveFrom: Date;
      effectiveTo: Date | null;
    },
    transaction: TTransaction,
  ): Promise<{ id: string }>;
  merge(
    input: {
      source: CustomerRecord;
      target: CustomerRecord;
      actorId: string;
      reason: string;
      mergedAt: Date;
    },
    transaction: TTransaction,
  ): Promise<{ id: string }>;
}

export class CustomerValidationError extends Error {
  constructor(readonly issues?: Record<string, string[]>) {
    super("Customer input is invalid.");
    this.name = "CustomerValidationError";
  }
}

export class CustomerAccessError extends Error {
  constructor() {
    super("Customer is unavailable.");
    this.name = "CustomerAccessError";
  }
}

export class CustomerVersionConflictError extends Error {
  constructor() {
    super("Customer version is stale.");
    this.name = "CustomerVersionConflictError";
  }
}

export class CustomerIdentityConflictError extends Error {
  constructor() {
    super("Customer external identity belongs to another customer.");
    this.name = "CustomerIdentityConflictError";
  }
}

export class CustomerIdempotencyConflictError extends Error {
  constructor() {
    super("Idempotency key was already used for another target.");
    this.name = "CustomerIdempotencyConflictError";
  }
}

export class CustomerRelationshipError extends Error {
  constructor() {
    super("Customer relationship would be invalid or cyclic.");
    this.name = "CustomerRelationshipError";
  }
}

export class CustomerMergeError extends Error {
  constructor() {
    super("Customer merge is invalid.");
    this.name = "CustomerMergeError";
  }
}

type Actor = {
  id: string;
  role: Role;
  authorization: AuthorizationContext;
};

export class CustomerService<TTransaction> {
  constructor(
    private readonly repository: CustomerRepository<TTransaction>,
    private readonly auditWriter: AuditWriter<TTransaction>,
    private readonly policy: PermissionPolicy = permissionPolicy,
    private readonly now: () => Date = () => new Date(),
  ) {}

  private parse(input: unknown) {
    const parsed = customerCommandSchema.safeParse(input);
    if (!parsed.success) {
      throw new CustomerValidationError(parsed.error.flatten().fieldErrors);
    }
    return parsed.data;
  }

  private parseContact(input: unknown) {
    const parsed = customerContactCommandSchema.safeParse(input);
    if (!parsed.success) throw new CustomerValidationError(parsed.error.flatten().fieldErrors);
    return parsed.data;
  }

  async create(
    actor: Actor,
    input: unknown,
    correlationId: string,
    idempotencyKey?: string,
  ) {
    assertPermission(actor, PERMISSIONS.recordCreate, this.policy);
    const parsed = this.parse(input);
    const ownerId = this.policy.allows(actor, PERMISSIONS.recordViewAll)
      ? parsed.ownerId
      : actor.id;
    return this.repository.transaction(async (transaction) => {
      if (idempotencyKey) {
        const receipt = await this.repository.findCommandReceipt(
          actor.id,
          idempotencyKey,
          "customer.create",
          transaction,
        );
        if (receipt) {
          const existing = await this.repository.findAccessible(
            receipt.targetId,
            actor.authorization,
            transaction,
          );
          if (!existing) throw new CustomerAccessError();
          return { ...existing, duplicateCandidateCount: 0 };
        }
      }
      const created = await this.repository.create(
        { ...parsed, ownerId },
        actor.id,
        transaction,
      );
      const duplicates = await this.repository.findDeterministicDuplicates(
        created,
        created.id,
        transaction,
      );
      for (const duplicate of duplicates) {
        await this.repository.recordDuplicateCandidate(
          {
            customerAId: created.id,
            customerBId: duplicate.id,
            matchSignals: {
              legalName: created.name,
              province: created.province,
              customerType: created.type,
            },
          },
          transaction,
        );
      }
      await this.auditWriter.append(
        {
          actorId: actor.id,
          action: "customer.create",
          targetType: "Customer",
          targetId: created.id,
          targetVersion: String(created.version),
          outcome: "SUCCESS",
          correlationId,
          data: { duplicateCandidateCount: duplicates.length },
        },
        { transaction },
      );
      if (idempotencyKey) {
        await this.repository.saveCommandReceipt(
          {
            actorId: actor.id,
            idempotencyKey,
            command: "customer.create",
            targetId: created.id,
            targetVersion: created.version,
          },
          transaction,
        );
      }
      return { ...created, duplicateCandidateCount: duplicates.length };
    });
  }

  async update(
    actor: Actor,
    id: string,
    expectedVersion: number | undefined,
    input: unknown,
    correlationId: string,
    idempotencyKey?: string,
  ) {
    assertPermission(actor, PERMISSIONS.recordUpdate, this.policy);
    const parsed = this.parse(input);
    return this.repository.transaction(async (transaction) => {
      if (idempotencyKey) {
        const receipt = await this.repository.findCommandReceipt(
          actor.id,
          idempotencyKey,
          "customer.update",
          transaction,
        );
        if (receipt) {
          if (receipt.targetId !== id) {
            throw new CustomerIdempotencyConflictError();
          }
          const existing = await this.repository.findAccessible(
            receipt.targetId,
            actor.authorization,
            transaction,
          );
          if (!existing) throw new CustomerAccessError();
          return existing;
        }
      }
      const current = await this.repository.findAccessible(
        id,
        actor.authorization,
        transaction,
      );
      if (!current || current.mergedIntoCustomerId) throw new CustomerAccessError();
      if (current.status !== parsed.status && ["INACTIVE", "BLACKLISTED", "CLOSED"].includes(parsed.status)) {
        throw new CustomerValidationError({ status: ["ใช้คำสั่ง Customer lifecycle และระบุเหตุผลเพื่อเปลี่ยนเป็นสถานะนี้"] });
      }
      const ownerId = this.policy.allows(actor, PERMISSIONS.recordViewAll)
        ? parsed.ownerId
        : current.ownerId;
      const version = expectedVersion ?? current.version;
      const updated = await this.repository.updateVersioned(
        id,
        version,
        { ...parsed, ownerId },
        transaction,
      );
      if (!updated) throw new CustomerVersionConflictError();
      if (
        current.ownerId !== updated.ownerId ||
        current.organizationUnitId !== updated.organizationUnitId
      ) {
        await this.repository.replaceActiveOwnership(
          {
            customerId: id,
            ownerId: updated.ownerId,
            organizationUnitId: updated.organizationUnitId ?? null,
            assignedById: actor.id,
            reason: "Customer profile update",
            effectiveAt: this.now(),
          },
          transaction,
        );
      }
      await this.auditWriter.append(
        {
          actorId: actor.id,
          action: "customer.update",
          targetType: "Customer",
          targetId: id,
          targetVersion: String(updated.version),
          outcome: "SUCCESS",
          correlationId,
          data: { previousVersion: current.version, oldStatus: current.status, newStatus: updated.status },
        },
        { transaction },
      );
      if (idempotencyKey) {
        await this.repository.saveCommandReceipt(
          {
            actorId: actor.id,
            idempotencyKey,
            command: "customer.update",
            targetId: updated.id,
            targetVersion: updated.version,
          },
          transaction,
        );
      }
      return updated;
    });
  }

  async createContact(
    actor: Actor,
    customerId: string,
    expectedVersion: number,
    input: unknown,
    correlationId: string,
    idempotencyKey?: string,
  ) {
    assertPermission(actor, PERMISSIONS.recordUpdate, this.policy);
    const parsed = this.parseContact(input);
    return this.repository.transaction(async (transaction) => {
      if (idempotencyKey) {
        const receipt = await this.repository.findCommandReceipt(actor.id, idempotencyKey, "customer.contact.create", transaction);
        if (receipt) {
          const [customer, contact] = await Promise.all([
            this.repository.findAccessible(customerId, actor.authorization, transaction),
            this.repository.findContact(receipt.targetId, customerId, transaction),
          ]);
          if (!customer || !contact) throw new CustomerAccessError();
          return { id: contact.id, customerVersion: receipt.targetVersion ?? expectedVersion };
        }
      }
      const current = await this.repository.findAccessible(customerId, actor.authorization, transaction);
      if (!current || current.mergedIntoCustomerId) throw new CustomerAccessError();
      const updated = await this.repository.incrementVersion(customerId, expectedVersion, transaction);
      if (!updated) throw new CustomerVersionConflictError();
      const contact = await this.repository.createContact(customerId, parsed, transaction);
      await this.auditWriter.append({ actorId: actor.id, action: "customer.contact.create", targetType: "Contact", targetId: contact.id, targetVersion: String(updated.version), outcome: "SUCCESS", correlationId, data: { customerId, isPrimary: parsed.isPrimary ?? false, purpose: parsed.purpose ?? null } }, { transaction });
      if (idempotencyKey) await this.repository.saveCommandReceipt({ actorId: actor.id, idempotencyKey, command: "customer.contact.create", targetId: contact.id, targetVersion: updated.version }, transaction);
      return { id: contact.id, customerVersion: updated.version };
    });
  }

  async updateContact(
    actor: Actor,
    customerId: string,
    contactId: string,
    expectedVersion: number,
    input: unknown,
    correlationId: string,
    idempotencyKey?: string,
  ) {
    assertPermission(actor, PERMISSIONS.recordUpdate, this.policy);
    const parsed = this.parseContact(input);
    return this.repository.transaction(async (transaction) => {
      if (idempotencyKey) {
        const receipt = await this.repository.findCommandReceipt(actor.id, idempotencyKey, "customer.contact.update", transaction);
        if (receipt) {
          if (receipt.targetId !== contactId) throw new CustomerIdempotencyConflictError();
          const contact = await this.repository.findContact(contactId, customerId, transaction);
          if (!contact) throw new CustomerAccessError();
          return { id: contact.id, customerVersion: receipt.targetVersion ?? expectedVersion };
        }
      }
      const [current, contact] = await Promise.all([
        this.repository.findAccessible(customerId, actor.authorization, transaction),
        this.repository.findContact(contactId, customerId, transaction),
      ]);
      if (!current || current.mergedIntoCustomerId || !contact) throw new CustomerAccessError();
      const updated = await this.repository.incrementVersion(customerId, expectedVersion, transaction);
      if (!updated) throw new CustomerVersionConflictError();
      const saved = await this.repository.updateContact(contactId, customerId, parsed, transaction);
      if (!saved) throw new CustomerAccessError();
      await this.auditWriter.append({ actorId: actor.id, action: "customer.contact.update", targetType: "Contact", targetId: contactId, targetVersion: String(updated.version), outcome: "SUCCESS", correlationId, data: { customerId, isPrimary: parsed.isPrimary ?? false, purpose: parsed.purpose ?? null } }, { transaction });
      if (idempotencyKey) await this.repository.saveCommandReceipt({ actorId: actor.id, idempotencyKey, command: "customer.contact.update", targetId: contactId, targetVersion: updated.version }, transaction);
      return { id: contactId, customerVersion: updated.version };
    });
  }

  async addRelationship(
    actor: Actor,
    input: {
      parentCustomerId: string;
      childCustomerId: string;
      relationshipType: string;
      effectiveFrom: Date;
      effectiveTo?: Date | null;
    },
    correlationId: string,
    idempotencyKey?: string,
  ) {
    assertPermission(actor, PERMISSIONS.recordUpdate, this.policy);
    if (
      !input.relationshipType.trim() ||
      input.parentCustomerId === input.childCustomerId ||
      (input.effectiveTo && input.effectiveTo <= input.effectiveFrom)
    ) {
      throw new CustomerRelationshipError();
    }
    return this.repository.transaction(async (transaction) => {
      if (idempotencyKey) {
        const receipt = await this.repository.findCommandReceipt(
          actor.id,
          idempotencyKey,
          "customer.relationship.create",
          transaction,
        );
        if (receipt) return { id: receipt.targetId };
      }
      const [parent, child] = await Promise.all([
        this.repository.findAccessible(
          input.parentCustomerId,
          actor.authorization,
          transaction,
        ),
        this.repository.findAccessible(
          input.childCustomerId,
          actor.authorization,
          transaction,
        ),
      ]);
      if (!parent || !child) throw new CustomerAccessError();
      if (
        await this.repository.wouldCreateRelationshipCycle(
          input.parentCustomerId,
          input.childCustomerId,
          transaction,
        )
      ) {
        throw new CustomerRelationshipError();
      }
      const relationship = await this.repository.createRelationship(
        {
          ...input,
          relationshipType: input.relationshipType.trim(),
          effectiveTo: input.effectiveTo ?? null,
        },
        transaction,
      );
      await this.auditWriter.append(
        {
          actorId: actor.id,
          action: "customer.relationship.create",
          targetType: "CustomerRelationship",
          targetId: relationship.id,
          outcome: "SUCCESS",
          correlationId,
          data: {
            parentCustomerId: input.parentCustomerId,
            childCustomerId: input.childCustomerId,
            relationshipType: input.relationshipType,
          },
        },
        { transaction },
      );
      if (idempotencyKey) {
        await this.repository.saveCommandReceipt(
          {
            actorId: actor.id,
            idempotencyKey,
            command: "customer.relationship.create",
            targetId: relationship.id,
            targetVersion: null,
          },
          transaction,
        );
      }
      return relationship;
    });
  }

  async merge(
    actor: Actor,
    input: { sourceCustomerId: string; targetCustomerId: string; reason: string },
    correlationId: string,
    idempotencyKey?: string,
  ) {
    if (
      input.sourceCustomerId === input.targetCustomerId ||
      input.reason.trim().length < 3
    ) {
      throw new CustomerMergeError();
    }
    return this.repository.transaction(async (transaction) => {
      const legacyAllowed = this.policy.allows(
        actor,
        PERMISSIONS.customerMerge,
      );
      const configuredAllowed = await this.repository.hasGrantedPermission(
        actor.authorization.assignments.map((assignment) => assignment.role),
        PERMISSIONS.customerMerge,
        transaction,
      );
      if (!legacyAllowed && !configuredAllowed) {
        assertPermission(actor, PERMISSIONS.customerMerge, this.policy);
      }
      if (idempotencyKey) {
        const receipt = await this.repository.findCommandReceipt(
          actor.id,
          idempotencyKey,
          "customer.merge",
          transaction,
        );
        if (receipt) return { id: receipt.targetId };
      }
      const [source, target] = await Promise.all([
        this.repository.findAccessible(
          input.sourceCustomerId,
          actor.authorization,
          transaction,
        ),
        this.repository.findAccessible(
          input.targetCustomerId,
          actor.authorization,
          transaction,
        ),
      ]);
      if (
        !source ||
        !target ||
        source.mergedIntoCustomerId ||
        target.mergedIntoCustomerId
      ) {
        throw new CustomerMergeError();
      }
      const mergedAt = this.now();
      const merged = await this.repository.merge(
        {
          source,
          target,
          actorId: actor.id,
          reason: input.reason.trim(),
          mergedAt,
        },
        transaction,
      );
      await this.auditWriter.append(
        {
          actorId: actor.id,
          action: "customer.merge",
          targetType: "Customer",
          targetId: target.id,
          targetVersion: String(target.version + 1),
          outcome: "SUCCESS",
          correlationId,
          reason: input.reason.trim(),
          data: { sourceCustomerId: source.id, mergeHistoryId: merged.id },
        },
        { transaction },
      );
      if (idempotencyKey) {
        await this.repository.saveCommandReceipt(
          {
            actorId: actor.id,
            idempotencyKey,
            command: "customer.merge",
            targetId: merged.id,
            targetVersion: target.version + 1,
          },
          transaction,
        );
      }
      return merged;
    });
  }
}

export function legacyCustomerCommand(input: {
  name: string;
  taxId: string;
  type: CustomerType;
  segment: string;
  province: string;
  address?: string;
  status: CustomerStatus;
  ownerId: string;
  contact?: CustomerCommand["contact"];
}): CustomerCommand {
  return { ...input, organizationUnitId: null, externalIds: [] };
}
