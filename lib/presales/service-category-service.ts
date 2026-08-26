import { Prisma, type Role } from "@prisma/client";
import { z } from "zod";

import { AppendOnlyAuditWriter } from "../audit/audit-writer";
import { HashChainedAuditStore } from "../audit/hash-chained-audit-store";
import { PrismaAuditLedgerRepository } from "../audit/prisma-audit-ledger-repository";
import type { AuthorizationContext } from "../authorization/authorization-context";
import { PERMISSIONS, permissionPolicy } from "../authorization/permission-policy";
import { prisma } from "../prisma";

type Actor = { id: string; role: Role; authorization: AuthorizationContext };
type Tx = Prisma.TransactionClient;

const audit = new AppendOnlyAuditWriter<Tx>({
  store: new HashChainedAuditStore({
    repository: new PrismaAuditLedgerRepository(),
    maxAttempts: 3,
  }),
});

const code = z.string().trim().min(2).max(100)
  .regex(/^[A-Z0-9_]+$/, "ใช้ตัวอักษร A-Z ตัวเลข และ underscore เท่านั้น");
const name = z.string().trim().min(2).max(255);
const categoryInput = z.strictObject({
  code,
  name,
  displayOrder: z.number().int().min(0).max(100_000),
  requiresSiteSurvey: z.boolean(),
  requiresBoq: z.boolean(),
  requiresPhysicalInstallation: z.boolean(),
  active: z.boolean(),
});
const updateInput = categoryInput.extend({ expectedVersion: z.number().int().positive() });
const deleteInput = z.strictObject({ expectedVersion: z.number().int().positive() });
export const SERVICE_CATEGORY_SORTS = ["displayOrder", "code", "name", "productCount", "active"] as const;
export type ServiceCategorySort = typeof SERVICE_CATEGORY_SORTS[number];

export class ServiceCategoryValidationError extends Error {
  constructor(readonly issues: Record<string, string[]>) {
    super("ข้อมูล Service Category ไม่ถูกต้อง");
    this.name = "ServiceCategoryValidationError";
  }
}
export class ServiceCategoryAccessError extends Error {
  constructor() { super("ไม่พบ Service Category"); this.name = "ServiceCategoryAccessError"; }
}
export class ServiceCategoryVersionConflictError extends Error {
  constructor() { super("Service Category ถูกแก้ไขโดยผู้ใช้อื่น กรุณาโหลดหน้าใหม่"); this.name = "ServiceCategoryVersionConflictError"; }
}
export class ServiceCategoryCodeConflictError extends Error {
  constructor() { super("รหัส Service Category นี้มีอยู่แล้ว"); this.name = "ServiceCategoryCodeConflictError"; }
}
export class ServiceCategoryInUseError extends Error {
  constructor(readonly productCount: number) {
    super(`ลบ Service Category ไม่ได้ เพราะยังมี Product อ้างอิงอยู่ ${productCount} รายการ`);
    this.name = "ServiceCategoryInUseError";
  }
}

function validation(error: z.ZodError) {
  return new ServiceCategoryValidationError(error.flatten().fieldErrors as Record<string, string[]>);
}

async function requireManage(actor: Actor, tx: Tx) {
  if (permissionPolicy.allows(actor, PERMISSIONS.productCatalogManage)) return;
  const roles = [...new Set(actor.authorization.assignments.map((assignment) => assignment.role))];
  const allowed = roles.length > 0 && await tx.rolePermissionGrant.count({
    where: { roleCode: { in: roles }, permissionCode: PERMISSIONS.productCatalogManage },
  }) > 0;
  if (!allowed) throw new ServiceCategoryAccessError();
}

export async function listServiceCategories(actor: Actor, input: { page?: number; limit?: number; sort?: ServiceCategorySort; order?: "asc" | "desc" } = {}) {
  return prisma.$transaction(async (tx) => {
    await requireManage(actor, tx);
    const limit = Math.min(50, Math.max(1, input.limit ?? 10));
    const sort = input.sort && SERVICE_CATEGORY_SORTS.includes(input.sort) ? input.sort : "displayOrder";
    const order: "asc" | "desc" = input.order === "desc" ? "desc" : "asc";
    const total = await tx.serviceCategoryConfig.count();
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const page = Math.min(totalPages, Math.max(1, input.page ?? 1));
    const skip = (page - 1) * limit;
    let categories;
    if (sort === "productCount") {
      const sqlOrder = Prisma.raw(order === "desc" ? "DESC" : "ASC");
      const ids = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
        SELECT sc.id
        FROM ServiceCategoryConfig sc
        LEFT JOIN Product p ON p.serviceCategoryCode = sc.code AND p.deletedAt IS NULL
        GROUP BY sc.id
        ORDER BY COUNT(p.id) ${sqlOrder}, sc.id ASC
        LIMIT ${limit} OFFSET ${skip}
      `);
      const rows = ids.length ? await tx.serviceCategoryConfig.findMany({ where: { id: { in: ids.map((item) => item.id) } } }) : [];
      const rowById = new Map(rows.map((row) => [row.id, row]));
      categories = ids.map((item) => rowById.get(item.id)).filter((row): row is NonNullable<typeof row> => Boolean(row));
    } else {
      categories = await tx.serviceCategoryConfig.findMany({
        orderBy: [{ [sort]: order }, { id: "asc" }],
        skip,
        take: limit,
      });
    }
    const codes = categories.map((category) => category.code);
    const productCounts = codes.length ? await tx.product.groupBy({
      by: ["serviceCategoryCode"],
      where: { deletedAt: null, serviceCategoryCode: { in: codes } },
      _count: { _all: true },
    }) : [];
    const countByCode = new Map(productCounts.map((item) => [item.serviceCategoryCode, item._count._all]));
    return {
      items: categories.map((category) => ({ ...category, productCount: countByCode.get(category.code) ?? 0 })),
      total,
      page,
      totalPages,
      sort,
      order,
    };
  });
}

export async function getServiceCategory(actor: Actor, id: string) {
  return prisma.$transaction(async (tx) => {
    await requireManage(actor, tx);
    const category = await tx.serviceCategoryConfig.findUnique({ where: { id } });
    if (!category) throw new ServiceCategoryAccessError();
    const productCount = await tx.product.count({
      where: { serviceCategoryCode: category.code, deletedAt: null },
    });
    return { ...category, productCount };
  });
}

export async function createServiceCategory(actor: Actor, input: unknown, correlationId: string) {
  const parsed = categoryInput.safeParse(input);
  if (!parsed.success) throw validation(parsed.error);
  try {
    return await prisma.$transaction(async (tx) => {
      await requireManage(actor, tx);
      const created = await tx.serviceCategoryConfig.create({ data: parsed.data });
      await audit.append({
        actorId: actor.id,
        action: "service-category.create",
        targetType: "ServiceCategoryConfig",
        targetId: created.id,
        targetVersion: String(created.version),
        outcome: "SUCCESS",
        correlationId,
        data: { code: created.code, active: created.active },
      }, { transaction: tx });
      return created;
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new ServiceCategoryCodeConflictError();
    throw error;
  }
}

export async function updateServiceCategory(actor: Actor, id: string, input: unknown, correlationId: string) {
  const parsed = updateInput.safeParse(input);
  if (!parsed.success) throw validation(parsed.error);
  try {
    return await prisma.$transaction(async (tx) => {
      await requireManage(actor, tx);
      const current = await tx.serviceCategoryConfig.findFirst({ where: { id, deletedAt: null } });
      if (!current) throw new ServiceCategoryAccessError();
      const result = await tx.serviceCategoryConfig.updateMany({
        where: { id, version: parsed.data.expectedVersion, deletedAt: null },
        data: {
          code: parsed.data.code,
          name: parsed.data.name,
          displayOrder: parsed.data.displayOrder,
          requiresSiteSurvey: parsed.data.requiresSiteSurvey,
          requiresBoq: parsed.data.requiresBoq,
          requiresPhysicalInstallation: parsed.data.requiresPhysicalInstallation,
          active: parsed.data.active,
          version: { increment: 1 },
        },
      });
      if (!result.count) throw new ServiceCategoryVersionConflictError();
      const linkedProducts = current.code === parsed.data.code && current.name === parsed.data.name ? { count: 0 } : await tx.product.updateMany({
        where: { serviceCategoryCode: current.code, deletedAt: null },
        data: { serviceCategoryCode: parsed.data.code, category: parsed.data.name, version: { increment: 1 } },
      });
      const updated = await tx.serviceCategoryConfig.findUniqueOrThrow({ where: { id } });
      await audit.append({
        actorId: actor.id,
        action: "service-category.update",
        targetType: "ServiceCategoryConfig",
        targetId: id,
        targetVersion: String(updated.version),
        outcome: "SUCCESS",
        correlationId,
        data: { previousVersion: current.version, code: updated.code, active: updated.active, linkedProductsUpdated: linkedProducts.count },
      }, { transaction: tx });
      return updated;
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new ServiceCategoryCodeConflictError();
    throw error;
  }
}

export async function deleteServiceCategory(actor: Actor, id: string, input: unknown, correlationId: string) {
  const parsed = deleteInput.safeParse(input);
  if (!parsed.success) throw validation(parsed.error);
  return prisma.$transaction(async (tx) => {
    await requireManage(actor, tx);
    const current = await tx.serviceCategoryConfig.findFirst({ where: { id, deletedAt: null } });
    if (!current) throw new ServiceCategoryAccessError();
    const productCount = await tx.product.count({ where: { serviceCategoryCode: current.code, deletedAt: null } });
    if (productCount > 0) throw new ServiceCategoryInUseError(productCount);
    const result = await tx.serviceCategoryConfig.updateMany({
      where: { id, version: parsed.data.expectedVersion, deletedAt: null },
      data: { active: false, deletedAt: new Date(), deletedById: actor.id, version: { increment: 1 } },
    });
    if (!result.count) throw new ServiceCategoryVersionConflictError();
    const deleted = await tx.serviceCategoryConfig.findUniqueOrThrow({ where: { id } });
    await audit.append({
      actorId: actor.id,
      action: "service-category.delete",
      targetType: "ServiceCategoryConfig",
      targetId: id,
      targetVersion: String(deleted.version),
      outcome: "SUCCESS",
      correlationId,
      reason: "Administrator confirmed deletion of an unused Service Category.",
      data: { previousVersion: current.version, deletionMode: "SOFT_DELETE", code: current.code, linkedProductCount: 0 },
    }, { transaction: tx });
    return deleted;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
