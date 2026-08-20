import { CoverageStatus, type Prisma, type PrismaClient } from "@prisma/client";

import type { AuthorizationContext } from "../authorization/authorization-context";
import { buildOpportunityScopeWhere } from "../opportunity/opportunity-query";
import type { CatalogRepository, CatalogTransaction, CoverageRecord, ProductRecord } from "./catalog-service";

type ProductRow = Prisma.ProductGetPayload<Record<string, never>>;
type CoverageRow = Prisma.CoverageCheckGetPayload<Record<string, never>>;
type CoverageWithOpportunity = Prisma.CoverageCheckGetPayload<{ include: { opportunity: { select: { id: true; name: true; customer: { select: { id: true; name: true } } } } } }>;

function productRecord(row: ProductRow): ProductRecord {
  return { ...row, listPrice: row.listPrice.toString(), floorPrice: row.floorPrice?.toString() ?? null, standardCost: row.standardCost?.toString() ?? null };
}
function coverageRecord(row: CoverageRow | CoverageWithOpportunity): CoverageRecord {
  return { ...row, distanceKm: row.distanceKm?.toString() ?? null, confirmedCost: row.confirmedCost?.toString() ?? null, ...("opportunity" in row ? { opportunity: row.opportunity } : {}) };
}

export class PrismaCatalogRepository implements CatalogRepository {
  constructor(private client: PrismaClient) {}
  transaction<T>(work: (transaction: CatalogTransaction) => Promise<T>) { return this.client.$transaction(work); }
  async actorHasPermission(actorId: string, permission: string, transaction: CatalogTransaction) {
    const now = new Date();
    const assignments = await transaction.userRoleAssignment.findMany({ where: { userId: actorId, active: true, effectiveFrom: { lte: now }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }] }, select: { roleCode: true } });
    if (!assignments.length) return false;
    return Boolean(await transaction.rolePermissionGrant.findFirst({ where: { roleCode: { in: assignments.map((item) => item.roleCode) }, permissionCode: permission } }));
  }
  findReceipt(actorId: string, key: string, command: string, transaction: CatalogTransaction) {
    return transaction.presalesCommandReceipt.findUnique({ where: { actorId_idempotencyKey_command: { actorId, idempotencyKey: key, command } }, select: { requestHash: true, targetId: true, targetVersion: true } });
  }
  async saveReceipt(input: { actorId: string; key: string; command: string; requestHash: string; targetType: string; targetId: string; targetVersion: number }, transaction: CatalogTransaction) {
    await transaction.presalesCommandReceipt.create({ data: { actorId: input.actorId, idempotencyKey: input.key, command: input.command, requestHash: input.requestHash, targetType: input.targetType, targetId: input.targetId, targetVersion: input.targetVersion } });
  }
  async listProducts(input: { limit: number; cursor?: string; query?: string; active?: boolean }, transaction: CatalogTransaction) {
    const rows = await transaction.product.findMany({
      where: { deletedAt: null, ...(input.active === undefined ? {} : { active: input.active }), ...(input.query ? { OR: [{ code: { contains: input.query } }, { name: { contains: input.query } }, { category: { contains: input.query } }] } : {}) },
      orderBy: [{ category: "asc" }, { name: "asc" }, { id: "asc" }], take: input.limit + 1, ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
    });
    const hasMore = rows.length > input.limit; const page = hasMore ? rows.slice(0, input.limit) : rows;
    return { items: page.map(productRecord), nextCursor: hasMore ? page.at(-1)?.id ?? null : null };
  }
  async findProduct(id: string, transaction: CatalogTransaction) { const row = await transaction.product.findFirst({ where: { id, deletedAt: null } }); return row ? productRecord(row) : null; }
  async serviceCategoryExists(code: string, transaction: CatalogTransaction) { return Boolean(await transaction.serviceCategoryConfig.findFirst({ where: { code, active: true }, select: { id: true } })); }
  async createProduct(input: Omit<ProductRecord, "id" | "version" | "standardCost" | "costConfirmedAt" | "createdAt" | "updatedAt">, transaction: CatalogTransaction) {
    return productRecord(await transaction.product.create({ data: input }));
  }
  async updateProduct(id: string, expectedVersion: number, input: Omit<ProductRecord, "id" | "version" | "standardCost" | "costConfirmedAt" | "createdAt" | "updatedAt">, transaction: CatalogTransaction) {
    const result = await transaction.product.updateMany({ where: { id, version: expectedVersion, deletedAt: null }, data: { ...input, version: { increment: 1 } } });
    if (!result.count) return null; return productRecord(await transaction.product.findUniqueOrThrow({ where: { id } }));
  }
  async removeProduct(id: string, expectedVersion: number, actorId: string, transaction: CatalogTransaction) {
    const result = await transaction.product.updateMany({ where: { id, version: expectedVersion, deletedAt: null }, data: { active: false, deletedAt: new Date(), deletedById: actorId, version: { increment: 1 } } });
    if (!result.count) return null; return productRecord(await transaction.product.findUniqueOrThrow({ where: { id } }));
  }
  async listCoverage(input: { context: AuthorizationContext; limit: number; cursor?: string; status?: CoverageStatus }, transaction: CatalogTransaction) {
    const rows = await transaction.coverageCheck.findMany({ where: { deletedAt: null, ...(input.status ? { status: input.status } : {}), opportunity: buildOpportunityScopeWhere(input.context) }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: input.limit + 1, ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}), include: { opportunity: { select: { id: true, name: true, customer: { select: { id: true, name: true } } } } } });
    const hasMore = rows.length > input.limit; const page = hasMore ? rows.slice(0, input.limit) : rows;
    return { items: page.map(coverageRecord), nextCursor: hasMore ? page.at(-1)?.id ?? null : null };
  }
  async findCoverage(id: string, context: AuthorizationContext, transaction: CatalogTransaction) { const row = await transaction.coverageCheck.findFirst({ where: { id, deletedAt: null, opportunity: buildOpportunityScopeWhere(context) }, include: { opportunity: { select: { id: true, name: true, customer: { select: { id: true, name: true } } } } } }); return row ? coverageRecord(row) : null; }
  async opportunityIsAccessible(id: string, context: AuthorizationContext, transaction: CatalogTransaction) { return Boolean(await transaction.opportunity.findFirst({ where: { id, ...buildOpportunityScopeWhere(context) }, select: { id: true } })); }
  async createCoverage(input: { opportunityId: string; siteAddress: string; circuitCount: number; status?: CoverageStatus }, transaction: CatalogTransaction) { return coverageRecord(await transaction.coverageCheck.create({ data: input })); }
  async updateCoverage(id: string, expectedVersion: number, input: Omit<CoverageRecord, "id" | "version" | "createdAt" | "updatedAt" | "opportunity">, transaction: CatalogTransaction) {
    const result = await transaction.coverageCheck.updateMany({ where: { id, version: expectedVersion, deletedAt: null }, data: { ...input, version: { increment: 1 } } });
    if (!result.count) return null; return coverageRecord(await transaction.coverageCheck.findUniqueOrThrow({ where: { id } }));
  }
  async removeCoverage(id: string, expectedVersion: number, actorId: string, transaction: CatalogTransaction) {
    const result = await transaction.coverageCheck.updateMany({ where: { id, version: expectedVersion, deletedAt: null }, data: { deletedAt: new Date(), deletedById: actorId, version: { increment: 1 } } });
    if (!result.count) return null; return coverageRecord(await transaction.coverageCheck.findUniqueOrThrow({ where: { id } }));
  }
}
