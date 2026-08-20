import { describe, expect, it, vi } from "vitest";

import { CatalogService } from "../../lib/presales/catalog-service";

const product = { id: "product-1", version: 1, code: "NT-DIA", name: "Dedicated Internet", category: "Network", description: null, listPrice: "1000.00", floorPrice: "900.0000", standardCost: "700.0000", costConfirmedAt: new Date("2026-08-01T00:00:00Z"), serviceCategoryCode: null, requiresSiteSurvey: true, requiresBoq: true, requiresPhysicalInstallation: true, active: true, createdAt: new Date("2026-08-01T00:00:00Z"), updatedAt: new Date("2026-08-01T00:00:00Z") };
const coverage = { id: "coverage-1", version: 1, opportunityId: "opportunity-1", siteAddress: "Bangkok customer site", circuitCount: 1, status: "DRAFT" as const, fiberAvailable: null, olt: null, distanceKm: null, capacityMbps: null, availablePorts: null, expectedInstallDate: null, confirmedCost: "500.0000", responderNotes: null, createdAt: new Date("2026-08-01T00:00:00Z"), updatedAt: new Date("2026-08-01T00:00:00Z") };

function setup() {
  const tx = {};
  const repository = {
    transaction: vi.fn(async (work: (value: object) => Promise<unknown>) => work(tx)), actorHasPermission: vi.fn(async () => false), findReceipt: vi.fn(async () => null), saveReceipt: vi.fn(async () => undefined),
    listProducts: vi.fn(async () => ({ items: [product], nextCursor: null })), findProduct: vi.fn(async () => product), serviceCategoryExists: vi.fn(async () => true), createProduct: vi.fn(async () => product), updateProduct: vi.fn(async () => ({ ...product, version: 2 })), removeProduct: vi.fn(async () => ({ ...product, version: 2, active: false })),
    listCoverage: vi.fn(async () => ({ items: [coverage], nextCursor: null })), findCoverage: vi.fn(async () => coverage), opportunityIsAccessible: vi.fn(async () => true), createCoverage: vi.fn(async () => coverage), updateCoverage: vi.fn(async () => ({ ...coverage, version: 2, status: "CONFIRMED" as const })), removeCoverage: vi.fn(async () => ({ ...coverage, version: 2 })),
  };
  const audit = { append: vi.fn(async () => ({ id: "audit-1" })) };
  return { service: new CatalogService(repository as never, audit as never), repository, audit, tx };
}
const admin = { id: "admin-1", role: "ADMIN", authorization: { actorId: "admin-1", assignments: [{ role: "ADMIN", scope: "ENTERPRISE", organizationUnitId: null }] } } as const;
const viewer = { id: "viewer-1", role: "VIEWER", authorization: { actorId: "viewer-1", assignments: [{ role: "VIEWER", scope: "SELF", organizationUnitId: null }] } } as const;

describe("CatalogService", () => {
  it("creates Product with decimal strings, idempotency receipt and transactional audit", async () => {
    const { service, repository, audit, tx } = setup();
    await expect(service.createProduct(admin as never, { code: "NT-DIA", name: "Dedicated Internet", category: "Network", listPrice: "1000.00", floorPrice: "900.0000", requiresSiteSurvey: true }, "corr-1", "key-1")).resolves.toMatchObject({ id: "product-1" });
    expect(repository.createProduct).toHaveBeenCalledWith(expect.objectContaining({ listPrice: "1000.00", floorPrice: "900.0000" }), tx);
    expect(audit.append).toHaveBeenCalledWith(expect.objectContaining({ action: "product.create" }), { transaction: tx });
    expect(repository.saveReceipt).toHaveBeenCalledWith(expect.objectContaining({ command: "product.create", targetType: "Product" }), tx);
  });

  it("rejects floating point JSON numbers for money fields", async () => {
    const { service, repository } = setup();
    await expect(service.createProduct(admin as never, { code: "NT-DIA", name: "Dedicated Internet", category: "Network", listPrice: 1000.1 }, "corr-2", "key-2")).rejects.toThrow("ข้อมูลไม่ถูกต้อง");
    expect(repository.createProduct).not.toHaveBeenCalled();
  });

  it("scopes Coverage creation through the accessible Opportunity and audits it", async () => {
    const { service, repository, audit, tx } = setup();
    await service.createCoverage(admin as never, { opportunityId: "opportunity-1", siteAddress: "Bangkok customer site", circuitCount: 1 }, "corr-3", "key-3");
    expect(repository.opportunityIsAccessible).toHaveBeenCalledWith("opportunity-1", admin.authorization, tx);
    expect(audit.append).toHaveBeenCalledWith(expect.objectContaining({ action: "coverage.create" }), { transaction: tx });
  });

  it("masks commercial cost fields from read-only users", async () => {
    const { service } = setup();
    const products = await service.listProducts(viewer as never, { limit: 50 });
    const checks = await service.listCoverage(viewer as never, { limit: 50 });
    expect(products.items[0]).not.toHaveProperty("floorPrice");
    expect(products.items[0]).not.toHaveProperty("standardCost");
    expect(checks.items[0]).not.toHaveProperty("confirmedCost");
  });

  it("soft deletes with optimistic version and reason in audit", async () => {
    const { service, repository, audit, tx } = setup();
    await service.removeCoverage(admin as never, "coverage-1", { expectedVersion: 1, reason: "Duplicate coverage request" }, "corr-4");
    expect(repository.removeCoverage).toHaveBeenCalledWith("coverage-1", 1, "admin-1", tx);
    expect(audit.append).toHaveBeenCalledWith(expect.objectContaining({ action: "coverage.delete", reason: "Duplicate coverage request" }), { transaction: tx });
  });
});
