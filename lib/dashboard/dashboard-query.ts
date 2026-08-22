import {
  ApprovalRequestStatus,
  ApprovalStepStatus,
  OpportunityStage,
  Prisma,
  SalesTargetStatus,
  type Prisma as PrismaTypes,
} from "@prisma/client";

import { authorizedOrganizationUnitIds, buildAuthorizedUserWhere, type AuthorizationContext } from "../authorization/authorization-context";
import { buildActivityScopeWhere } from "../activity/activity-authorization";
import { buildCustomerScopeWhere } from "../customer/customer-query-service";
import { buildSalesTargetScopeWhere } from "../forecast/forecast-authorization";
import { buildLeadScopeWhere } from "../lead/prisma-lead-repository";
import { buildOpportunityScopeWhere } from "../opportunity/opportunity-query";
import { prisma } from "../prisma";
import { buildProspectScopeWhere } from "../prospect/prospect-authorization";
import { canViewDashboard, visibleDashboardSections, type DashboardSection } from "./dashboard-permissions";
import { dashboardDateRange, type DashboardFilters } from "./dashboard-filters";

const CLOSED_OPPORTUNITY_STAGES = [
  OpportunityStage.WON,
  OpportunityStage.LOST,
  OpportunityStage.CANCELLED,
  OpportunityStage.EXPIRED,
] as const;
const PENDING_APPROVAL_REQUESTS = [ApprovalRequestStatus.PENDING, ApprovalRequestStatus.PENDING_ESCALATION] as const;
const MONEY_ZERO = new Prisma.Decimal(0);

export class DashboardAccessError extends Error {
  readonly statusCode = 403;

  constructor() {
    super("Dashboard is unavailable for this account or scope.");
    this.name = "DashboardAccessError";
  }
}

export type DashboardChartPoint = {
  key: string;
  label: string;
  count: number;
  value: string;
  href: string;
};

export type DashboardMetric = {
  key: string;
  label: string;
  value: string;
  kind: "count" | "money" | "percent";
  detail: string;
  href: string;
  tone?: "default" | "positive" | "warning" | "critical";
};

export type DashboardActionItem = {
  id: string;
  title: string;
  description: string;
  href: string;
  occurredAt: string;
  tone: "info" | "warning" | "critical";
  source: string;
};

export type DashboardRoleFocus = {
  section: DashboardSection;
  title: string;
  description: string;
  metrics: DashboardMetric[];
  items: DashboardActionItem[];
};

export type DashboardData = {
  filters: DashboardFilters;
  permissions: { sections: DashboardSection[]; canExport: boolean };
  scopeLabel: string;
  updatedAt: string;
  options: {
    departments: Array<{ id: string; name: string }>;
    teams: Array<{ id: string; name: string; parentId: string | null }>;
    owners: Array<{ id: string; name: string }>;
    segments: string[];
    products: Array<{ id: string; name: string }>;
    statuses: string[];
  };
  kpis: DashboardMetric[];
  funnel: DashboardChartPoint[];
  charts: {
    stage: DashboardChartPoint[];
    segment: DashboardChartPoint[];
    product: DashboardChartPoint[];
    owner: DashboardChartPoint[];
    month: DashboardChartPoint[];
  };
  conversion: { leadToOpportunity: number; winRate: number; lossRate: number };
  recentActivities: DashboardActionItem[];
  notifications: DashboardActionItem[];
  actions: DashboardActionItem[];
  roleFocus: DashboardRoleFocus[];
  isEmpty: boolean;
};

type DashboardActor = {
  id: string;
  authorization: AuthorizationContext;
  grantedPermissions: readonly string[];
};

type ResolvedScope = {
  organizationUnitIds?: string[];
  ownerId?: string;
  organizationUnitOptions: Array<{ id: string; name: string; parentId: string | null }>;
  ownerOptions: Array<{ id: string; name: string }>;
  scopeLabel: string;
};

function money(value: Prisma.Decimal | string | number | null | undefined) {
  return new Prisma.Decimal(value ?? 0);
}

function sumMoney<T>(rows: readonly T[], select: (row: T) => Prisma.Decimal | string | number | null | undefined) {
  return rows.reduce((total, row) => total.plus(money(select(row))), MONEY_ZERO);
}

function moneyString(value: Prisma.Decimal) {
  return value.toFixed(4);
}

function dateWhere(from: Date | undefined, to: Date | undefined): PrismaTypes.DateTimeFilter | undefined {
  return from || to ? { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } : undefined;
}

function addChartPoint(
  map: Map<string, { count: number; value: Prisma.Decimal }>,
  key: string,
  value: Prisma.Decimal,
) {
  const current = map.get(key) ?? { count: 0, value: MONEY_ZERO };
  map.set(key, { count: current.count + 1, value: current.value.plus(value) });
}

function chartPoints(
  map: Map<string, { count: number; value: Prisma.Decimal }>,
  href: (key: string) => string,
): DashboardChartPoint[] {
  return [...map.entries()]
    .map(([key, item]) => ({ key, label: key, count: item.count, value: moneyString(item.value), href: href(key) }))
    .sort((left, right) => money(right.value).comparedTo(money(left.value)));
}

async function resolveScope(actor: DashboardActor, filters: DashboardFilters): Promise<ResolvedScope> {
  const assignedOrganizationIds = authorizedOrganizationUnitIds(actor.authorization);
  const organizationUnits = await prisma.organizationUnit.findMany({
    where: { active: true, id: { in: assignedOrganizationIds } },
    select: { id: true, name: true, parentId: true },
    orderBy: { name: "asc" },
  });
  const allowedOrganizationIds = new Set(organizationUnits.map((unit) => unit.id));
  for (const requested of [filters.departmentId, filters.teamId]) {
    if (requested && !allowedOrganizationIds.has(requested)) throw new DashboardAccessError();
  }
  if (filters.departmentId && filters.teamId) {
    const team = organizationUnits.find((unit) => unit.id === filters.teamId);
    if (team?.parentId !== filters.departmentId && team?.id !== filters.departmentId) throw new DashboardAccessError();
  }
  const selectedOrganizationId = filters.teamId ?? filters.departmentId;
  const ownerOptions = await prisma.user.findMany({
    where: buildAuthorizedUserWhere(actor.authorization),
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  if (filters.ownerId && !ownerOptions.some((owner) => owner.id === filters.ownerId)) throw new DashboardAccessError();
  const scopeLabel = selectedOrganizationId
      ? organizationUnits.find((unit) => unit.id === selectedOrganizationId)?.name ?? "Scoped organization"
      : assignedOrganizationIds.length
        ? organizationUnits.map((unit) => unit.name).join(", ")
        : "ข้อมูลของฉัน";
  return {
    ...(selectedOrganizationId ? { organizationUnitIds: [selectedOrganizationId] } : {}),
    ...(filters.ownerId ? { ownerId: filters.ownerId } : {}),
    organizationUnitOptions: organizationUnits,
    ownerOptions,
    scopeLabel,
  };
}

function filterUrl(path: string, filters: Record<string, string | undefined>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) if (value) params.set(key, value);
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}

function metric(
  key: string,
  label: string,
  value: string | number,
  kind: DashboardMetric["kind"],
  detail: string,
  href: string,
  tone?: DashboardMetric["tone"],
): DashboardMetric {
  return { key, label, value: String(value), kind, detail, href, ...(tone ? { tone } : {}) };
}

export async function loadDashboardData(
  actor: DashboardActor,
  filters: DashboardFilters,
  now = new Date(),
): Promise<DashboardData> {
  if (!canViewDashboard(actor.grantedPermissions)) throw new DashboardAccessError();
  const sections = visibleDashboardSections(actor.grantedPermissions);
  const grants = new Set(actor.grantedPermissions);
  const roles = [...new Set(actor.authorization.assignments.map((assignment) => assignment.role))];
  const scope = await resolveScope(actor, filters);
  const { from, to } = dashboardDateRange(filters);
  const createdAt = dateWhere(from, to);
  const expectedCloseAt = dateWhere(from, to);
  const organizationFilter = scope.organizationUnitIds ? { organizationUnitId: { in: scope.organizationUnitIds } } : {};
  const ownerFilter = scope.ownerId ? { ownerId: scope.ownerId } : {};
  const selectedProduct = filters.productId
    ? await prisma.product.findFirst({ where: { id: filters.productId, active: true }, select: { id: true, name: true } })
    : null;
  if (filters.productId && !selectedProduct) throw new DashboardAccessError();

  const prospectWhere: PrismaTypes.ProspectWhereInput = {
    AND: [
      buildProspectScopeWhere(actor.authorization, grants),
      ownerFilter,
      scope.organizationUnitIds
        ? { OR: [{ responsibleBusinessUnitId: { in: scope.organizationUnitIds } }, { salesTeamId: { in: scope.organizationUnitIds } }] }
        : {},
      createdAt ? { createdAt } : {},
      selectedProduct ? { recommendedProducts: { contains: selectedProduct.name } } : {},
    ],
  };
  const leadWhere: PrismaTypes.LeadWhereInput = {
    AND: [
      buildLeadScopeWhere(actor.authorization),
      ownerFilter,
      organizationFilter,
      createdAt ? { createdAt } : {},
      selectedProduct ? { recommendedProducts: { contains: selectedProduct.name } } : {},
    ],
  };
  const customerWhere: PrismaTypes.CustomerWhereInput = {
    AND: [
      buildCustomerScopeWhere(actor.authorization),
      ownerFilter,
      organizationFilter,
      { mergedIntoCustomerId: null },
      createdAt ? { createdAt } : {},
      filters.segment ? { segment: filters.segment } : {},
    ],
  };
  const opportunityBaseWhere: PrismaTypes.OpportunityWhereInput = {
    AND: [
      buildOpportunityScopeWhere(actor.authorization),
      ownerFilter,
      organizationFilter,
      expectedCloseAt ? { expectedCloseAt } : {},
      filters.segment ? { customer: { segment: filters.segment } } : {},
      filters.status && Object.values(OpportunityStage).includes(filters.status as OpportunityStage)
        ? { stage: filters.status as OpportunityStage }
        : {},
      selectedProduct
        ? { quotes: { some: { versions: { some: { items: { some: { productId: selectedProduct.id } } } } } } }
        : {},
    ],
  };
  const activeOpportunityWhere: PrismaTypes.OpportunityWhereInput = {
    AND: [opportunityBaseWhere, { stage: { notIn: [...CLOSED_OPPORTUNITY_STAGES] } }],
  };
  const contractWhere: PrismaTypes.ContractWhereInput = {
    AND: [
      { deletedAt: null },
      { OR: [{ ownerId: actor.id, organizationUnitId: null }, ...(scope.organizationUnitOptions.length ? [{ organizationUnitId: { in: scope.organizationUnitOptions.map((unit) => unit.id) } }] : [])] },
      ownerFilter,
      organizationFilter,
      createdAt ? { createdAt } : {},
      filters.segment ? { customerId: { in: (await prisma.customer.findMany({ where: customerWhere, select: { id: true }, take: 10_000 })).map((item) => item.id) } } : {},
      selectedProduct ? { versions: { some: { items: { some: { productId: selectedProduct.id } } } } } : {},
    ],
  };
  const activityWhere: PrismaTypes.ActivityWhereInput = {
    AND: [
      buildActivityScopeWhere(actor.authorization),
      { deletedAt: null },
      ownerFilter,
      createdAt ? { createdAt } : {},
    ],
  };
  const incidentWhere: PrismaTypes.CustomerIncidentWhereInput = {
    AND: [
      { customer: buildCustomerScopeWhere(actor.authorization) },
      ownerFilter,
      organizationFilter,
      filters.segment ? { customer: { segment: filters.segment } } : {},
      createdAt ? { openedAt: createdAt } : {},
    ],
  };
  const approvalVisibility: PrismaTypes.ApprovalStepWhereInput = {
    OR: [
      { delegatedToActorId: actor.id },
      { requiredPermission: { in: [...grants] }, assignedRoleCode: null },
      { requiredPermission: { in: [...grants] }, assignedRoleCode: { in: roles } },
    ],
  };
  const approvalWhere: PrismaTypes.ApprovalStepWhereInput = {
    AND: [
      approvalVisibility,
      { status: ApprovalStepStatus.PENDING },
      { request: { status: { in: [...PENDING_APPROVAL_REQUESTS] }, quoteVersion: { quote: { opportunity: opportunityBaseWhere } } } },
    ],
  };

  const closedSolutionStatuses = await prisma.solutionStatusDefinition.findMany({
    where: { active: true, closed: true },
    select: { entityType: true, code: true },
  });
  const closedCodes = (entityType: string) => closedSolutionStatuses.filter((item) => item.entityType === entityType).map((item) => item.code);
  const horizon48h = new Date(now.getTime() + 48 * 60 * 60 * 1_000);
  const horizon30d = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1_000);
  const horizon90d = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1_000);
  const staleSince = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1_000);

  const [
    clock,
    prospects,
    leads,
    convertedLeads,
    customers,
    opportunities,
    wonCount,
    lostCount,
    wonRevenueRows,
    quoteCount,
    contractCount,
    pendingApprovals,
    overdueTasks,
    nearSlaTasks,
    expiringContracts,
    delayedOrders,
    openIncidents,
    slaRiskIncidents,
    targetRows,
    recentActivityRows,
    actionActivityRows,
    approvalRows,
    expiringContractRows,
    delayedOrderRows,
    incidentRows,
    segments,
    products,
  ] = await Promise.all([
    prisma.$queryRaw<Array<{ now: Date }>>`SELECT CURRENT_TIMESTAMP(3) AS now`,
    prisma.prospect.count({ where: prospectWhere }),
    prisma.lead.count({ where: { AND: [leadWhere, { status: { not: "ARCHIVED" } }] } }),
    prisma.lead.count({ where: { AND: [leadWhere, { status: "CONVERTED" }] } }),
    prisma.customer.count({ where: customerWhere }),
    prisma.opportunity.findMany({
      where: activeOpportunityWhere,
      select: {
        id: true, name: true, stage: true, estimatedValue: true, probability: true, forecastCategory: true,
        expectedCloseAt: true, stageEnteredAt: true, updatedAt: true,
        customer: { select: { id: true, name: true, segment: true } },
        owner: { select: { id: true, name: true } },
        primaryQuote: { select: { versions: { orderBy: { versionNumber: "desc" }, take: 1, select: { items: { select: { productId: true, productName: true, lineTotal: true } } } } } },
      },
      orderBy: [{ expectedCloseAt: "asc" }, { id: "asc" }],
      take: 10_000,
    }),
    prisma.opportunity.count({ where: { AND: [opportunityBaseWhere, { stage: OpportunityStage.WON }] } }),
    prisma.opportunity.count({ where: { AND: [opportunityBaseWhere, { stage: OpportunityStage.LOST }] } }),
    prisma.opportunity.findMany({ where: { AND: [opportunityBaseWhere, { stage: OpportunityStage.WON }] }, select: { estimatedValue: true }, take: 10_000 }),
    prisma.quote.count({ where: { opportunity: opportunityBaseWhere } }),
    prisma.contract.count({ where: contractWhere }),
    prisma.approvalStep.count({ where: approvalWhere }),
    prisma.activity.count({ where: { AND: [activityWhere, { completedAt: null, dueAt: { lt: now } }] } }),
    prisma.activity.count({ where: { AND: [activityWhere, { completedAt: null, dueAt: { gte: now, lte: horizon48h } }] } }),
    prisma.contract.count({ where: { AND: [contractWhere, { endDate: { gt: now, lte: horizon90d } }, { status: { terminal: false } }] } }),
    prisma.contractServiceOrder.count({ where: { contract: contractWhere, completedAt: null, targetCompletionAt: { lt: now } } }),
    prisma.customerIncident.count({ where: { AND: [incidentWhere, { resolvedAt: null }] } }),
    prisma.customerIncident.count({ where: { AND: [incidentWhere, { resolvedAt: null, slaDueAt: { lte: horizon48h } }] } }),
    prisma.salesTarget.findMany({
      where: {
        AND: [
          buildSalesTargetScopeWhere(actor.authorization),
          { status: SalesTargetStatus.ACTIVE },
          scope.ownerId ? { userId: scope.ownerId } : {},
          scope.organizationUnitIds ? { OR: [{ teamId: { in: scope.organizationUnitIds } }, { departmentId: { in: scope.organizationUnitIds } }, { businessUnitId: { in: scope.organizationUnitIds } }] } : {},
          filters.segment ? { customerSegment: filters.segment } : {},
          selectedProduct ? { productCategoryId: selectedProduct.id } : {},
          to ? { effectiveFrom: { lte: to } } : {},
          from ? { OR: [{ effectiveTo: null }, { effectiveTo: { gte: from } }] } : {},
        ],
      },
      select: { targetAmount: true },
      take: 10_000,
    }),
    prisma.activity.findMany({ where: activityWhere, select: { id: true, subject: true, statusCode: true, updatedAt: true, dueAt: true, opportunityId: true, customerId: true }, orderBy: { updatedAt: "desc" }, take: 8 }),
    prisma.activity.findMany({ where: { AND: [activityWhere, { completedAt: null, dueAt: { lte: horizon48h } }] }, select: { id: true, subject: true, statusCode: true, updatedAt: true, dueAt: true, opportunityId: true, customerId: true }, orderBy: { dueAt: "asc" }, take: 8 }),
    prisma.approvalStep.findMany({ where: approvalWhere, select: { id: true, stepCode: true, dueAt: true, request: { select: { id: true, submittedAt: true, quoteVersion: { select: { quote: { select: { quoteNo: true } } } } } } }, orderBy: { dueAt: "asc" }, take: 8 }),
    prisma.contract.findMany({ where: { AND: [contractWhere, { endDate: { gt: now, lte: horizon90d } }, { status: { terminal: false } }] }, select: { id: true, contractNo: true, name: true, endDate: true }, orderBy: { endDate: "asc" }, take: 8 }),
    prisma.contractServiceOrder.findMany({ where: { contract: contractWhere, completedAt: null, targetCompletionAt: { lt: now } }, select: { id: true, orderNo: true, status: true, targetCompletionAt: true, contractId: true }, orderBy: { targetCompletionAt: "asc" }, take: 8 }),
    prisma.customerIncident.findMany({ where: { AND: [incidentWhere, { resolvedAt: null }] }, select: { id: true, incidentNo: true, title: true, slaDueAt: true, customerId: true, severityCode: true, updatedAt: true }, orderBy: [{ slaDueAt: "asc" }, { updatedAt: "desc" }], take: 8 }),
    prisma.customer.groupBy({ where: buildCustomerScopeWhere(actor.authorization), by: ["segment"], orderBy: { segment: "asc" } }),
    prisma.product.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: "asc" }, take: 500 }),
  ]);

  const pipelineValue = sumMoney(opportunities, (row) => row.estimatedValue);
  const weightedForecast = opportunities.reduce(
    (total, row) => total.plus(row.estimatedValue.mul(row.probability).div(100)),
    MONEY_ZERO,
  );
  const committed = sumMoney(opportunities.filter((row) => row.forecastCategory === "COMMIT"), (row) => row.estimatedValue);
  const bestCase = sumMoney(opportunities.filter((row) => row.forecastCategory === "BEST_CASE"), (row) => row.estimatedValue);
  const wonRevenue = sumMoney(wonRevenueRows, (row) => row.estimatedValue);
  const revenueTarget = sumMoney(targetRows, (row) => row.targetAmount);
  const targetGap = revenueTarget.minus(wonRevenue.plus(committed));
  const conversionRate = leads ? Math.round((convertedLeads / leads) * 1000) / 10 : 0;
  const winLossTotal = wonCount + lostCount;
  const winRate = winLossTotal ? Math.round((wonCount / winLossTotal) * 1000) / 10 : 0;
  const lossRate = winLossTotal ? Math.round((lostCount / winLossTotal) * 1000) / 10 : 0;

  const stageMap = new Map<string, { count: number; value: Prisma.Decimal }>();
  const segmentMap = new Map<string, { count: number; value: Prisma.Decimal }>();
  const ownerMap = new Map<string, { count: number; value: Prisma.Decimal }>();
  const monthMap = new Map<string, { count: number; value: Prisma.Decimal }>();
  const productMap = new Map<string, { count: number; value: Prisma.Decimal }>();
  for (const opportunity of opportunities) {
    addChartPoint(stageMap, opportunity.stage, opportunity.estimatedValue);
    addChartPoint(segmentMap, opportunity.customer.segment || "ไม่ระบุ Segment", opportunity.estimatedValue);
    addChartPoint(ownerMap, opportunity.owner.name, opportunity.estimatedValue);
    const month = opportunity.expectedCloseAt
      ? new Intl.DateTimeFormat("th-TH", { timeZone: "Asia/Bangkok", year: "numeric", month: "short" }).format(opportunity.expectedCloseAt)
      : "ไม่ระบุเดือนปิด";
    addChartPoint(monthMap, month, opportunity.estimatedValue);
    const quoteItems = opportunity.primaryQuote?.versions[0]?.items ?? [];
    if (quoteItems.length) {
      for (const item of quoteItems) addChartPoint(productMap, item.productName, item.lineTotal);
    } else {
      addChartPoint(productMap, "ยังไม่ระบุ Product", opportunity.estimatedValue);
    }
  }

  const recentActivities: DashboardActionItem[] = recentActivityRows.map((item) => ({
    id: `activity:${item.id}`,
    title: item.subject,
    description: `Activity · ${item.statusCode}`,
    href: `/activities/${item.id}`,
    occurredAt: item.updatedAt.toISOString(),
    tone: item.dueAt && item.dueAt < now ? "warning" : "info",
    source: "Activity",
  }));
  const activityActions: DashboardActionItem[] = actionActivityRows.map((item) => ({
    id: `activity-action:${item.id}`,
    title: item.dueAt && item.dueAt < now ? "งานเกินกำหนด" : "งานใกล้ครบ SLA",
    description: item.subject,
    href: `/activities/${item.id}`,
    occurredAt: (item.dueAt ?? item.updatedAt).toISOString(),
    tone: item.dueAt && item.dueAt < now ? "critical" : "warning",
    source: "Activity",
  }));
  const approvalActions: DashboardActionItem[] = approvalRows.map((item) => ({
    id: `approval:${item.id}`,
    title: `รออนุมัติ ${item.stepCode}`,
    description: item.request.quoteVersion.quote.quoteNo,
    href: `/approvals/${item.request.id}`,
    occurredAt: (item.dueAt ?? item.request.submittedAt).toISOString(),
    tone: item.dueAt && item.dueAt < now ? "critical" : "warning",
    source: "Approval",
  }));
  const contractActions: DashboardActionItem[] = expiringContractRows.map((item) => ({
    id: `contract:${item.id}`,
    title: `สัญญาใกล้หมดอายุ ${item.contractNo}`,
    description: item.name,
    href: `/contracts/${item.id}`,
    occurredAt: (item.endDate ?? now).toISOString(),
    tone: "warning",
    source: "Contract",
  }));
  const orderActions: DashboardActionItem[] = delayedOrderRows.map((item) => ({
    id: `service-order:${item.id}`,
    title: `Order ล่าช้า ${item.orderNo}`,
    description: item.status,
    href: `/contracts/${item.contractId}`,
    occurredAt: (item.targetCompletionAt ?? now).toISOString(),
    tone: "critical",
    source: "Service Order",
  }));
  const incidentActions: DashboardActionItem[] = incidentRows.map((item) => ({
    id: `incident:${item.id}`,
    title: `${item.incidentNo} · ${item.title}`,
    description: `Severity ${item.severityCode}`,
    href: `/customers/${item.customerId}`,
    occurredAt: (item.slaDueAt ?? item.updatedAt).toISOString(),
    tone: item.slaDueAt && item.slaDueAt <= horizon48h ? "critical" : "warning",
    source: "Customer Incident",
  }));
  const actions = [...activityActions, ...approvalActions, ...contractActions, ...orderActions, ...incidentActions]
    .sort((left, right) => left.occurredAt.localeCompare(right.occurredAt))
    .slice(0, 12);
  const notifications = [...approvalActions, ...contractActions, ...incidentActions].slice(0, 10);

  const riskOpportunities = opportunities.filter((row) =>
    (row.expectedCloseAt !== null && row.expectedCloseAt < now) || row.stageEnteredAt < staleSince,
  );
  const ownOpportunities = opportunities.filter((row) => row.owner.id === actor.id);
  const closingSoon = ownOpportunities.filter((row) => row.expectedCloseAt && row.expectedCloseAt >= now && row.expectedCloseAt <= horizon30d);
  const ownPipeline = sumMoney(ownOpportunities, (row) => row.estimatedValue);

  const roleFocusPromises: Array<Promise<DashboardRoleFocus> | DashboardRoleFocus> = [];
  if (sections.includes("executive")) roleFocusPromises.push({
    section: "executive",
    title: "Executive Overview",
    description: "Forecast, revenue, conversion และโครงการที่ต้องบริหารความเสี่ยง",
    metrics: [
      metric("executive-forecast", "Weighted Forecast", moneyString(weightedForecast), "money", `${opportunities.length} opportunities`, "/pipeline"),
      metric("executive-gap", "Gap to Target", moneyString(targetGap), "money", "Target − (Revenue + Commit)", "/pipeline", targetGap.gt(0) ? "warning" : "positive"),
      metric("executive-revenue", "Won Revenue", moneyString(wonRevenue), "money", `${wonCount} won`, "/opportunities?stage=WON", "positive"),
      metric("executive-risk", "Risk Projects", riskOpportunities.length, "count", "Past close date or stale stage", "/opportunities?risk=1", riskOpportunities.length ? "critical" : "positive"),
    ],
    items: riskOpportunities.slice(0, 5).map((row) => ({ id: `risk:${row.id}`, title: row.name, description: `${row.stage} · ${row.customer.name}`, href: `/opportunities/${row.id}`, occurredAt: row.updatedAt.toISOString(), tone: "warning", source: "Opportunity" })),
  });
  if (sections.includes("sales")) roleFocusPromises.push((async () => {
    const dormantCustomers = await prisma.customer.count({
      where: { AND: [customerWhere, { ownerId: actor.id }, { activities: { none: { deletedAt: null, updatedAt: { gte: staleSince } } } }] },
    });
    return {
      section: "sales",
      title: "My Sales Workspace",
      description: "Pipeline ส่วนตัว งานติดตาม ลูกค้าเงียบ และดีลที่กำลังจะปิด",
      metrics: [
        metric("sales-pipeline", "My Pipeline", moneyString(ownPipeline), "money", `${ownOpportunities.length} opportunities`, filterUrl("/opportunities", { ownerId: actor.id })),
        metric("sales-followup", "Follow-up / SLA", activityActions.length, "count", "Due within 48 hours", "/activities?due=1", activityActions.length ? "warning" : "positive"),
        metric("sales-dormant", "No Activity 30d", dormantCustomers, "count", "Owned customers", "/customers?activity=stale", dormantCustomers ? "warning" : "positive"),
        metric("sales-closing", "Closing ≤ 30d", closingSoon.length, "count", "Expected close date", "/opportunities?closing=30"),
      ],
      items: closingSoon.slice(0, 5).map((row) => ({ id: `closing:${row.id}`, title: row.name, description: `${row.stage} · ${row.customer.name}`, href: `/opportunities/${row.id}`, occurredAt: (row.expectedCloseAt ?? row.updatedAt).toISOString(), tone: "info", source: "Opportunity" })),
    };
  })());
  if (sections.includes("salesManager")) roleFocusPromises.push({
    section: "salesManager",
    title: "Team Performance",
    description: "ผลงานทีม, Pipeline Coverage, งานอนุมัติ และคุณภาพ Forecast",
    metrics: [
      metric("manager-pipeline", "Team Pipeline", moneyString(pipelineValue), "money", `${ownerMap.size} owners`, "/pipeline"),
      metric("manager-coverage", "Pipeline Coverage", revenueTarget.gt(0) ? pipelineValue.div(revenueTarget).mul(100).toDecimalPlaces(1).toString() : "0", "percent", "Pipeline ÷ Target", "/pipeline"),
      metric("manager-approval", "Approval Pending", pendingApprovals, "count", "Scoped actionable steps", "/approvals", pendingApprovals ? "warning" : "positive"),
      metric("manager-accuracy", "Forecast Readiness", opportunities.length ? Math.round((opportunities.filter((row) => row.expectedCloseAt).length / opportunities.length) * 100) : 0, "percent", "Opportunities with close date", "/forecasts/quality"),
    ],
    items: chartPoints(ownerMap, () => "/opportunities").slice(0, 5).map((row) => ({ id: `owner:${row.key}`, title: row.label, description: `${row.count} opportunities · ${row.value} THB`, href: row.href, occurredAt: clock[0]?.now.toISOString() ?? now.toISOString(), tone: "info", source: "Team" })),
  });
  if (sections.includes("solution")) roleFocusPromises.push((async () => {
    const [designs, surveys, boqs, designRows] = await Promise.all([
      prisma.solutionDesign.count({ where: { opportunity: opportunityBaseWhere, statusCode: { notIn: closedCodes("SOLUTION_DESIGN") } } }),
      prisma.siteSurveyRequest.count({ where: { opportunity: opportunityBaseWhere, statusCode: { notIn: closedCodes("SITE_SURVEY") } } }),
      prisma.boqHeader.count({ where: { opportunity: opportunityBaseWhere, statusCode: { notIn: closedCodes("BOQ") } } }),
      prisma.solutionDesign.findMany({ where: { opportunity: opportunityBaseWhere, statusCode: { notIn: closedCodes("SOLUTION_DESIGN") } }, select: { id: true, solutionDesignName: true, statusCode: true, targetDesignDate: true, updatedAt: true }, orderBy: { updatedAt: "desc" }, take: 5 }),
    ]);
    return {
      section: "solution",
      title: "Solution & Engineering Queue",
      description: "Solution Design, Site Survey และ BOQ ที่รอดำเนินการ",
      metrics: [
        metric("solution-design", "Solution Design", designs, "count", "Open workflow", "/solution-designs"),
        metric("solution-survey", "Site Survey", surveys, "count", "Open workflow", "/site-surveys"),
        metric("solution-boq", "BOQ", boqs, "count", "Open workflow", "/boqs"),
        metric("solution-overdue", "SLA Work", overdueTasks + nearSlaTasks, "count", "Overdue or due ≤ 48h", "/activities?due=1", overdueTasks ? "critical" : "warning"),
      ],
      items: designRows.map((row) => ({ id: `design:${row.id}`, title: row.solutionDesignName ?? "Solution Design", description: row.statusCode, href: `/solution-designs/${row.id}`, occurredAt: (row.targetDesignDate ?? row.updatedAt).toISOString(), tone: row.targetDesignDate && row.targetDesignDate < now ? "warning" : "info", source: "Solution Design" })),
    };
  })());
  if (sections.includes("approver")) roleFocusPromises.push({
    section: "approver",
    title: "Approval Center",
    description: "Quotation, Pricing, Discount และ Contract ที่รอการตัดสินใจ",
    metrics: [
      metric("approver-pending", "Pending Decisions", pendingApprovals, "count", "Matched role and permission", "/approvals", pendingApprovals ? "warning" : "positive"),
      metric("approver-overdue", "Past Due", approvalRows.filter((row) => row.dueAt && row.dueAt < now).length, "count", "Approval SLA", "/approvals?overdue=1", "critical"),
      metric("approver-quotes", "Quotation Scope", quoteCount, "count", "Filtered source records", "/quotes"),
      metric("approver-contract", "Contracts Expiring", expiringContracts, "count", "Within 90 days", "/contracts?expiring=90", expiringContracts ? "warning" : "positive"),
    ],
    items: approvalActions,
  });
  if (sections.includes("operations")) roleFocusPromises.push((async () => {
    const [orders, installPending, testPending, handoverPending] = await Promise.all([
      prisma.contractServiceOrder.count({ where: { contract: contractWhere, completedAt: null } }),
      prisma.contractServiceOrder.count({ where: { contract: contractWhere, completedAt: null, installationCompletedAt: null } }),
      prisma.contractServiceOrder.count({ where: { contract: contractWhere, completedAt: null, installationCompletedAt: { not: null }, testingCompletedAt: null } }),
      prisma.contractServiceOrder.count({ where: { contract: contractWhere, completedAt: null, testingCompletedAt: { not: null }, handoverCompletedAt: null } }),
    ]);
    return {
      section: "operations",
      title: "Provisioning & Operations",
      description: "Order, Installation, Testing และ Handover ตาม milestone จริง",
      metrics: [
        metric("operations-orders", "Open Orders", orders, "count", "Not completed", "/contracts?tab=orders"),
        metric("operations-install", "Installation", installPending, "count", "Pending milestone", "/contracts?milestone=installation"),
        metric("operations-test", "Testing", testPending, "count", "Pending milestone", "/contracts?milestone=testing"),
        metric("operations-handover", "Handover", handoverPending, "count", `${delayedOrders} delayed`, "/contracts?milestone=handover", delayedOrders ? "critical" : "default"),
      ],
      items: orderActions,
    };
  })());
  if (sections.includes("customerSuccess")) roleFocusPromises.push({
    section: "customerSuccess",
    title: "Customer Success & SLA",
    description: "Incident, SLA risk, Customer Health และ Contract Renewal",
    metrics: [
      metric("cs-incidents", "Open Incidents", openIncidents, "count", "Unresolved incidents", "/customers?tab=incidents", openIncidents ? "warning" : "positive"),
      metric("cs-sla", "SLA Risk", slaRiskIncidents, "count", "Due within 48 hours", "/customers?sla=risk", slaRiskIncidents ? "critical" : "positive"),
      metric("cs-health", "Healthy Customers", Math.max(0, customers - openIncidents), "count", "No open incident signal", "/customers?health=healthy", "positive"),
      metric("cs-renewal", "Renewal ≤ 90d", expiringContracts, "count", "Active contracts", "/contracts?expiring=90", expiringContracts ? "warning" : "positive"),
    ],
    items: [...incidentActions, ...contractActions].slice(0, 8),
  });
  if (sections.includes("admin")) roleFocusPromises.push((async () => {
    const since30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1_000);
    const [activeUsers, activeUsers30d, integrationErrors, auditEvents, adminItems] = await Promise.all([
      prisma.user.count({ where: { active: true } }),
      prisma.loginEvent.groupBy({ by: ["userId"], where: { outcome: "SUCCESS", occurredAt: { gte: since30d }, userId: { not: null } } }),
      prisma.siteSurveyIntegrationLog.count({ where: { errorCode: { not: null }, createdAt: { gte: since30d } } }),
      prisma.auditEvent.count({ where: { recordedAt: { gte: since30d } } }),
      prisma.auditEvent.findMany({ select: { id: true, action: true, targetType: true, targetId: true, outcome: true, recordedAt: true }, orderBy: { sequence: "desc" }, take: 5 }),
    ]);
    return {
      section: "admin",
      title: "Administration & Reliability",
      description: "ผู้ใช้ การใช้งาน Integration Error และ Audit Events",
      metrics: [
        metric("admin-users", "Active Users", activeUsers, "count", "Enabled accounts", "/admin/users"),
        metric("admin-usage", "Active 30d", activeUsers30d.length, "count", "Unique successful logins", "/admin/audit"),
        metric("admin-integration", "Integration Errors", integrationErrors, "count", "Last 30 days", "/admin/audit?type=integration", integrationErrors ? "critical" : "positive"),
        metric("admin-audit", "Audit Events", auditEvents, "count", "Last 30 days", "/admin/audit"),
      ],
      items: adminItems.map((item) => ({ id: `audit:${item.id}`, title: item.action, description: `${item.targetType} · ${item.outcome}`, href: "/admin/audit", occurredAt: item.recordedAt.toISOString(), tone: item.outcome === "SUCCESS" ? "info" : "warning", source: "Audit" })),
    };
  })());
  const roleFocus = await Promise.all(roleFocusPromises);

  const kpis = [
    metric("prospects", "Prospect", prospects, "count", "องค์กรเป้าหมายในขอบเขต", "/prospects"),
    metric("leads", "Lead", leads, "count", `${convertedLeads} converted`, "/leads"),
    metric("opportunities", "Opportunity", opportunities.length, "count", "Active pipeline", "/opportunities"),
    metric("customers", "Customer", customers, "count", "Active source records", "/customers"),
    metric("pipeline", "Total Pipeline", moneyString(pipelineValue), "money", `${opportunities.length} opportunities`, "/pipeline"),
    metric("weighted", "Weighted Forecast", moneyString(weightedForecast), "money", "Value × probability", "/pipeline"),
    metric("commit", "Commit / Best Case", moneyString(committed.plus(bestCase)), "money", `${moneyString(committed)} / ${moneyString(bestCase)}`, "/pipeline"),
    metric("target", "Revenue Target", moneyString(revenueTarget), "money", `Gap ${moneyString(targetGap)}`, "/pipeline", targetGap.gt(0) ? "warning" : "positive"),
    metric("approvals", "รออนุมัติ", pendingApprovals, "count", "Actionable by your grants", "/approvals", pendingApprovals ? "warning" : "positive"),
    metric("sla-work", "งานค้าง / ใกล้ SLA", overdueTasks + nearSlaTasks, "count", `${overdueTasks} overdue · ${nearSlaTasks} near SLA`, "/activities?due=1", overdueTasks ? "critical" : "default"),
    metric("contracts", "Contract ใกล้หมด", expiringContracts, "count", "Within 90 days", "/contracts?expiring=90", expiringContracts ? "warning" : "positive"),
    metric("operations", "Order ล่าช้า", delayedOrders, "count", "Past target completion", "/contracts?tab=orders", delayedOrders ? "critical" : "positive"),
    metric("incidents", "Incident / SLA Risk", openIncidents, "count", `${slaRiskIncidents} at SLA risk`, "/customers?tab=incidents", slaRiskIncidents ? "critical" : "default"),
  ];
  const funnel = [
    { key: "prospect", label: "Prospect", count: prospects, value: "0.0000", href: "/prospects" },
    { key: "lead", label: "Lead", count: leads, value: "0.0000", href: "/leads" },
    { key: "opportunity", label: "Opportunity", count: opportunities.length + wonCount + lostCount, value: moneyString(pipelineValue.plus(wonRevenue)), href: "/opportunities" },
    { key: "quotation", label: "Quotation", count: quoteCount, value: "0.0000", href: "/quotes" },
    { key: "contract", label: "Contract", count: contractCount, value: "0.0000", href: "/contracts" },
    { key: "customer", label: "Customer", count: customers, value: "0.0000", href: "/customers" },
  ];

  return {
    filters,
    permissions: { sections, canExport: grants.has("dashboard.export") },
    scopeLabel: scope.scopeLabel,
    updatedAt: (clock[0]?.now ?? now).toISOString(),
    options: {
      departments: scope.organizationUnitOptions.filter((unit) => unit.parentId === null).map(({ id, name }) => ({ id, name })),
      teams: scope.organizationUnitOptions.map(({ id, name, parentId }) => ({ id, name, parentId })),
      owners: scope.ownerOptions,
      segments: segments.map((item) => item.segment),
      products,
      statuses: Object.values(OpportunityStage),
    },
    kpis,
    funnel,
    charts: {
      stage: chartPoints(stageMap, (key) => filterUrl("/opportunities", { stage: key })),
      segment: chartPoints(segmentMap, (key) => filterUrl("/opportunities", { segment: key })),
      product: chartPoints(productMap, () => "/opportunities"),
      owner: chartPoints(ownerMap, () => "/opportunities"),
      month: chartPoints(monthMap, () => "/opportunities"),
    },
    conversion: { leadToOpportunity: conversionRate, winRate, lossRate },
    recentActivities,
    notifications,
    actions,
    roleFocus,
    isEmpty: prospects + leads + customers + opportunities.length + contractCount === 0,
  };
}
