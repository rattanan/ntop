import { createHash } from "node:crypto";

import type { Role } from "@prisma/client";

import type { AuditWriter } from "../audit/audit-writer";
import type { AuthorizationContext } from "../authorization/authorization-context";
import {
  assertPermission,
  PERMISSIONS,
  type PermissionPolicy,
  permissionPolicy,
} from "../authorization/permission-policy";
import {
  evaluateApprovalPolicy,
  type ApprovalPolicyDefinition,
  type ApprovalPolicyInput,
} from "./approval-policy-evaluator";
import { calculateQuote } from "./quote-calculator";
import { decimal, money } from "./decimal-money";

export type QuoteDraftInput = {
  quoteId?: string;
  proposalId?: string;
  opportunityId: string;
  currency: string;
  validUntil?: Date | null;
  notes?: string;
  items: Array<{
    productId: string;
    quantity: string;
    unitPrice?: string;
    discountAmount?: string;
    discountPct?: string;
  }>;
};

export type ProductCommercialFact = {
  id: string;
  code: string;
  name: string;
  category: string;
  listPrice: string;
  floorPrice: string | null;
  standardCost: string | null;
  costConfirmed: boolean;
};

export type QuoteVersionRecord = {
  id: string;
  quoteId: string;
  versionNumber: number;
  status: "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED" | "RETURNED" | "SENT" | "ACCEPTED" | "SUPERSEDED";
  makerId: string;
  opportunityId: string;
  customerId: string;
  customerSegment: string;
  coverageConfirmed: boolean;
  solutionComplete: boolean;
  opportunityRisk: string;
  total: string;
  discountPct: string;
  grossMarginPct: string;
  productCategories: string[];
  costConfirmed: boolean;
  nonStandardTerms: boolean;
};

export type ActiveApprovalPolicy = {
  id: string;
  definition: ApprovalPolicyDefinition;
};

export interface QuoteRepository<TTransaction> {
  transaction<T>(work: (transaction: TTransaction) => Promise<T>): Promise<T>;
  findReceipt(actorId: string, key: string, command: string, transaction: TTransaction): Promise<{ targetId: string; resultVersion: number | null } | null>;
  saveReceipt(input: { actorId: string; idempotencyKey: string; command: string; targetId: string; resultVersion: number | null }, transaction: TTransaction): Promise<void>;
  findOpportunity(input: { id: string; context: AuthorizationContext }, transaction: TTransaction): Promise<{ id: string; customerId: string; customerSegment: string; coverageConfirmed: boolean; solutionComplete: boolean; opportunityRisk: string } | null>;
  findQuote(input: { id: string; context: AuthorizationContext }, transaction: TTransaction): Promise<{ id: string; opportunityId: string; proposalId: string | null; makerId: string; latestVersion: number } | null>;
  findProposal?(input: { id: string; context: AuthorizationContext }, transaction: TTransaction): Promise<{ id: string; opportunityId: string; customerId: string } | null>;
  loadProducts(ids: readonly string[], transaction: TTransaction): Promise<ProductCommercialFact[]>;
  createVersion(input: { actorId: string; draft: QuoteDraftInput; opportunity: { id: string; customerId: string; customerSegment: string }; calculations: ReturnType<typeof calculateQuote>; products: ProductCommercialFact[]; versionNumber: number }, transaction: TTransaction): Promise<QuoteVersionRecord>;
  findVersion(input: { id: string; context: AuthorizationContext }, transaction: TTransaction): Promise<QuoteVersionRecord | null>;
  activeApprovalPolicy(transaction: TTransaction): Promise<ActiveApprovalPolicy | null>;
  submitVersion(input: { version: QuoteVersionRecord; policyVersionId: string; policyInput: ApprovalPolicyInput; matchedRuleCodes: string[]; steps: ReturnType<typeof evaluateApprovalPolicy>["steps"]; quoteVersionHash: string; submittedAt: Date }, transaction: TTransaction): Promise<{ requestId: string }>;
}

type Actor = { id: string; role: Role; authorization: AuthorizationContext };

export class QuoteAccessError extends Error {
  constructor() { super("Quote is unavailable."); this.name = "QuoteAccessError"; }
}
export class QuoteVersionImmutableError extends Error {
  constructor() { super("Submitted Quote versions are immutable."); this.name = "QuoteVersionImmutableError"; }
}
export class QuoteSubmissionGateError extends Error {
  constructor(readonly missingGates: readonly string[]) { super("Quote submission gates are incomplete."); this.name = "QuoteSubmissionGateError"; }
}
export class QuoteFloorPriceError extends Error {
  constructor(readonly violations: Array<{ productId: string; floorPrice: string; effectiveUnitPrice: string }>) { super("Quote line is below the configured floor price."); this.name = "QuoteFloorPriceError"; }
}
export class ApprovalPolicyUnavailableError extends Error {
  constructor() { super("Approval policy is unavailable."); this.name = "ApprovalPolicyUnavailableError"; }
}

function stableHashPayload(value: unknown) {
  const normalize = (item: unknown): unknown => {
    if (Array.isArray(item)) return item.map(normalize);
    if (item !== null && typeof item === "object") {
      if ("toFixed" in item && typeof (item as { toFixed?: unknown }).toFixed === "function") {
        return String(item);
      }
      return Object.fromEntries(Object.entries(item as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, nested]) => [key, normalize(nested)]));
    }
    return item;
  };
  return JSON.stringify(normalize(value));
}

export class QuoteService<TTransaction> {
  constructor(
    private readonly repository: QuoteRepository<TTransaction>,
    private readonly auditWriter: AuditWriter<TTransaction>,
    private readonly permissions: PermissionPolicy = permissionPolicy,
    private readonly now: () => Date = () => new Date(),
    private readonly hash: (value: string) => string = (value) =>
      createHash("sha256").update(value).digest("hex"),
  ) {}

  async createVersion(actor: Actor, draft: QuoteDraftInput, correlationId: string, idempotencyKey: string) {
    assertPermission(actor, PERMISSIONS.quoteManage, this.permissions);
    return this.repository.transaction(async (transaction) => {
      const receipt = await this.repository.findReceipt(actor.id, idempotencyKey, "quote.version.create", transaction);
      if (receipt) {
        const version = await this.repository.findVersion({ id: receipt.targetId, context: actor.authorization }, transaction);
        if (!version) throw new QuoteAccessError();
        return version;
      }
      const opportunity = await this.repository.findOpportunity({ id: draft.opportunityId, context: actor.authorization }, transaction);
      if (!opportunity) throw new QuoteAccessError();
      const proposal = draft.proposalId
        ? await this.repository.findProposal?.({ id: draft.proposalId, context: actor.authorization }, transaction)
        : null;
      if (draft.proposalId && (!proposal || proposal.opportunityId !== opportunity.id || proposal.customerId !== opportunity.customerId)) throw new QuoteAccessError();
      const quote = draft.quoteId
        ? await this.repository.findQuote({ id: draft.quoteId, context: actor.authorization }, transaction)
        : null;
      if (draft.quoteId && (!quote || quote.opportunityId !== draft.opportunityId)) throw new QuoteAccessError();
      if (quote?.proposalId && draft.proposalId && quote.proposalId !== draft.proposalId) throw new QuoteAccessError();
      const products = await this.repository.loadProducts([...new Set(draft.items.map((item) => item.productId))], transaction);
      if (products.length !== new Set(draft.items.map((item) => item.productId)).size) throw new QuoteAccessError();
      const productMap = new Map(products.map((product) => [product.id, product]));
      const calculations = calculateQuote(draft.items.map((item) => {
        const product = productMap.get(item.productId);
        if (!product) throw new QuoteAccessError();
        const unitPrice = item.unitPrice ?? product.listPrice;
        return {
          productId: product.id,
          productCode: product.code,
          productName: product.name,
          quantity: item.quantity,
          unitPrice,
          discountAmount: item.discountAmount ?? (item.discountPct
            ? money(decimal(unitPrice).mul(decimal(item.quantity)).mul(decimal(item.discountPct)).div(100))
            : "0"),
          unitCost: product.standardCost ?? "0",
        };
      }));
      const floorViolations = calculations.lines.flatMap((line) => {
        const product = productMap.get(line.productId);
        if (!product?.floorPrice) return [];
        const effectiveUnitPrice = money(line.lineTotal.div(line.quantity));
        return effectiveUnitPrice.lt(decimal(product.floorPrice))
          ? [{ productId: product.id, floorPrice: money(product.floorPrice).toFixed(4), effectiveUnitPrice: effectiveUnitPrice.toFixed(4) }]
          : [];
      });
      if (floorViolations.length) throw new QuoteFloorPriceError(floorViolations);
      const created = await this.repository.createVersion({
        actorId: actor.id,
        draft,
        opportunity,
        calculations,
        products,
        versionNumber: (quote?.latestVersion ?? 0) + 1,
      }, transaction);
      await this.auditWriter.append({
        actorId: actor.id,
        action: "quote.version.create",
        targetType: "QuoteVersion",
        targetId: created.id,
        targetVersion: String(created.versionNumber),
        outcome: "SUCCESS",
        correlationId,
        data: { quoteId: created.quoteId, opportunityId: created.opportunityId, proposalId: draft.proposalId ?? quote?.proposalId ?? null },
      }, { transaction });
      await this.repository.saveReceipt({ actorId: actor.id, idempotencyKey, command: "quote.version.create", targetId: created.id, resultVersion: created.versionNumber }, transaction);
      return created;
    });
  }

  async submit(actor: Actor, quoteVersionId: string, correlationId: string, idempotencyKey: string) {
    assertPermission(actor, PERMISSIONS.quoteSubmit, this.permissions);
    return this.repository.transaction(async (transaction) => {
      const receipt = await this.repository.findReceipt(actor.id, idempotencyKey, "quote.version.submit", transaction);
      if (receipt) return { requestId: receipt.targetId };
      const version = await this.repository.findVersion({ id: quoteVersionId, context: actor.authorization }, transaction);
      if (!version) throw new QuoteAccessError();
      if (version.status !== "DRAFT") throw new QuoteVersionImmutableError();
      const policy = await this.repository.activeApprovalPolicy(transaction);
      if (!policy) throw new ApprovalPolicyUnavailableError();
      const gates = policy.definition.submissionGates ?? {};
      const missing = [
        ...(gates.coverageRequired && !version.coverageConfirmed ? ["coverageConfirmed"] : []),
        ...(gates.solutionRequired && !version.solutionComplete ? ["solutionComplete"] : []),
        ...(gates.confirmedCostRequired && !version.costConfirmed ? ["costConfirmed"] : []),
      ];
      if (missing.length) throw new QuoteSubmissionGateError(missing);
      const input: ApprovalPolicyInput = {
        total: version.total,
        discountPct: version.discountPct,
        grossMarginPct: version.grossMarginPct,
        customerSegment: version.customerSegment,
        productCategories: version.productCategories,
        nonStandardTerms: version.nonStandardTerms,
        coverageConfirmed: version.coverageConfirmed,
        costConfirmed: version.costConfirmed,
        opportunityRisk: version.opportunityRisk,
      };
      const route = evaluateApprovalPolicy(policy.definition, input);
      if (!route.steps.length) throw new ApprovalPolicyUnavailableError();
      const submittedAt = this.now();
      const quoteVersionHash = this.hash(stableHashPayload({ quoteVersionId, version: version.versionNumber, input }));
      const result = await this.repository.submitVersion({ version, policyVersionId: policy.id, policyInput: input, matchedRuleCodes: route.matchedRuleCodes, steps: route.steps, quoteVersionHash, submittedAt }, transaction);
      await this.auditWriter.append({
        actorId: actor.id,
        action: "quote.submit",
        targetType: "QuoteVersion",
        targetId: quoteVersionId,
        targetVersion: String(version.versionNumber),
        outcome: "SUCCESS",
        correlationId,
        data: { approvalRequestId: result.requestId, policyVersionId: policy.id, quoteVersionHash },
      }, { transaction });
      await this.repository.saveReceipt({ actorId: actor.id, idempotencyKey, command: "quote.version.submit", targetId: result.requestId, resultVersion: 1 }, transaction);
      return result;
    });
  }
}
