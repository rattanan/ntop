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
const deleteInput = z.strictObject({ expectedVersion: z.number().int().positive(), reason: z.string().trim().min(5).max(1000) });

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

export async function listServiceCategories(actor: Actor) {
  return prisma.$transaction(async (tx) => {
    await requireManage(actor, tx);
    return tx.serviceCategoryConfig.findMany({
      orderBy: [{ deletedAt: "asc" }, { displayOrder: "asc" }, { name: "asc" }],
    });
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
      reason: parsed.data.reason,
      data: { previousVersion: current.version, deletionMode: "SOFT_DELETE", code: current.code },
    }, { transaction: tx });
    return deleted;
  });
}
