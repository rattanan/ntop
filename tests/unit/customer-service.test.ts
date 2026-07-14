import { describe, expect, it, vi } from "vitest";

import type { AuditWriter } from "../../lib/audit/audit-writer";
import type { AuthorizationContext } from "../../lib/authorization/authorization-context";
import { PermissionDeniedError } from "../../lib/authorization/permission-policy";
import {
  CustomerRelationshipError,
  CustomerService,
  CustomerVersionConflictError,
  type CustomerRecord,
  type CustomerRepository,
} from "../../lib/customer/customer-service";

type Transaction = { id: string };
const transaction = { id: "tx-1" };
const input = {
  name: "Example Enterprise",
  taxId: "1234567890123",
  type: "B2B" as const,
  segment: "B1",
  province: "Bangkok",
  status: "ACTIVE" as const,
  ownerId: "owner-2",
  organizationUnitId: null,
  externalIds: [{ sourceSystem: "CRM", externalId: "CRM-1" }],
};
const record: CustomerRecord = {
  ...input,
  id: "customer-1",
  version: 1,
  mergedIntoCustomerId: null,
};

function actor(
  role: "ADMIN" | "SALES" | "VIEWER" = "ADMIN",
): {
  id: string;
  role: "ADMIN" | "SALES" | "VIEWER";
  authorization: AuthorizationContext;
} {
  return {
    id: role === "ADMIN" ? "admin-1" : "sales-1",
    role,
    authorization: {
      actorId: role === "ADMIN" ? "admin-1" : "sales-1",
      assignments: [
        {
          role: role === "ADMIN" ? ("ADMIN" as const) : ("KAM" as const),
          scope: role === "ADMIN" ? ("ENTERPRISE" as const) : ("SELF" as const),
          organizationUnitId: null,
        },
      ],
    },
  };
}

function setup() {
  const repository: CustomerRepository<Transaction> = {
    transaction: vi.fn(async (work) => work(transaction)),
    findAccessible: vi.fn().mockResolvedValue(record),
    findCommandReceipt: vi.fn().mockResolvedValue(null),
    saveCommandReceipt: vi.fn().mockResolvedValue(undefined),
    hasGrantedPermission: vi.fn().mockResolvedValue(false),
    create: vi.fn().mockResolvedValue(record),
    updateVersioned: vi.fn().mockResolvedValue({ ...record, version: 2 }),
    replaceActiveOwnership: vi.fn().mockResolvedValue(undefined),
    incrementVersion: vi.fn().mockResolvedValue({ ...record, version: 2 }),
    findContact: vi.fn().mockResolvedValue({ id: "contact-1" }),
    createContact: vi.fn().mockResolvedValue({ id: "contact-1" }),
    updateContact: vi.fn().mockResolvedValue({ id: "contact-1" }),
    findDeterministicDuplicates: vi.fn().mockResolvedValue([]),
    recordDuplicateCandidate: vi.fn().mockResolvedValue(undefined),
    wouldCreateRelationshipCycle: vi.fn().mockResolvedValue(false),
    createRelationship: vi.fn().mockResolvedValue({ id: "relationship-1" }),
    merge: vi.fn().mockResolvedValue({ id: "merge-1" }),
  };
  const auditWriter: AuditWriter<Transaction> = {
    append: vi.fn(async (event) => ({
      ...event,
      id: "audit-1",
      recordedAt: new Date("2026-07-13T00:00:00.000Z"),
    })),
  };
  return {
    service: new CustomerService(repository, auditWriter),
    repository,
    auditWriter,
  };
}

describe("CustomerService", () => {
  it("creates customer, duplicate evidence, receipt and audit atomically", async () => {
    const { service, repository, auditWriter } = setup();
    vi.mocked(repository.findDeterministicDuplicates).mockResolvedValue([
      { id: "customer-2" },
    ]);

    await expect(
      service.create(actor(), input, "correlation-1", "request-1"),
    ).resolves.toMatchObject({ id: "customer-1", duplicateCandidateCount: 1 });
    expect(repository.recordDuplicateCandidate).toHaveBeenCalled();
    expect(repository.saveCommandReceipt).toHaveBeenCalledWith(
      expect.objectContaining({ command: "customer.create" }),
      transaction,
    );
    expect(auditWriter.append).toHaveBeenCalledWith(
      expect.objectContaining({ action: "customer.create" }),
      { transaction },
    );
  });

  it("forces a non-enterprise creator to own the customer", async () => {
    const { service, repository } = setup();

    await service.create(actor("SALES"), input, "correlation-2");

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({ ownerId: "sales-1" }),
      "sales-1",
      transaction,
    );
  });

  it("returns an idempotent create without writing again", async () => {
    const { service, repository } = setup();
    vi.mocked(repository.findCommandReceipt).mockResolvedValue({
      targetId: record.id,
      targetVersion: record.version,
    });

    await service.create(actor(), input, "correlation-3", "request-1");

    expect(repository.create).not.toHaveBeenCalled();
  });

  it("fails stale updates without writing ownership or audit", async () => {
    const { service, repository, auditWriter } = setup();
    vi.mocked(repository.updateVersioned).mockResolvedValue(null);

    await expect(
      service.update(actor(), record.id, 1, input, "correlation-4"),
    ).rejects.toBeInstanceOf(CustomerVersionConflictError);
    expect(repository.replaceActiveOwnership).not.toHaveBeenCalled();
    expect(auditWriter.append).not.toHaveBeenCalled();
  });

  it("creates a detailed contact, increments customer version and audits atomically", async () => {
    const { service, repository, auditWriter } = setup();
    await expect(service.createContact(actor(), record.id, 1, { name: "Procurement Contact", title: "Director", phone: "021234567", email: "contact@example.test", relationship: "Decision Maker", purpose: "Commercial", isPrimary: true }, "correlation-contact-1", "contact-request-1")).resolves.toEqual({ id: "contact-1", customerVersion: 2 });
    expect(repository.incrementVersion).toHaveBeenCalledWith(record.id, 1, transaction);
    expect(repository.createContact).toHaveBeenCalledWith(record.id, expect.objectContaining({ name: "Procurement Contact", isPrimary: true }), transaction);
    expect(repository.saveCommandReceipt).toHaveBeenCalledWith(expect.objectContaining({ command: "customer.contact.create", targetId: "contact-1", targetVersion: 2 }), transaction);
    expect(auditWriter.append).toHaveBeenCalledWith(expect.objectContaining({ action: "customer.contact.create", targetId: "contact-1" }), { transaction });
  });

  it("rolls back contact creation when the customer version is stale", async () => {
    const { service, repository, auditWriter } = setup();
    vi.mocked(repository.incrementVersion).mockResolvedValue(null);
    await expect(service.createContact(actor(), record.id, 1, { name: "Contact" }, "correlation-contact-2", "contact-request-2")).rejects.toBeInstanceOf(CustomerVersionConflictError);
    expect(repository.createContact).not.toHaveBeenCalled();
    expect(auditWriter.append).not.toHaveBeenCalled();
  });

  it("updates only a contact belonging to the scoped customer", async () => {
    const { service, repository, auditWriter } = setup();
    await expect(service.updateContact(actor(), record.id, "contact-1", 1, { name: "Updated Contact", purpose: "Technical" }, "correlation-contact-3", "contact-request-3")).resolves.toEqual({ id: "contact-1", customerVersion: 2 });
    expect(repository.updateContact).toHaveBeenCalledWith("contact-1", record.id, expect.objectContaining({ name: "Updated Contact" }), transaction);
    expect(auditWriter.append).toHaveBeenCalledWith(expect.objectContaining({ action: "customer.contact.update" }), { transaction });
  });

  it("rejects cyclic hierarchy before persistence", async () => {
    const { service, repository } = setup();
    vi.mocked(repository.wouldCreateRelationshipCycle).mockResolvedValue(true);

    await expect(
      service.addRelationship(
        actor(),
        {
          parentCustomerId: "customer-1",
          childCustomerId: "customer-2",
          relationshipType: "GROUP",
          effectiveFrom: new Date("2026-07-13T00:00:00.000Z"),
        },
        "correlation-5",
      ),
    ).rejects.toBeInstanceOf(CustomerRelationshipError);
    expect(repository.createRelationship).not.toHaveBeenCalled();
  });

  it("denies merge without configured server permission", async () => {
    const { service, repository } = setup();

    await expect(
      service.merge(
        actor("SALES"),
        {
          sourceCustomerId: "customer-2",
          targetCustomerId: "customer-1",
          reason: "Verified duplicate",
        },
        "correlation-6",
      ),
    ).rejects.toBeInstanceOf(PermissionDeniedError);
    expect(repository.merge).not.toHaveBeenCalled();
  });

  it("merges as an alias and audits in the same transaction", async () => {
    const { service, repository, auditWriter } = setup();
    vi.mocked(repository.findAccessible)
      .mockResolvedValueOnce({ ...record, id: "customer-2" })
      .mockResolvedValueOnce(record);

    await expect(
      service.merge(
        actor(),
        {
          sourceCustomerId: "customer-2",
          targetCustomerId: "customer-1",
          reason: "Verified duplicate",
        },
        "correlation-7",
      ),
    ).resolves.toEqual({ id: "merge-1" });
    expect(auditWriter.append).toHaveBeenCalledWith(
      expect.objectContaining({ action: "customer.merge" }),
      { transaction },
    );
  });

  it("allows merge through a configured enterprise role permission", async () => {
    const { service, repository } = setup();
    vi.mocked(repository.hasGrantedPermission).mockResolvedValue(true);
    vi.mocked(repository.findAccessible)
      .mockResolvedValueOnce({ ...record, id: "customer-2" })
      .mockResolvedValueOnce(record);
    const dataSteward = actor("SALES");
    dataSteward.authorization.assignments = [
      {
        role: "DATA_STEWARD",
        scope: "ENTERPRISE",
        organizationUnitId: null,
      },
    ];

    await expect(
      service.merge(
        dataSteward,
        {
          sourceCustomerId: "customer-2",
          targetCustomerId: "customer-1",
          reason: "Verified duplicate",
        },
        "correlation-8",
      ),
    ).resolves.toEqual({ id: "merge-1" });
  });
});
