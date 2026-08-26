import { LeadSource, LeadStatus, type LeadTemperature, type Role } from "@prisma/client";
import { z } from "zod";

import type { AuditWriter } from "../audit/audit-writer";
import type { AuthorizationContext } from "../authorization/authorization-context";
import {
  assertPermission,
  PERMISSIONS,
  type PermissionPolicy,
  permissionPolicy,
} from "../authorization/permission-policy";
import {
  customerCommandSchema,
  type CustomerRepository,
} from "../customer/customer-service";
import { LEAD_ASSIGNER_ROLES, LEAD_CORE_UPDATE_ROLES, LEAD_CREATE_ROLES } from "./lead-rules";

const optionalText = (maximum: number) => z.string().trim().max(maximum).optional();

export const leadCommandSchema = z.strictObject({
  company: z.string().trim().min(2).max(255),
  companyNameEnglish: optionalText(255),
  taxId: optionalText(32),
  branchNumber: optionalText(20),
  customerType: z.enum(["B2G", "B2B"]).optional(),
  segment: optionalText(100),
  subIndustry: optionalText(191),
  companySize: z.enum(["SMALL", "MEDIUM", "LARGE"]).optional(),
  numberOfEmployees: z.number().int().min(0).optional(),
  website: z.union([z.string().trim().url().max(500), z.literal("")]).optional(),
  address: optionalText(10_000),
  subDistrict: optionalText(191),
  district: optionalText(191),
  province: optionalText(191),
  postalCode: optionalText(20),
  region: optionalText(100),
  currentTelecomProvider: optionalText(10_000),
  currentInternetProvider: optionalText(10_000),
  currentCloudProvider: optionalText(10_000),
  currentSecurityProvider: optionalText(10_000),
  contactName: z.string().trim().min(2).max(255),
  jobTitle: optionalText(191),
  department: optionalText(191),
  contactEmail: z.union([z.string().trim().email(), z.literal("")]).optional(),
  contactPhone: optionalText(100),
  source: z.enum(LeadSource),
  status: z.enum(LeadStatus),
  score: z.number().int().min(0).max(100),
  recommendedProducts: optionalText(10_000),
  requirementSummary: optionalText(10_000),
  estimatedBudget: z.string().regex(/^\d+(\.\d{1,4})?$/).optional(),
  expectedPurchaseAt: z.coerce.date().optional(),
  notes: optionalText(10_000),
  disqualificationReason: optionalText(1000),
  customerId: z.string().trim().min(1).optional(),
});
const createLeadSchema = leadCommandSchema.extend({ duplicateOverrideReason: z.string().trim().max(1000).optional() });

const conversionSchema = z.strictObject({
  expectedVersion: z.number().int().positive(),
  conversionMode: z.enum(["LINK", "CREATE"]),
  existingCustomerId: z.string().trim().min(1).optional(),
  taxId: z.string().trim().optional(),
  type: z.enum(["B2G", "B2B"]).optional(),
  segment: z.string().trim().optional(),
  subIndustry: z.string().trim().max(50).optional(),
  companySize: z.enum(["SMALL", "MEDIUM", "LARGE"]).optional(),
  province: z.string().trim().optional(),
  contactName: z.string().trim().max(255).optional(),
  contactEmail: z.union([z.string().trim().email(), z.literal("")]).optional(),
  contactPhone: z.string().trim().max(100).optional(),
  duplicateOverrideReason: z.string().trim().max(1000).optional(),
  opportunityName: z.string().trim().min(2).max(255),
  opportunityFlow: z.string().trim().min(1).max(255),
  estimatedValue: z.string().regex(/^\d+(\.\d{1,4})?$/),
  expectedCloseAt: z.coerce.date(),
  probability: z.number().int().min(0).max(100),
  productInterest: z.string().trim().max(10_000).optional(),
});

export type LeadCommand = z.infer<typeof leadCommandSchema>;
export type LeadRecord = Omit<LeadCommand, "customerId"> & {
  id: string;
  ownerId: string;
  version: number;
  customerId: string | null;
  contactId?: string | null;
  organizationUnitId?: string | null;
  temperature?: LeadTemperature;
  requirementSummary?: string;
};

export interface LeadRepository<TTransaction> {
  transaction<T>(work: (transaction: TTransaction) => Promise<T>): Promise<T>;
  findAccessible(id: string, context: AuthorizationContext, transaction: TTransaction): Promise<LeadRecord | null>;
  findReceipt(actorId: string, idempotencyKey: string, command: string, transaction: TTransaction): Promise<{ leadId: string; customerId: string | null; contactId: string | null; opportunityId: string | null; resultVersion: number } | null>;
  saveReceipt(input: { actorId: string; idempotencyKey: string; command: string; leadId: string; customerId: string | null; contactId?: string | null; opportunityId?: string | null; resultVersion: number }, transaction: TTransaction): Promise<void>;
  create(input: LeadCommand & { ownerId: string; actorId: string; correlationId: string }, transaction: TTransaction): Promise<LeadRecord>;
  findPotentialDuplicates(input: LeadCommand, transaction: TTransaction): Promise<Array<{ id: string; reasons: string[] }>>;
  updateVersioned(id: string, expectedVersion: number, input: LeadCommand, transaction: TTransaction): Promise<LeadRecord | null>;
  markConverted(id: string, expectedVersion: number, customerId: string, transaction: TTransaction): Promise<LeadRecord | null>;
  completeConversion(input: { lead: LeadRecord; expectedVersion: number; customerId: string; opportunityName: string; opportunityFlow: string; estimatedValue: string; expectedCloseAt: Date; probability: number; productInterest?: string }, transaction: TTransaction): Promise<{ lead: LeadRecord; contactId: string; opportunityId: string } | null>;
  resolveAssignableOwner(ownerId: string, organizationUnitId: string | undefined, context: AuthorizationContext, transaction: TTransaction): Promise<{ ownerId: string; organizationUnitId: string } | null>;
  assignVersioned(input: { leadId: string; expectedVersion: number; currentStatus: LeadStatus; temperature: LeadTemperature; fromOwnerId: string; fromOrganizationUnitId: string | null; toOwnerId: string; toOrganizationUnitId: string; actorId: string; reason: string; assignedAt: Date }, transaction: TTransaction): Promise<LeadRecord | null>;
  recordStatusTransition(input: { leadId: string; fromStatus: LeadStatus; toStatus: LeadStatus; reason?: string; actorId: string; correlationId: string }, transaction: TTransaction): Promise<void>;
  hasGrantedPermission(roleCodes: readonly string[], permission: string, transaction: TTransaction): Promise<boolean>;
  classificationExists?(segment: string, subIndustry: string | undefined, transaction: TTransaction): Promise<boolean>;
  provinceExists?(province: string, transaction: TTransaction): Promise<boolean>;
}

type ConversionCustomerRepository<TTransaction> = Pick<
  CustomerRepository<TTransaction>,
  "findAccessible" | "findDeterministicDuplicates" | "recordDuplicateCandidate" | "create"
>;

export class LeadValidationError extends Error {
  constructor(readonly issues?: Record<string, string[]>) { super("Lead input is invalid."); this.name = "LeadValidationError"; }
}
export class LeadAccessError extends Error { constructor() { super("Lead is unavailable."); this.name = "LeadAccessError"; } }
export class LeadVersionConflictError extends Error { constructor() { super("Lead version is stale."); this.name = "LeadVersionConflictError"; } }
export class LeadIdempotencyConflictError extends Error { constructor() { super("Lead idempotency key conflict."); this.name = "LeadIdempotencyConflictError"; } }
export class LeadConversionError extends Error { constructor() { super("Lead cannot be converted."); this.name = "LeadConversionError"; } }
export class LeadMergeDeniedError extends Error { constructor() { super("Lead cannot be merged."); this.name = "LeadMergeDeniedError"; } }
export class LeadDuplicateResolutionRequiredError extends Error {
  constructor(readonly duplicateCount: number) { super("Lead conversion requires duplicate resolution."); this.name = "LeadDuplicateResolutionRequiredError"; }
}

type Actor = { id: string; role: Role; authorization: AuthorizationContext };

export class LeadService<TTransaction> {
  constructor(
    private readonly repository: LeadRepository<TTransaction>,
    private readonly customers: ConversionCustomerRepository<TTransaction>,
    private readonly auditWriter: AuditWriter<TTransaction>,
    private readonly policy: PermissionPolicy = permissionPolicy,
  ) {}

  private parse(input: unknown) {
    const parsed = leadCommandSchema.safeParse(input);
    if (!parsed.success) throw new LeadValidationError(parsed.error.flatten().fieldErrors);
    if (parsed.data.status === LeadStatus.CONVERTED) {
      throw new LeadValidationError({ status: ["ใช้คำสั่ง Convert เพื่อเปลี่ยน Lead เป็นลูกค้า"] });
    }
    const reasonRequiredStatuses: LeadStatus[] = [LeadStatus.DISQUALIFIED, LeadStatus.INVALID, LeadStatus.DUPLICATE, LeadStatus.NOT_INTERESTED, LeadStatus.NO_BUDGET, LeadStatus.ARCHIVED];
    if (reasonRequiredStatuses.includes(parsed.data.status) && (parsed.data.disqualificationReason?.length ?? 0) < 2) throw new LeadValidationError({ disqualificationReason: ["ระบุเหตุผลสำหรับสถานะนี้"] });
    return parsed.data;
  }

  private requireEnterpriseRole(actor: Actor, roles: readonly string[]) {
    if (!actor.authorization.assignments.some((assignment) => roles.includes(assignment.role))) throw new LeadAccessError();
  }

  async create(actor: Actor, input: unknown, correlationId: string, idempotencyKey: string) {
    assertPermission(actor, PERMISSIONS.recordCreate, this.policy);
    this.requireEnterpriseRole(actor, LEAD_CREATE_ROLES);
    const result = createLeadSchema.safeParse(input);
    if (!result.success) throw new LeadValidationError(result.error.flatten().fieldErrors);
    const { duplicateOverrideReason, ...parsed } = result.data;
    if (!parsed.contactEmail && !parsed.contactPhone) throw new LeadValidationError({ contactEmail: ["ระบุอีเมลหรือโทรศัพท์อย่างน้อยหนึ่งรายการ"], contactPhone: ["ระบุอีเมลหรือโทรศัพท์อย่างน้อยหนึ่งรายการ"] });
    if (!parsed.recommendedProducts && !parsed.requirementSummary && !parsed.notes) throw new LeadValidationError({ recommendedProducts: ["ระบุสินค้าที่สนใจหรือสรุปความต้องการ"], requirementSummary:["ระบุ Business Pain Points / Requirement อย่างน้อยหนึ่งรายการ"], notes: ["ระบุสินค้าที่สนใจหรือสรุปความต้องการ"] });
    return this.repository.transaction(async (transaction) => {
      const receipt = await this.repository.findReceipt(actor.id, idempotencyKey, "lead.create", transaction);
      if (receipt) {
        const existing = await this.repository.findAccessible(receipt.leadId, actor.authorization, transaction);
        if (!existing) throw new LeadAccessError();
        return existing;
      }
      if (parsed.customerId) {
        const customer = await this.customers.findAccessible(parsed.customerId, actor.authorization, transaction);
        if (!customer) throw new LeadAccessError();
      }
      if (parsed.segment && this.repository.classificationExists && !await this.repository.classificationExists(parsed.segment, parsed.subIndustry, transaction)) throw new LeadValidationError({ segment: ["Segment หรืออุตสาหกรรมย่อยไม่ถูกต้อง"] });
      if (parsed.province && this.repository.provinceExists && !await this.repository.provinceExists(parsed.province, transaction)) throw new LeadValidationError({ province: ["กรุณาเลือกจังหวัดจากรายการ"] });
      const duplicates = await this.repository.findPotentialDuplicates(parsed, transaction);
      if (duplicates.length && (duplicateOverrideReason?.length ?? 0) < 5) throw new LeadDuplicateResolutionRequiredError(duplicates.length);
      const created = await this.repository.create({ ...parsed, ownerId: actor.id, actorId: actor.id, correlationId }, transaction);
      await this.auditWriter.append({ actorId: actor.id, action: "lead.create", targetType: "Lead", targetId: created.id, targetVersion: String(created.version), outcome: "SUCCESS", correlationId, reason: duplicateOverrideReason, data: { duplicateCandidateCount: duplicates.length, duplicateCandidates: duplicates, ownerId: created.ownerId, status: created.status } }, { transaction });
      await this.repository.saveReceipt({ actorId: actor.id, idempotencyKey, command: "lead.create", leadId: created.id, customerId: created.customerId, resultVersion: created.version }, transaction);
      return created;
    });
  }

  async update(actor: Actor, id: string, expectedVersion: number, input: unknown, correlationId: string, idempotencyKey: string) {
    assertPermission(actor, PERMISSIONS.recordUpdate, this.policy);
    this.requireEnterpriseRole(actor, LEAD_CORE_UPDATE_ROLES);
    const parsed = this.parse(input);
    return this.repository.transaction(async (transaction) => {
      const receipt = await this.repository.findReceipt(actor.id, idempotencyKey, "lead.update", transaction);
      if (receipt) {
        if (receipt.leadId !== id) throw new LeadIdempotencyConflictError();
        const existing = await this.repository.findAccessible(id, actor.authorization, transaction);
        if (!existing) throw new LeadAccessError();
        return existing;
      }
      const current = await this.repository.findAccessible(id, actor.authorization, transaction);
      if (!current || current.status === LeadStatus.CONVERTED || current.status === LeadStatus.ARCHIVED) throw new LeadAccessError();
      if (parsed.status === LeadStatus.ARCHIVED) {
        const roleCodes = actor.authorization.assignments.map(item => item.role);
        if (!await this.repository.hasGrantedPermission(roleCodes, PERMISSIONS.leadArchive, transaction)) throw new LeadAccessError();
      }
      if (parsed.customerId) {
        const customer = await this.customers.findAccessible(parsed.customerId, actor.authorization, transaction);
        if (!customer) throw new LeadAccessError();
      }
      if (parsed.segment && this.repository.classificationExists && !await this.repository.classificationExists(parsed.segment, parsed.subIndustry, transaction)) throw new LeadValidationError({ segment: ["Segment หรืออุตสาหกรรมย่อยไม่ถูกต้อง"] });
      if (parsed.province && this.repository.provinceExists && !await this.repository.provinceExists(parsed.province, transaction)) throw new LeadValidationError({ province: ["กรุณาเลือกจังหวัดจากรายการ"] });
      const updated = await this.repository.updateVersioned(id, expectedVersion, parsed, transaction);
      if (!updated) throw new LeadVersionConflictError();
      if (current.status !== updated.status) await this.repository.recordStatusTransition({ leadId: id, fromStatus: current.status, toStatus: updated.status, actorId: actor.id, correlationId, reason: parsed.disqualificationReason }, transaction);
      await this.auditWriter.append({ actorId: actor.id, action: "lead.update", targetType: "Lead", targetId: id, targetVersion: String(updated.version), outcome: "SUCCESS", correlationId, data: { previousVersion: current.version } }, { transaction });
      await this.repository.saveReceipt({ actorId: actor.id, idempotencyKey, command: "lead.update", leadId: id, customerId: updated.customerId, resultVersion: updated.version }, transaction);
      return updated;
    });
  }

  async assign(actor: Actor, id: string, expectedVersion: number, ownerId: string, reason: string, correlationId: string, idempotencyKey: string, organizationUnitId?: string) {
    assertPermission(actor, PERMISSIONS.recordUpdate, this.policy);
    this.requireEnterpriseRole(actor, LEAD_CORE_UPDATE_ROLES);
    if (!actor.authorization.assignments.some((assignment) => (LEAD_ASSIGNER_ROLES as readonly string[]).includes(assignment.role))) throw new LeadAccessError();
    if (!ownerId.trim() || reason.trim().length < 5) throw new LeadValidationError({ reason: ["ระบุเหตุผลอย่างน้อย 5 ตัวอักษร"] });
    return this.repository.transaction(async (transaction) => {
      const receipt = await this.repository.findReceipt(actor.id, idempotencyKey, "lead.assign", transaction);
      if (receipt) {
        const existing = await this.repository.findAccessible(receipt.leadId, actor.authorization, transaction);
        if (!existing || receipt.leadId !== id) throw new LeadIdempotencyConflictError();
        return existing;
      }
      const current = await this.repository.findAccessible(id, actor.authorization, transaction);
      if (!current || current.status === LeadStatus.CONVERTED || current.status === LeadStatus.ARCHIVED) throw new LeadAccessError();
      const target = await this.repository.resolveAssignableOwner(ownerId, organizationUnitId, actor.authorization, transaction);
      if (!target) throw new LeadAccessError();
      const updated = await this.repository.assignVersioned({ leadId: id, expectedVersion, currentStatus: current.status, temperature: current.temperature ?? "COLD", fromOwnerId: current.ownerId, fromOrganizationUnitId: current.organizationUnitId ?? null, toOwnerId: target.ownerId, toOrganizationUnitId: target.organizationUnitId, actorId: actor.id, reason: reason.trim(), assignedAt: new Date() }, transaction);
      if (!updated) throw new LeadVersionConflictError();
      if (current.status !== updated.status) await this.repository.recordStatusTransition({ leadId: id, fromStatus: current.status, toStatus: updated.status, actorId: actor.id, correlationId, reason }, transaction);
      await this.auditWriter.append({ actorId: actor.id, action: "lead.assign", targetType: "Lead", targetId: id, targetVersion: String(updated.version), outcome: "SUCCESS", correlationId, reason, data: { fromOwnerId: current.ownerId, toOwnerId: target.ownerId, fromOrganizationUnitId: current.organizationUnitId ?? null, toOrganizationUnitId: target.organizationUnitId } }, { transaction });
      await this.repository.saveReceipt({ actorId: actor.id, idempotencyKey, command: "lead.assign", leadId: id, customerId: updated.customerId, resultVersion: updated.version }, transaction);
      return updated;
    });
  }

  async convert(actor: Actor, id: string, input: unknown, correlationId: string, idempotencyKey: string) {
    assertPermission(actor, PERMISSIONS.recordUpdate, this.policy);
    this.requireEnterpriseRole(actor, LEAD_CORE_UPDATE_ROLES);
    const parsed = conversionSchema.safeParse(input);
    if (!parsed.success) throw new LeadValidationError(parsed.error.flatten().fieldErrors);
    return this.repository.transaction(async (transaction) => {
      const receipt = await this.repository.findReceipt(actor.id, idempotencyKey, "lead.convert", transaction);
      if (receipt) {
        if (receipt.leadId !== id || !receipt.customerId || !receipt.contactId || !receipt.opportunityId) throw new LeadIdempotencyConflictError();
        return { leadId: receipt.leadId, customerId: receipt.customerId, contactId: receipt.contactId, opportunityId: receipt.opportunityId, version: receipt.resultVersion };
      }
      const lead = await this.repository.findAccessible(id, actor.authorization, transaction);
      if (!lead) throw new LeadAccessError();
      if (lead.status === LeadStatus.CONVERTED && lead.customerId) {
        throw new LeadIdempotencyConflictError();
      }
      if (lead.status === LeadStatus.CONVERTED || lead.status === LeadStatus.ARCHIVED) throw new LeadConversionError();
      const conversionLead = { ...lead, contactName: parsed.data.contactName || lead.contactName, contactEmail: parsed.data.contactEmail || lead.contactEmail, contactPhone: parsed.data.contactPhone || lead.contactPhone };
      const contactIssues: Record<string, string[]> = {};
      if (!conversionLead.contactName) contactIssues.contactName = ["กรุณาระบุชื่อผู้ติดต่อ"];
      if (!conversionLead.contactEmail && !conversionLead.contactPhone) {
        contactIssues.contactEmail = ["กรุณาระบุอีเมลหรือโทรศัพท์อย่างน้อยหนึ่งรายการ"];
        contactIssues.contactPhone = ["กรุณาระบุอีเมลหรือโทรศัพท์อย่างน้อยหนึ่งรายการ"];
      }
      if (Object.keys(contactIssues).length) throw new LeadValidationError(contactIssues);

      let customerId: string;
      let duplicateCount = 0;
      let createdCustomerVersion: number | null = null;
      const existingCustomerId = parsed.data.existingCustomerId ?? lead.customerId ?? undefined;
      if (parsed.data.conversionMode === "LINK") {
        if (!existingCustomerId) throw new LeadConversionError();
        const customer = await this.customers.findAccessible(existingCustomerId, actor.authorization, transaction);
        if (!customer) throw new LeadAccessError();
        customerId = customer.id;
      } else {
        if (!parsed.data.segment || !parsed.data.province) throw new LeadValidationError({ segment: ["กรุณาเลือก Segment"], province: ["กรุณาเลือกจังหวัด"] });
        if (this.repository.classificationExists && !await this.repository.classificationExists(parsed.data.segment, parsed.data.subIndustry, transaction)) throw new LeadValidationError({ segment: ["Segment หรืออุตสาหกรรมย่อยไม่ถูกต้อง"] });
        if (this.repository.provinceExists && !await this.repository.provinceExists(parsed.data.province, transaction)) throw new LeadValidationError({ province: ["กรุณาเลือกจังหวัดจากรายการ"] });
        const customerInput = customerCommandSchema.safeParse({
          name: conversionLead.company,
          taxId: parsed.data.taxId ?? "",
          type: parsed.data.type,
          segment: parsed.data.segment ?? "",
          province: parsed.data.province ?? "",
          status: "PROSPECT",
          ownerId: lead.ownerId,
          organizationUnitId: null,
          subIndustry: parsed.data.subIndustry,
          companySize: parsed.data.companySize,
          address: lead.address,
          contact: { name: conversionLead.contactName, email: conversionLead.contactEmail || "", phone: conversionLead.contactPhone || undefined, purpose: "LEAD_CONVERSION", isPrimary: true },
        });
        if (!customerInput.success) throw new LeadValidationError(customerInput.error.flatten().fieldErrors);
        const duplicates = await this.customers.findDeterministicDuplicates(customerInput.data, "", transaction);
        duplicateCount = duplicates.length;
        if (duplicateCount > 0 && (parsed.data.duplicateOverrideReason?.length ?? 0) < 5) {
          throw new LeadDuplicateResolutionRequiredError(duplicateCount);
        }
        const customer = await this.customers.create(customerInput.data, actor.id, transaction);
        customerId = customer.id;
        createdCustomerVersion = customer.version;
        for (const duplicate of duplicates) {
          await this.customers.recordDuplicateCandidate({ customerAId: customer.id, customerBId: duplicate.id, matchSignals: { legalName: customer.name, province: customer.province, customerType: customer.type, overrideReason: parsed.data.duplicateOverrideReason ?? "" } }, transaction);
        }
        await this.auditWriter.append({ actorId: actor.id, action: "customer.create", targetType: "Customer", targetId: customer.id, targetVersion: String(customer.version), outcome: "SUCCESS", correlationId, reason: parsed.data.duplicateOverrideReason, data: { sourceLeadId: lead.id, duplicateCandidateCount: duplicateCount } }, { transaction });
      }
      const conversion = await this.repository.completeConversion({ lead: conversionLead, expectedVersion: parsed.data.expectedVersion, customerId, opportunityName: parsed.data.opportunityName, opportunityFlow: parsed.data.opportunityFlow, estimatedValue: parsed.data.estimatedValue, expectedCloseAt: parsed.data.expectedCloseAt, probability: parsed.data.probability, productInterest: parsed.data.productInterest }, transaction);
      if (!conversion) throw new LeadVersionConflictError();
      await this.repository.recordStatusTransition({ leadId: id, fromStatus: lead.status, toStatus: LeadStatus.CONVERTED, actorId: actor.id, correlationId, reason: parsed.data.duplicateOverrideReason }, transaction);
      await this.auditWriter.append({ actorId: actor.id, action: "lead.convert", targetType: "Lead", targetId: id, targetVersion: String(conversion.lead.version), outcome: "SUCCESS", correlationId, reason: parsed.data.duplicateOverrideReason, data: { customerId, contactId: conversion.contactId, opportunityId: conversion.opportunityId, createdCustomerVersion, duplicateCandidateCount: duplicateCount } }, { transaction });
      await this.repository.saveReceipt({ actorId: actor.id, idempotencyKey, command: "lead.convert", leadId: id, customerId, contactId: conversion.contactId, opportunityId: conversion.opportunityId, resultVersion: conversion.lead.version }, transaction);
      return { leadId: id, customerId, contactId: conversion.contactId, opportunityId: conversion.opportunityId, version: conversion.lead.version };
    });
  }
}
