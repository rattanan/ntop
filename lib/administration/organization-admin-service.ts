import type { Prisma, Role } from "@prisma/client";
import { z } from "zod";

import type { AuditWriter } from "../audit/audit-writer";
import { ENTERPRISE_ROLES } from "../authorization/enterprise-role-policy";
import { ORGANIZATION_CODE_PATTERN } from "./organization-code";
import {
  assertPermission,
  PERMISSIONS,
  type PermissionPolicy,
  permissionPolicy,
} from "../authorization/permission-policy";

const organizationCode = z
  .string()
  .trim()
  .min(2)
  .max(100)
  .regex(ORGANIZATION_CODE_PATTERN)
  .transform((value) => value.toUpperCase());

export const createOrganizationUnitSchema = z.strictObject({
  code: organizationCode,
  name: z.string().trim().min(2).max(255),
  parentId: z.string().trim().min(1).nullable(),
});

export const updateOrganizationHierarchySchema = z.strictObject({
  organizationUnitId: z.string().trim().min(1),
  parentId: z.string().trim().min(1).nullable(),
});

export const updateOrganizationUnitSchema = z.strictObject({
  organizationUnitId: z.string().trim().min(1),
  code: organizationCode,
  name: z.string().trim().min(2).max(255),
});

export const removeOrganizationUnitSchema = z.strictObject({
  organizationUnitId: z.string().trim().min(1),
  reason: z.string().trim().min(5).max(1000),
});

export const assignOrganizationApproverSchema = z.strictObject({
  userId: z.string().trim().min(1),
  organizationUnitId: z.string().trim().min(1),
  roleCode: z.enum(ENTERPRISE_ROLES),
  maximumAmount: z.string().regex(/^\d+(\.\d{1,4})?$/),
  customerSegment: z.string().trim().min(1).max(100).nullable(),
  effectiveFrom: z.date(),
  effectiveTo: z.date().nullable(),
});

export const removeOrganizationApproverSchema = z.strictObject({
  assignmentId: z.string().trim().min(1),
});

type Actor = { id: string; role: Role };
type Tx = Prisma.TransactionClient;
type Repository = {
  transaction<T>(work: (tx: Tx) => Promise<T>): Promise<T>;
};

export class OrganizationAdministrationError extends Error {
  readonly statusCode = 400;

  constructor(message: string) {
    super(message);
    this.name = "OrganizationAdministrationError";
  }
}

export class OrganizationAdminService {
  constructor(
    private readonly repository: Repository,
    private readonly audit: AuditWriter<Tx>,
    private readonly policy: PermissionPolicy = permissionPolicy,
  ) {}

  private authorize(actor: Actor) {
    assertPermission(actor, PERMISSIONS.organizationManage, this.policy);
  }

  async createOrganizationUnit(actor: Actor, input: unknown, correlationId: string) {
    this.authorize(actor);
    const data = createOrganizationUnitSchema.parse(input);

    return this.repository.transaction(async (tx) => {
      if (data.parentId) {
        const parent = await tx.organizationUnit.findUnique({
          where: { id: data.parentId },
          select: { id: true, active: true },
        });
        if (!parent?.active) {
          throw new OrganizationAdministrationError("ไม่พบหน่วยงานแม่ที่เปิดใช้งาน");
        }
      }

      const duplicate = await tx.organizationUnit.findUnique({
        where: { code: data.code },
        select: { id: true },
      });
      if (duplicate) {
        throw new OrganizationAdministrationError("รหัสหน่วยงานนี้มีอยู่แล้ว");
      }

      const row = await tx.organizationUnit.create({ data });
      await this.audit.append(
        {
          actorId: actor.id,
          action: "organization.unit.create",
          targetType: "OrganizationUnit",
          targetId: row.id,
          outcome: "SUCCESS",
          correlationId,
          data: { code: row.code, name: row.name, parentId: row.parentId },
        },
        { transaction: tx },
      );
      return row;
    });
  }

  async updateHierarchy(actor: Actor, input: unknown, correlationId: string) {
    this.authorize(actor);
    const data = updateOrganizationHierarchySchema.parse(input);
    if (data.organizationUnitId === data.parentId) {
      throw new OrganizationAdministrationError("หน่วยงานไม่สามารถเป็นหน่วยงานแม่ของตัวเองได้");
    }

    return this.repository.transaction(async (tx) => {
      const current = await tx.organizationUnit.findUnique({
        where: { id: data.organizationUnitId },
        select: { id: true, parentId: true, active: true },
      });
      if (!current?.active) {
        throw new OrganizationAdministrationError("ไม่พบหน่วยงานที่เปิดใช้งาน");
      }

      let ancestorId = data.parentId;
      const visited = new Set<string>();
      while (ancestorId) {
        if (ancestorId === data.organizationUnitId) {
          throw new OrganizationAdministrationError("ลำดับชั้นนี้ทำให้เกิดวงวน");
        }
        if (visited.has(ancestorId)) {
          throw new OrganizationAdministrationError("พบวงวนในลำดับชั้นหน่วยงานเดิม");
        }
        visited.add(ancestorId);
        const ancestor: { id: string; parentId: string | null; active: boolean } | null =
          await tx.organizationUnit.findUnique({
            where: { id: ancestorId },
            select: { id: true, parentId: true, active: true },
          });
        if (!ancestor?.active) {
          throw new OrganizationAdministrationError("ไม่พบหน่วยงานแม่ที่เปิดใช้งาน");
        }
        ancestorId = ancestor.parentId;
      }

      const row = await tx.organizationUnit.update({
        where: { id: data.organizationUnitId },
        data: { parentId: data.parentId },
      });
      await this.audit.append(
        {
          actorId: actor.id,
          action: "organization.hierarchy.update",
          targetType: "OrganizationUnit",
          targetId: row.id,
          outcome: "SUCCESS",
          correlationId,
          data: { previousParentId: current.parentId, parentId: row.parentId },
        },
        { transaction: tx },
      );
      return row;
    });
  }

  async updateOrganizationUnit(actor: Actor, input: unknown, correlationId: string) {
    this.authorize(actor);
    const data = updateOrganizationUnitSchema.parse(input);

    return this.repository.transaction(async (tx) => {
      const current = await tx.organizationUnit.findUnique({
        where: { id: data.organizationUnitId },
        select: { id: true, code: true, name: true, active: true },
      });
      if (!current?.active) {
        throw new OrganizationAdministrationError("ไม่พบหน่วยงานที่เปิดใช้งาน");
      }
      const duplicate = await tx.organizationUnit.findUnique({
        where: { code: data.code },
        select: { id: true },
      });
      if (duplicate && duplicate.id !== current.id) {
        throw new OrganizationAdministrationError("รหัสหน่วยงานนี้มีอยู่แล้ว");
      }

      const row = await tx.organizationUnit.update({
        where: { id: current.id },
        data: { code: data.code, name: data.name },
      });
      await this.audit.append(
        {
          actorId: actor.id,
          action: "organization.unit.update",
          targetType: "OrganizationUnit",
          targetId: row.id,
          outcome: "SUCCESS",
          correlationId,
          data: {
            previousCode: current.code,
            code: row.code,
            previousName: current.name,
            name: row.name,
          },
        },
        { transaction: tx },
      );
      return row;
    });
  }

  async removeOrganizationUnit(actor: Actor, input: unknown, correlationId: string) {
    this.authorize(actor);
    const data = removeOrganizationUnitSchema.parse(input);

    return this.repository.transaction(async (tx) => {
      const current = await tx.organizationUnit.findUnique({
        where: { id: data.organizationUnitId },
        select: { id: true, code: true, name: true, parentId: true, active: true },
      });
      if (!current?.active) {
        throw new OrganizationAdministrationError("ไม่พบหน่วยงานที่เปิดใช้งาน");
      }

      const [activeChildren, activeAssignments, activeLeadRules] = await Promise.all([
        tx.organizationUnit.count({ where: { parentId: current.id, active: true } }),
        tx.userRoleAssignment.count({
          where: { organizationUnitId: current.id, active: true },
        }),
        tx.leadAssignmentRule.count({
          where: { organizationUnitId: current.id, active: true },
        }),
      ]);
      if (activeChildren) {
        throw new OrganizationAdministrationError("กรุณาย้ายหรือลบหน่วยงานลูกก่อน");
      }
      if (activeAssignments) {
        throw new OrganizationAdministrationError("กรุณาถอน role assignment ที่ยังใช้งานก่อน");
      }
      if (activeLeadRules) {
        throw new OrganizationAdministrationError("กรุณาปิด Lead assignment rule ของหน่วยงานก่อน");
      }

      const row = await tx.organizationUnit.update({
        where: { id: current.id },
        data: { active: false },
      });
      const authorities = await tx.approvalAuthorityGrant.updateMany({
        where: { organizationUnitId: current.id, active: true },
        data: { active: false },
      });
      await this.audit.append(
        {
          actorId: actor.id,
          action: "organization.unit.remove",
          targetType: "OrganizationUnit",
          targetId: row.id,
          outcome: "SUCCESS",
          correlationId,
          reason: data.reason,
          data: {
            code: current.code,
            name: current.name,
            parentId: current.parentId,
            authorityGrantsDeactivated: authorities.count,
          },
        },
        { transaction: tx },
      );
      return row;
    });
  }

  async assignManagerApprover(actor: Actor, input: unknown, correlationId: string) {
    this.authorize(actor);
    const data = assignOrganizationApproverSchema.parse(input);
    if (data.userId === actor.id) {
      throw new OrganizationAdministrationError("ผู้ดูแลระบบคนอื่นต้องเป็นผู้มอบหมายสิทธิ์ให้คุณ");
    }
    if (data.effectiveTo && data.effectiveTo < data.effectiveFrom) {
      throw new OrganizationAdministrationError("วันสิ้นสุดต้องไม่ก่อนวันเริ่มต้น");
    }

    return this.repository.transaction(async (tx) => {
      const [user, organization] = await Promise.all([
        tx.user.findUnique({ where: { id: data.userId }, select: { id: true, active: true } }),
        tx.organizationUnit.findUnique({
          where: { id: data.organizationUnitId },
          select: { id: true, active: true },
        }),
      ]);
      if (!user?.active) {
        throw new OrganizationAdministrationError("ไม่พบผู้ใช้งานที่เปิดใช้งาน");
      }
      if (!organization?.active) {
        throw new OrganizationAdministrationError("ไม่พบหน่วยงานที่เปิดใช้งาน");
      }

      const overlappingAssignment = await tx.userRoleAssignment.findFirst({
        where: {
          userId: data.userId,
          roleCode: data.roleCode,
          scopeCode: "ORG_UNIT",
          organizationUnitId: data.organizationUnitId,
          active: true,
          effectiveFrom: { lte: data.effectiveTo ?? new Date("9999-12-31T23:59:59.999Z") },
          OR: [{ effectiveTo: null }, { effectiveTo: { gte: data.effectiveFrom } }],
        },
        select: { id: true },
      });
      if (overlappingAssignment) {
        throw new OrganizationAdministrationError("ผู้ใช้งานมีบทบาทนี้ในหน่วยงานและช่วงเวลาที่ทับซ้อนกันแล้ว");
      }

      const assignment = await tx.userRoleAssignment.create({
        data: {
          userId: data.userId,
          roleCode: data.roleCode,
          scopeCode: "ORG_UNIT",
          organizationUnitId: data.organizationUnitId,
          effectiveFrom: data.effectiveFrom,
          effectiveTo: data.effectiveTo,
        },
      });

      const reusableAuthority = await tx.approvalAuthorityGrant.findFirst({
        where: {
          roleCode: data.roleCode,
          permissionCode: PERMISSIONS.approvalDecide,
          organizationUnitId: data.organizationUnitId,
          customerSegment: data.customerSegment,
          maximumAmount: { gte: data.maximumAmount },
          active: true,
          effectiveFrom: { lte: data.effectiveFrom },
          OR: [
            { effectiveTo: null },
            ...(data.effectiveTo ? [{ effectiveTo: { gte: data.effectiveTo } }] : []),
          ],
        },
        select: { id: true },
      });
      const authority = reusableAuthority ?? (await tx.approvalAuthorityGrant.create({
        data: {
          roleCode: data.roleCode,
          permissionCode: PERMISSIONS.approvalDecide,
          organizationUnitId: data.organizationUnitId,
          customerSegment: data.customerSegment,
          maximumAmount: data.maximumAmount,
          effectiveFrom: data.effectiveFrom,
          effectiveTo: data.effectiveTo,
        },
        select: { id: true },
      }));

      await this.audit.append(
        {
          actorId: actor.id,
          action: "organization.manager-approver.assign",
          targetType: "OrganizationUnit",
          targetId: data.organizationUnitId,
          outcome: "SUCCESS",
          correlationId,
          data: {
            userId: data.userId,
            roleCode: data.roleCode,
            assignmentId: assignment.id,
            authorityGrantId: authority.id,
            authorityReused: Boolean(reusableAuthority),
            maximumAmount: data.maximumAmount,
            customerSegment: data.customerSegment,
          },
        },
        { transaction: tx },
      );

      return { assignment, authorityGrantId: authority.id };
    });
  }

  async removeManagerApprover(actor: Actor, input: unknown, correlationId: string) {
    this.authorize(actor);
    const data = removeOrganizationApproverSchema.parse(input);
    const revokedAt = new Date();

    return this.repository.transaction(async (tx) => {
      const assignment = await tx.userRoleAssignment.findUnique({
        where: { id: data.assignmentId },
        select: {
          id: true,
          userId: true,
          roleCode: true,
          scopeCode: true,
          organizationUnitId: true,
          effectiveFrom: true,
          effectiveTo: true,
          active: true,
        },
      });
      const isEffective = assignment
        && assignment.effectiveFrom <= revokedAt
        && (!assignment.effectiveTo || assignment.effectiveTo >= revokedAt);
      if (
        !assignment?.active
        || assignment.scopeCode !== "ORG_UNIT"
        || !assignment.organizationUnitId
        || !isEffective
      ) {
        throw new OrganizationAdministrationError("ไม่พบผู้อนุมัติ Quotation ที่มีผล");
      }
      if (assignment.userId === actor.id) {
        throw new OrganizationAdministrationError("ผู้ดูแลระบบคนอื่นต้องเป็นผู้ถอนสิทธิ์ให้คุณ");
      }

      const authority = await tx.approvalAuthorityGrant.findFirst({
        where: {
          roleCode: assignment.roleCode,
          permissionCode: PERMISSIONS.approvalDecide,
          organizationUnitId: assignment.organizationUnitId,
          active: true,
          effectiveFrom: { lte: revokedAt },
          OR: [{ effectiveTo: null }, { effectiveTo: { gte: revokedAt } }],
        },
        select: { id: true },
      });
      if (!authority) {
        throw new OrganizationAdministrationError("ไม่พบผู้อนุมัติ Quotation ที่มีผล");
      }

      const row = await tx.userRoleAssignment.update({
        where: { id: assignment.id },
        data: { active: false, effectiveTo: revokedAt },
      });
      await this.audit.append(
        {
          actorId: actor.id,
          action: "organization.manager-approver.revoke",
          targetType: "UserRoleAssignment",
          targetId: assignment.id,
          outcome: "SUCCESS",
          correlationId,
          data: {
            userId: assignment.userId,
            roleCode: assignment.roleCode,
            organizationUnitId: assignment.organizationUnitId,
            authorityGrantId: authority.id,
            previousEffectiveTo: assignment.effectiveTo?.toISOString() ?? null,
            revokedAt: revokedAt.toISOString(),
          },
        },
        { transaction: tx },
      );

      return row;
    });
  }
}
