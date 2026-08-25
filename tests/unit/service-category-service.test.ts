import { beforeEach, describe, expect, it, vi } from "vitest";

const tx = {
  serviceCategoryConfig: {
    findFirst: vi.fn(),
    updateMany: vi.fn(),
    findUniqueOrThrow: vi.fn(),
  },
  product: { count: vi.fn() },
};

vi.mock("../../lib/prisma", () => ({
  prisma: { $transaction: vi.fn(async (work: (transaction: typeof tx) => unknown) => work(tx)) },
}));
vi.mock("../../lib/audit/audit-writer", () => ({
  AppendOnlyAuditWriter: class { append = vi.fn(async () => ({})); },
}));

import {
  deleteServiceCategory,
  ServiceCategoryAccessError,
  ServiceCategoryInUseError,
} from "../../lib/presales/service-category-service";

const actor = { id: "admin", role: "ADMIN", authorization: { actorId: "admin", assignments: [] } } as never;
const category = { id: "category-1", version: 1, code: "VOICE", name: "Voice" };

describe("Service Category deletion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tx.serviceCategoryConfig.findFirst.mockResolvedValue(category);
    tx.serviceCategoryConfig.updateMany.mockResolvedValue({ count: 1 });
    tx.serviceCategoryConfig.findUniqueOrThrow.mockResolvedValue({ ...category, version: 2, deletedAt: new Date() });
  });

  it("rejects deletion while a Product still references the category", async () => {
    tx.product.count.mockResolvedValue(2);
    await expect(deleteServiceCategory(actor, category.id, { expectedVersion: 1 }, "correlation-1"))
      .rejects.toBeInstanceOf(ServiceCategoryInUseError);
    expect(tx.serviceCategoryConfig.updateMany).not.toHaveBeenCalled();
  });

  it("denies deletion when the actor lacks catalog management permission", async () => {
    const viewer = { id: "viewer", role: "VIEWER", authorization: { actorId: "viewer", assignments: [] } } as never;
    await expect(deleteServiceCategory(viewer, category.id, { expectedVersion: 1 }, "correlation-denied"))
      .rejects.toBeInstanceOf(ServiceCategoryAccessError);
    expect(tx.product.count).not.toHaveBeenCalled();
  });

  it("soft-deletes an unreferenced category without a user-entered reason", async () => {
    tx.product.count.mockResolvedValue(0);
    await expect(deleteServiceCategory(actor, category.id, { expectedVersion: 1 }, "correlation-2"))
      .resolves.toMatchObject({ id: category.id, version: 2 });
    expect(tx.serviceCategoryConfig.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: category.id, version: 1, deletedAt: null },
    }));
  });
});
