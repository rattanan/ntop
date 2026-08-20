import { createHash } from "node:crypto";

import { CoverageStatus, Prisma, type Role } from "@prisma/client";
import { z } from "zod";

import type { AuditWriter } from "../audit/audit-writer";
import type { AuthorizationContext } from "../authorization/authorization-context";
import { PERMISSIONS, PermissionDeniedError, permissionPolicy, type Permission } from "../authorization/permission-policy";

export type CatalogActor = { id: string; role: Role; authorization: AuthorizationContext };
export type CatalogTransaction = Prisma.TransactionClient;

const id = z.string().trim().min(1).max(191);
const text = (max: number) => z.string().trim().min(1).max(max);
const optionalText = (max: number) => z.string().trim().max(max).nullable().optional();
const decimal = z.string().trim().regex(/^\d+(\.\d{1,4})?$/);
const listPrice = z.string().trim().regex(/^\d+(\.\d{1,2})?$/);
const productCreateSchema = z.strictObject({
  code: text(191), name: text(255), category: text(191), description: optionalText(20_000),
  listPrice, floorPrice: decimal.nullable().optional(), serviceCategoryCode: id.nullable().optional(),
  requiresSiteSurvey: z.boolean().optional(), requiresBoq: z.boolean().optional(), requiresPhysicalInstallation: z.boolean().optional(), active: z.boolean().optional(),
});
const productUpdateSchema = z.strictObject({
  expectedVersion: z.number().int().positive(), reason: text(1000), code: text(191).optional(), name: text(255).optional(), category: text(191).optional(), description: optionalText(20_000),
  listPrice: listPrice.optional(), floorPrice: decimal.nullable().optional(), serviceCategoryCode: id.nullable().optional(),
  requiresSiteSurvey: z.boolean().optional(), requiresBoq: z.boolean().optional(), requiresPhysicalInstallation: z.boolean().optional(), active: z.boolean().optional(),
});
const coverageCreateSchema = z.strictObject({
  opportunityId: id, siteAddress: text(20_000), circuitCount: z.number().int().positive().max(100_000), status: z.enum(CoverageStatus).optional(),
});
const dateTime = z.string().datetime({ offset: true }).transform((value) => new Date(value));
const coverageUpdateSchema = z.strictObject({
  expectedVersion: z.number().int().positive(), reason: text(1000), opportunityId: id.optional(), siteAddress: text(20_000).optional(), circuitCount: z.number().int().positive().max(100_000).optional(), status: z.enum(CoverageStatus).optional(),
  fiberAvailable: z.boolean().nullable().optional(), olt: optionalText(255), distanceKm: decimal.nullable().optional(), capacityMbps: z.number().int().nonnegative().nullable().optional(), availablePorts: z.number().int().nonnegative().nullable().optional(), expectedInstallDate: dateTime.nullable().optional(), confirmedCost: decimal.nullable().optional(), responderNotes: optionalText(20_000),
});
const removeSchema = z.strictObject({ expectedVersion: z.number().int().positive(), reason: text(1000) });

export type ProductRecord = {
  id: string; version: number; code: string; name: string; category: string; description: string | null; listPrice: string; floorPrice: string | null; standardCost: string | null; costConfirmedAt: Date | null; serviceCategoryCode: string | null; requiresSiteSurvey: boolean; requiresBoq: boolean; requiresPhysicalInstallation: boolean; active: boolean; createdAt: Date; updatedAt: Date;
};
export type CoverageRecord = {
  id: string; version: number; opportunityId: string; siteAddress: string; circuitCount: number; status: CoverageStatus; fiberAvailable: boolean | null; olt: string | null; distanceKm: string | null; capacityMbps: number | null; availablePorts: number | null; expectedInstallDate: Date | null; confirmedCost: string | null; responderNotes: string | null; createdAt: Date; updatedAt: Date; opportunity?: { id: string; name: string; customer: { id: string; name: string } };
};

type Receipt = { requestHash: string; targetId: string; targetVersion: number };
export interface CatalogRepository {
  transaction<T>(work: (transaction: CatalogTransaction) => Promise<T>): Promise<T>;
  actorHasPermission(actorId: string, permission: string, transaction: CatalogTransaction): Promise<boolean>;
  findReceipt(actorId: string, key: string, command: string, transaction: CatalogTransaction): Promise<Receipt | null>;
  saveReceipt(input: { actorId: string; key: string; command: string; requestHash: string; targetType: string; targetId: string; targetVersion: number }, transaction: CatalogTransaction): Promise<void>;
  listProducts(input: { limit: number; cursor?: string; query?: string; active?: boolean }, transaction: CatalogTransaction): Promise<{ items: ProductRecord[]; nextCursor: string | null }>;
  findProduct(id: string, transaction: CatalogTransaction): Promise<ProductRecord | null>;
  serviceCategoryExists(code: string, transaction: CatalogTransaction): Promise<boolean>;
  createProduct(input: Omit<ProductRecord, "id" | "version" | "standardCost" | "costConfirmedAt" | "createdAt" | "updatedAt">, transaction: CatalogTransaction): Promise<ProductRecord>;
  updateProduct(id: string, expectedVersion: number, input: Omit<ProductRecord, "id" | "version" | "standardCost" | "costConfirmedAt" | "createdAt" | "updatedAt">, transaction: CatalogTransaction): Promise<ProductRecord | null>;
  removeProduct(id: string, expectedVersion: number, actorId: string, transaction: CatalogTransaction): Promise<ProductRecord | null>;
  listCoverage(input: { context: AuthorizationContext; limit: number; cursor?: string; status?: CoverageStatus }, transaction: CatalogTransaction): Promise<{ items: CoverageRecord[]; nextCursor: string | null }>;
  findCoverage(id: string, context: AuthorizationContext, transaction: CatalogTransaction): Promise<CoverageRecord | null>;
  opportunityIsAccessible(id: string, context: AuthorizationContext, transaction: CatalogTransaction): Promise<boolean>;
  createCoverage(input: { opportunityId: string; siteAddress: string; circuitCount: number; status?: CoverageStatus }, transaction: CatalogTransaction): Promise<CoverageRecord>;
  updateCoverage(id: string, expectedVersion: number, input: Omit<CoverageRecord, "id" | "version" | "createdAt" | "updatedAt" | "opportunity">, transaction: CatalogTransaction): Promise<CoverageRecord | null>;
  removeCoverage(id: string, expectedVersion: number, actorId: string, transaction: CatalogTransaction): Promise<CoverageRecord | null>;
}

export class CatalogAccessError extends Error { constructor() { super("ไม่พบข้อมูลหรือไม่มีสิทธิ์เข้าถึง"); this.name = "CatalogAccessError"; } }
export class CatalogValidationError extends Error { constructor(readonly issues: Record<string, string[]>) { super("ข้อมูลไม่ถูกต้อง"); this.name = "CatalogValidationError"; } }
export class CatalogVersionConflictError extends Error { constructor() { super("ข้อมูลถูกแก้ไขโดยผู้ใช้อื่น"); this.name = "CatalogVersionConflictError"; } }
export class CatalogIdempotencyConflictError extends Error { constructor() { super("Idempotency-Key ถูกใช้กับข้อมูลอื่นแล้ว"); this.name = "CatalogIdempotencyConflictError"; } }
export class ProductCodeConflictError extends Error { constructor() { super("รหัสสินค้านี้มีอยู่แล้ว"); this.name = "ProductCodeConflictError"; } }

function hash(value: unknown) { return createHash("sha256").update(JSON.stringify(value)).digest("hex"); }
function validation(error: z.ZodError) { return new CatalogValidationError(error.flatten().fieldErrors as Record<string, string[]>); }
function productOutput(record: ProductRecord, canManage: boolean) {
  if (canManage) return record;
  const safe: Partial<ProductRecord> = { ...record };
  delete safe.floorPrice;
  delete safe.standardCost;
  delete safe.costConfirmedAt;
  return safe;
}
function coverageOutput(record: CoverageRecord, canManage: boolean) {
  if (canManage) return record;
  const safe: Partial<CoverageRecord> = { ...record };
  delete safe.confirmedCost;
  return safe;
}

export class CatalogService {
  constructor(private repository: CatalogRepository, private audit: AuditWriter<CatalogTransaction>) {}

  private async allows(actor: CatalogActor, permission: Permission, transaction: CatalogTransaction) {
    return permissionPolicy.allows(actor, permission) || this.repository.actorHasPermission(actor.id, permission, transaction);
  }
  private async require(actor: CatalogActor, permission: Permission, transaction: CatalogTransaction) {
    if (!await this.allows(actor, permission, transaction)) throw new PermissionDeniedError(permission);
  }

  async listProducts(actor: CatalogActor, input: { limit: number; cursor?: string; query?: string; active?: boolean }) {
    return this.repository.transaction(async (tx) => {
      await this.require(actor, PERMISSIONS.productCatalogView, tx);
      const canManage = await this.allows(actor, PERMISSIONS.productCatalogManage, tx);
      const result = await this.repository.listProducts(input, tx);
      return { ...result, items: result.items.map((item) => productOutput(item, canManage)) };
    });
  }
  async getProduct(actor: CatalogActor, id: string) {
    return this.repository.transaction(async (tx) => {
      await this.require(actor, PERMISSIONS.productCatalogView, tx);
      const record = await this.repository.findProduct(id, tx); if (!record) throw new CatalogAccessError();
      return productOutput(record, await this.allows(actor, PERMISSIONS.productCatalogManage, tx));
    });
  }
  async createProduct(actor: CatalogActor, input: unknown, correlationId: string, key: string) {
    const parsed = productCreateSchema.safeParse(input); if (!parsed.success) throw validation(parsed.error);
    const requestHash = hash(parsed.data);
    return this.repository.transaction(async (tx) => {
      await this.require(actor, PERMISSIONS.productCatalogManage, tx);
      const receipt = await this.repository.findReceipt(actor.id, key, "product.create", tx);
      if (receipt) { if (receipt.requestHash !== requestHash) throw new CatalogIdempotencyConflictError(); const replay = await this.repository.findProduct(receipt.targetId, tx); if (!replay) throw new CatalogAccessError(); return replay; }
      if (parsed.data.serviceCategoryCode && !await this.repository.serviceCategoryExists(parsed.data.serviceCategoryCode, tx)) throw new CatalogValidationError({ serviceCategoryCode: ["ไม่พบ Service Category"] });
      let created: ProductRecord;
      try {
        created = await this.repository.createProduct({ code: parsed.data.code, name: parsed.data.name, category: parsed.data.category, description: parsed.data.description || null, listPrice: parsed.data.listPrice, floorPrice: parsed.data.floorPrice ?? null, serviceCategoryCode: parsed.data.serviceCategoryCode ?? null, requiresSiteSurvey: parsed.data.requiresSiteSurvey ?? false, requiresBoq: parsed.data.requiresBoq ?? false, requiresPhysicalInstallation: parsed.data.requiresPhysicalInstallation ?? false, active: parsed.data.active ?? true }, tx);
      } catch (error) { if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new ProductCodeConflictError(); throw error; }
      await this.audit.append({ actorId: actor.id, action: "product.create", targetType: "Product", targetId: created.id, targetVersion: String(created.version), outcome: "SUCCESS", correlationId, data: { code: created.code, category: created.category } }, { transaction: tx });
      await this.repository.saveReceipt({ actorId: actor.id, key, command: "product.create", requestHash, targetType: "Product", targetId: created.id, targetVersion: created.version }, tx);
      return created;
    });
  }
  async updateProduct(actor: CatalogActor, id: string, input: unknown, correlationId: string) {
    const parsed = productUpdateSchema.safeParse(input); if (!parsed.success) throw validation(parsed.error);
    return this.repository.transaction(async (tx) => {
      await this.require(actor, PERMISSIONS.productCatalogManage, tx);
      const current = await this.repository.findProduct(id, tx); if (!current) throw new CatalogAccessError();
      const categoryCode = parsed.data.serviceCategoryCode === undefined ? current.serviceCategoryCode : parsed.data.serviceCategoryCode;
      if (categoryCode && !await this.repository.serviceCategoryExists(categoryCode, tx)) throw new CatalogValidationError({ serviceCategoryCode: ["ไม่พบ Service Category"] });
      const updated = await this.repository.updateProduct(id, parsed.data.expectedVersion, { code: parsed.data.code ?? current.code, name: parsed.data.name ?? current.name, category: parsed.data.category ?? current.category, description: parsed.data.description === undefined ? current.description : parsed.data.description, listPrice: parsed.data.listPrice ?? current.listPrice, floorPrice: parsed.data.floorPrice === undefined ? current.floorPrice : parsed.data.floorPrice, serviceCategoryCode: categoryCode, requiresSiteSurvey: parsed.data.requiresSiteSurvey ?? current.requiresSiteSurvey, requiresBoq: parsed.data.requiresBoq ?? current.requiresBoq, requiresPhysicalInstallation: parsed.data.requiresPhysicalInstallation ?? current.requiresPhysicalInstallation, active: parsed.data.active ?? current.active }, tx);
      if (!updated) throw new CatalogVersionConflictError();
      await this.audit.append({ actorId: actor.id, action: "product.update", targetType: "Product", targetId: id, targetVersion: String(updated.version), outcome: "SUCCESS", correlationId, reason: parsed.data.reason, data: { previousVersion: current.version, code: updated.code } }, { transaction: tx });
      return updated;
    });
  }
  async removeProduct(actor: CatalogActor, id: string, input: unknown, correlationId: string) {
    const parsed = removeSchema.safeParse(input); if (!parsed.success) throw validation(parsed.error);
    return this.repository.transaction(async (tx) => {
      await this.require(actor, PERMISSIONS.productCatalogManage, tx);
      const current = await this.repository.findProduct(id, tx); if (!current) throw new CatalogAccessError();
      const removed = await this.repository.removeProduct(id, parsed.data.expectedVersion, actor.id, tx); if (!removed) throw new CatalogVersionConflictError();
      await this.audit.append({ actorId: actor.id, action: "product.delete", targetType: "Product", targetId: id, targetVersion: String(removed.version), outcome: "SUCCESS", correlationId, reason: parsed.data.reason, data: { previousVersion: current.version, deletionMode: "SOFT_DELETE" } }, { transaction: tx });
      return removed;
    });
  }

  async listCoverage(actor: CatalogActor, input: { limit: number; cursor?: string; status?: CoverageStatus }) {
    return this.repository.transaction(async (tx) => { await this.require(actor, PERMISSIONS.coverageView, tx); const canManage = await this.allows(actor, PERMISSIONS.coverageManage, tx); const result = await this.repository.listCoverage({ ...input, context: actor.authorization }, tx); return { ...result, items: result.items.map((item) => coverageOutput(item, canManage)) }; });
  }
  async getCoverage(actor: CatalogActor, id: string) {
    return this.repository.transaction(async (tx) => { await this.require(actor, PERMISSIONS.coverageView, tx); const record = await this.repository.findCoverage(id, actor.authorization, tx); if (!record) throw new CatalogAccessError(); return coverageOutput(record, await this.allows(actor, PERMISSIONS.coverageManage, tx)); });
  }
  async createCoverage(actor: CatalogActor, input: unknown, correlationId: string, key: string) {
    const parsed = coverageCreateSchema.safeParse(input); if (!parsed.success) throw validation(parsed.error); const requestHash = hash(parsed.data);
    return this.repository.transaction(async (tx) => {
      await this.require(actor, PERMISSIONS.coverageManage, tx);
      const receipt = await this.repository.findReceipt(actor.id, key, "coverage.create", tx);
      if (receipt) { if (receipt.requestHash !== requestHash) throw new CatalogIdempotencyConflictError(); const replay = await this.repository.findCoverage(receipt.targetId, actor.authorization, tx); if (!replay) throw new CatalogAccessError(); return replay; }
      if (!await this.repository.opportunityIsAccessible(parsed.data.opportunityId, actor.authorization, tx)) throw new CatalogAccessError();
      const created = await this.repository.createCoverage(parsed.data, tx);
      await this.audit.append({ actorId: actor.id, action: "coverage.create", targetType: "CoverageCheck", targetId: created.id, targetVersion: String(created.version), outcome: "SUCCESS", correlationId, data: { opportunityId: created.opportunityId, status: created.status } }, { transaction: tx });
      await this.repository.saveReceipt({ actorId: actor.id, key, command: "coverage.create", requestHash, targetType: "CoverageCheck", targetId: created.id, targetVersion: created.version }, tx);
      return created;
    });
  }
  async updateCoverage(actor: CatalogActor, id: string, input: unknown, correlationId: string) {
    const parsed = coverageUpdateSchema.safeParse(input); if (!parsed.success) throw validation(parsed.error);
    return this.repository.transaction(async (tx) => {
      await this.require(actor, PERMISSIONS.coverageManage, tx);
      const current = await this.repository.findCoverage(id, actor.authorization, tx); if (!current) throw new CatalogAccessError();
      const opportunityId = parsed.data.opportunityId ?? current.opportunityId;
      if (opportunityId !== current.opportunityId && !await this.repository.opportunityIsAccessible(opportunityId, actor.authorization, tx)) throw new CatalogAccessError();
      const updated = await this.repository.updateCoverage(id, parsed.data.expectedVersion, { opportunityId, siteAddress: parsed.data.siteAddress ?? current.siteAddress, circuitCount: parsed.data.circuitCount ?? current.circuitCount, status: parsed.data.status ?? current.status, fiberAvailable: parsed.data.fiberAvailable === undefined ? current.fiberAvailable : parsed.data.fiberAvailable, olt: parsed.data.olt === undefined ? current.olt : parsed.data.olt, distanceKm: parsed.data.distanceKm === undefined ? current.distanceKm : parsed.data.distanceKm, capacityMbps: parsed.data.capacityMbps === undefined ? current.capacityMbps : parsed.data.capacityMbps, availablePorts: parsed.data.availablePorts === undefined ? current.availablePorts : parsed.data.availablePorts, expectedInstallDate: parsed.data.expectedInstallDate === undefined ? current.expectedInstallDate : parsed.data.expectedInstallDate, confirmedCost: parsed.data.confirmedCost === undefined ? current.confirmedCost : parsed.data.confirmedCost, responderNotes: parsed.data.responderNotes === undefined ? current.responderNotes : parsed.data.responderNotes }, tx);
      if (!updated) throw new CatalogVersionConflictError();
      await this.audit.append({ actorId: actor.id, action: "coverage.update", targetType: "CoverageCheck", targetId: id, targetVersion: String(updated.version), outcome: "SUCCESS", correlationId, reason: parsed.data.reason, data: { previousVersion: current.version, previousStatus: current.status, status: updated.status } }, { transaction: tx });
      return updated;
    });
  }
  async removeCoverage(actor: CatalogActor, id: string, input: unknown, correlationId: string) {
    const parsed = removeSchema.safeParse(input); if (!parsed.success) throw validation(parsed.error);
    return this.repository.transaction(async (tx) => { await this.require(actor, PERMISSIONS.coverageManage, tx); const current = await this.repository.findCoverage(id, actor.authorization, tx); if (!current) throw new CatalogAccessError(); const removed = await this.repository.removeCoverage(id, parsed.data.expectedVersion, actor.id, tx); if (!removed) throw new CatalogVersionConflictError(); await this.audit.append({ actorId: actor.id, action: "coverage.delete", targetType: "CoverageCheck", targetId: id, targetVersion: String(removed.version), outcome: "SUCCESS", correlationId, reason: parsed.data.reason, data: { previousVersion: current.version, status: current.status, deletionMode: "SOFT_DELETE" } }, { transaction: tx }); return removed; });
  }
}
