export const LEAD_TRANSITIONS = {
  NEW: ["ASSIGNED", "INVALID", "DUPLICATE", "NOT_INTERESTED", "NO_BUDGET", "ARCHIVED"],
  ASSIGNED: ["CONTACTED", "INVALID", "DUPLICATE", "NOT_INTERESTED", "NO_BUDGET", "ARCHIVED"],
  CONTACTED: ["NURTURING", "QUALIFIED", "DISQUALIFIED", "INVALID", "DUPLICATE", "NOT_INTERESTED", "NO_BUDGET", "ARCHIVED"],
  NURTURING: ["CONTACTED", "QUALIFIED", "DISQUALIFIED", "INVALID", "DUPLICATE", "NOT_INTERESTED", "NO_BUDGET", "ARCHIVED"],
  QUALIFIED: ["NURTURING", "DISQUALIFIED", "INVALID", "DUPLICATE", "NOT_INTERESTED", "NO_BUDGET", "ARCHIVED"],
  DISQUALIFIED: ["NURTURING", "ARCHIVED"],
  INVALID: ["NURTURING", "ARCHIVED"],
  DUPLICATE: ["ARCHIVED"],
  NOT_INTERESTED: ["NURTURING", "ARCHIVED"],
  NO_BUDGET: ["NURTURING", "ARCHIVED"],
  CONVERTED: [],
  ARCHIVED: [],
} as const;

export type WorkflowStatus = keyof typeof LEAD_TRANSITIONS;

export function canTransition(from: WorkflowStatus, to: WorkflowStatus) {
  return from === to || (LEAD_TRANSITIONS[from] as readonly string[]).includes(to);
}

export type ScoringFacts = {
  taxId?: string | null; email?: string | null; estimatedBudget?: string | null;
  expectedPurchaseAt?: Date | null; decisionMakerKnown?: boolean; strategicProduct?: boolean;
  numberOfSites?: number | null; failedContactAttempts?: number; lastActivityAt?: Date | null;
};

export const DEFAULT_SCORE_WEIGHTS = {
  taxId: 10, corporateEmail: 10, budget: 15, purchaseWithinSixMonths: 15,
  decisionMaker: 15, strategicProduct: 10, multipleSites: 10,
  unreachable: -20, inactive: -10,
} as const;

export function calculateLeadScore(facts: ScoringFacts, now = new Date(), weights = DEFAULT_SCORE_WEIGHTS) {
  const breakdown: Array<{ rule: keyof typeof weights; points: number }> = [];
  const add = (rule: keyof typeof weights, applies: boolean) => { if (applies) breakdown.push({ rule, points: weights[rule] }); };
  add("taxId", Boolean(facts.taxId));
  add("corporateEmail", Boolean(facts.email && !/@(gmail|hotmail|yahoo|outlook)\./i.test(facts.email)));
  add("budget", Boolean(facts.estimatedBudget));
  add("purchaseWithinSixMonths", Boolean(facts.expectedPurchaseAt && facts.expectedPurchaseAt >= now && facts.expectedPurchaseAt.getTime() <= now.getTime() + 183 * 86_400_000));
  add("decisionMaker", facts.decisionMakerKnown === true);
  add("strategicProduct", facts.strategicProduct === true);
  add("multipleSites", (facts.numberOfSites ?? 0) > 1);
  add("unreachable", (facts.failedContactAttempts ?? 0) > 3);
  add("inactive", Boolean(facts.lastActivityAt && now.getTime() - facts.lastActivityAt.getTime() > 30 * 86_400_000));
  const score = Math.max(0, Math.min(100, breakdown.reduce((sum, item) => sum + item.points, 0)));
  return { score, temperature: score >= 70 ? "HOT" : score >= 40 ? "WARM" : "COLD", breakdown } as const;
}

export const QUALIFICATION_KEYS = ["need", "serviceArea", "budget", "authority", "timeline", "productFit", "legalClearance", "verifiedContact"] as const;
export function evaluateQualification(values: Partial<Record<(typeof QUALIFICATION_KEYS)[number], boolean>>) {
  const missing = QUALIFICATION_KEYS.filter((key) => values[key] !== true);
  return { completeness: Math.round(((QUALIFICATION_KEYS.length - missing.length) / QUALIFICATION_KEYS.length) * 100), missing, complete: missing.length === 0 };
}

export function normalizeDuplicateText(value: string) {
  return value.replace(/บริษัท|จำกัด|มหาชน|co\.?|ltd\.?|plc\.?/gi, "").normalize("NFKC").toLocaleLowerCase("th-TH").replace(/[^\p{L}\p{M}\p{N}]/gu, "");
}

export const SLA_HOURS = { HOT: 4, WARM: 24, COLD: 72 } as const;
export const LEAD_ASSIGNER_ROLES = ["ADMIN", "SALES_DIRECTOR", "TEAM_MANAGER"] as const;
export const LEAD_EXPORT_ROLES = ["ADMIN", "SALES_DIRECTOR", "TEAM_MANAGER", "KAM", "MARKETING"] as const;
export const LEAD_IMPORT_ROLES = ["ADMIN", "MARKETING"] as const;
export const LEAD_PRICE_RESTRICTED_ROLES = ["MARKETING"] as const;
export const LEAD_QUALIFIABLE_STATUSES = ["CONTACTED", "NURTURING", "QUALIFIED"] as const;
export const LEAD_CREATE_ROLES = ["ADMIN", "SALES_DIRECTOR", "TEAM_MANAGER", "KAM", "MARKETING"] as const;
export const LEAD_CORE_UPDATE_ROLES = ["ADMIN", "SALES_DIRECTOR", "TEAM_MANAGER", "KAM"] as const;
export const LEAD_QUALIFIED_VIEW_ROLES = ["SOLUTION_ARCHITECT"] as const;
export const LEAD_ACTIVITY_ROLES = [...LEAD_CORE_UPDATE_ROLES, "SOLUTION_ARCHITECT"] as const;
export const LEAD_ASSIGNMENT_RULE_ADMIN_ROLES = ["ADMIN"] as const;
export const LEAD_ROUND_ROBIN_ROLE = "KAM" as const;
export function formatLeadNumber(sequence:number,now=new Date()){const year=new Intl.DateTimeFormat("en",{year:"numeric",timeZone:"Asia/Bangkok"}).format(now);return `LD-${year}-${String(sequence).padStart(7,"0")}`;}
export function temperatureForScore(score:number): "HOT" | "WARM" | "COLD" {return score>=70?"HOT":score>=40?"WARM":"COLD";}
export function firstContactDueAt(assignedAt: Date, temperature: keyof typeof SLA_HOURS, hours = SLA_HOURS) {
  return new Date(assignedAt.getTime() + hours[temperature] * 3_600_000);
}
