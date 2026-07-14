import type { Role } from "@prisma/client";

export const PERMISSIONS = {
  recordViewOwned: "record.view.owned",
  recordViewAll: "record.view.all",
  recordCreate: "record.create",
  recordUpdate: "record.update",
  productCatalogManage: "product.catalog.manage",
  aiConfigManage: "ai.config.manage",
  aiMeetingDraftConfirm: "ai.meeting-draft.confirm",
  aiRiskExplain: "ai.risk.explain",
  customerMerge: "customer.merge",
  opportunityTransition: "opportunity.transition",
  opportunityProbabilityOverride: "opportunity.probability.override",
  forecastSnapshotCreate: "forecast.snapshot.create",
  forecastTargetManage: "forecast.target.manage",
  forecastCalendarManage: "forecast.calendar.manage",
  quoteManage: "quote.manage",
  quoteSubmit: "quote.submit",
  approvalDecide: "approval.decide",
  workflowConfigManage: "workflow.config.manage",
  userAdminManage: "user.admin.manage",
  organizationManage: "organization.manage",
  auditRead: "audit.read",
  prospectView: "prospect.view",
  prospectCreate: "prospect.create",
  prospectUpdate: "prospect.update",
  prospectAssign: "prospect.assign",
  prospectConvert: "prospect.convert",
  prospectMerge: "prospect.merge",
  prospectArchive: "prospect.archive",
  prospectSoftDelete: "prospect.soft_delete",
  prospectViewDeleted: "prospect.view_deleted",
  prospectRestore: "prospect.restore",
  prospectPermanentDelete: "prospect.permanent_delete",
  leadArchive: "lead.archive",
  customerLifecycleManage: "customer.lifecycle.manage",
  prospectImport: "prospect.import",
  prospectExport: "prospect.export",
  prospectViewAll: "prospect.view_all",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export type PermissionSubject = {
  role: Role;
};

export interface PermissionPolicy {
  allows(subject: PermissionSubject, permission: Permission): boolean;
}

const ROLE_PERMISSIONS = {
  ADMIN: Object.values(PERMISSIONS),
  SALES: [
    PERMISSIONS.recordViewOwned,
    PERMISSIONS.recordCreate,
    PERMISSIONS.recordUpdate,
    PERMISSIONS.aiMeetingDraftConfirm,
    PERMISSIONS.aiRiskExplain,
    PERMISSIONS.opportunityTransition,
    PERMISSIONS.quoteManage,
    PERMISSIONS.quoteSubmit,
  ],
  VIEWER: [PERMISSIONS.recordViewOwned],
} as const satisfies Record<Role, readonly Permission[]>;

class RolePermissionPolicy implements PermissionPolicy {
  allows(subject: PermissionSubject, permission: Permission) {
    const permissions: readonly Permission[] = ROLE_PERMISSIONS[subject.role];

    return permissions.includes(permission);
  }
}

export const permissionPolicy: PermissionPolicy = new RolePermissionPolicy();

export class PermissionDeniedError extends Error {
  readonly statusCode = 403;

  constructor(permission: Permission) {
    super(`Permission denied: ${permission}`);
    this.name = "PermissionDeniedError";
  }
}

export function assertPermission(
  subject: PermissionSubject,
  permission: Permission,
  policy: PermissionPolicy = permissionPolicy,
) {
  if (!policy.allows(subject, permission)) {
    throw new PermissionDeniedError(permission);
  }
}
