import { hash } from "bcryptjs";
import { Role, type Prisma } from "@prisma/client";
import { z } from "zod";

import type { AuditWriter } from "../audit/audit-writer";
import { AUTHORIZATION_SCOPES, ENTERPRISE_ROLES } from "../authorization/enterprise-role-policy";
import { assertPermission, PERMISSIONS, permissionPolicy, type PermissionPolicy } from "../authorization/permission-policy";

type Actor = { id: string; role: Role };
type Tx = Prisma.TransactionClient;
type Repository = { transaction<T>(work: (tx: Tx) => Promise<T>): Promise<T> };

export class IdentityAdministrationError extends Error {
  constructor(message: string) { super(message); this.name = "IdentityAdministrationError"; }
}

const createUserSchema = z.strictObject({
  name: z.string().trim().min(2).max(255),
  email: z.string().trim().toLowerCase().email().max(255),
  password: z.string().min(12).max(128),
  role: z.nativeEnum(Role),
});
const updateUserSchema = z.strictObject({ id: z.string().min(1), name: z.string().trim().min(2).max(255), role: z.nativeEnum(Role), active: z.boolean() });
const assignmentSchema = z.strictObject({
  userId: z.string().min(1),
  roleCode: z.enum(ENTERPRISE_ROLES),
  scopeCode: z.enum(AUTHORIZATION_SCOPES),
  organizationUnitId: z.string().min(1).nullable(),
  effectiveFrom: z.date(),
  effectiveTo: z.date().nullable(),
});

export class IdentityAdminService {
  constructor(private readonly repository: Repository, private readonly audit: AuditWriter<Tx>, private readonly policy: PermissionPolicy = permissionPolicy) {}

  private authorize(actor: Actor) { assertPermission(actor, PERMISSIONS.userAdminManage, this.policy); }

  async createUser(actor: Actor, input: unknown, correlationId: string) {
    this.authorize(actor);
    const data = createUserSchema.parse(input);
    const passwordHash = await hash(data.password, 12);
    return this.repository.transaction(async (tx) => {
      const user = await tx.user.create({ data: { name: data.name, email: data.email, passwordHash, role: data.role }, select: { id: true, name: true, email: true, role: true, active: true } });
      await this.audit.append({ actorId: actor.id, action: "identity.user.create", targetType: "User", targetId: user.id, outcome: "SUCCESS", correlationId, data: { role: user.role, active: user.active } }, { transaction: tx });
      return user;
    });
  }

  async updateUser(actor: Actor, input: unknown, correlationId: string) {
    this.authorize(actor);
    const data = updateUserSchema.parse(input);
    if (data.id === actor.id && (!data.active || data.role !== actor.role)) throw new IdentityAdministrationError("ไม่สามารถปิดบัญชีหรือเปลี่ยน role ของตนเองได้");
    return this.repository.transaction(async (tx) => {
      const before = await tx.user.findUnique({ where: { id: data.id }, select: { role: true, active: true } });
      if (!before) throw new IdentityAdministrationError("ไม่พบผู้ใช้งาน");
      const user = await tx.user.update({ where: { id: data.id }, data: { name: data.name, role: data.role, active: data.active }, select: { id: true, name: true, email: true, role: true, active: true } });
      await this.audit.append({ actorId: actor.id, action: "identity.user.update", targetType: "User", targetId: user.id, outcome: "SUCCESS", correlationId, data: { previousRole: before.role, role: user.role, previousActive: before.active, active: user.active } }, { transaction: tx });
      return user;
    });
  }

  async createRoleAssignment(actor: Actor, input: unknown, correlationId: string) {
    this.authorize(actor);
    const data = assignmentSchema.parse(input);
    if (data.userId === actor.id) throw new IdentityAdministrationError("การมอบ role ให้ตนเองต้องใช้ผู้ดูแลระบบคนอื่น");
    if (data.effectiveTo && data.effectiveTo <= data.effectiveFrom) throw new IdentityAdministrationError("วันสิ้นสุดต้องอยู่หลังวันเริ่มต้น");
    if (["TEAM", "ORG_UNIT"].includes(data.scopeCode) && !data.organizationUnitId) throw new IdentityAdministrationError("Scope นี้ต้องระบุหน่วยงาน");
    return this.repository.transaction(async (tx) => {
      const row = await tx.userRoleAssignment.create({ data });
      await this.audit.append({ actorId: actor.id, action: "authorization.role-assignment.create", targetType: "UserRoleAssignment", targetId: row.id, outcome: "SUCCESS", correlationId, data: { userId: data.userId, roleCode: data.roleCode, scopeCode: data.scopeCode, organizationUnitId: data.organizationUnitId } }, { transaction: tx });
      return row;
    });
  }

  async revokeRoleAssignment(actor: Actor, assignmentId: string, correlationId: string) {
    this.authorize(actor);
    return this.repository.transaction(async (tx) => {
      const current = await tx.userRoleAssignment.findUnique({ where: { id: assignmentId } });
      if (!current) throw new IdentityAdministrationError("ไม่พบ role assignment");
      if (current.userId === actor.id) throw new IdentityAdministrationError("ไม่สามารถถอน role assignment ของตนเองได้");
      const row = await tx.userRoleAssignment.update({ where: { id: assignmentId }, data: { active: false, effectiveTo: current.effectiveTo ?? new Date() } });
      await this.audit.append({ actorId: actor.id, action: "authorization.role-assignment.revoke", targetType: "UserRoleAssignment", targetId: row.id, outcome: "SUCCESS", correlationId, data: { userId: row.userId, roleCode: row.roleCode, scopeCode: row.scopeCode } }, { transaction: tx });
      return row;
    });
  }
}
