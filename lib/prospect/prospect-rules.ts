import { ProspectHeatLevel, ProspectSource, ProspectStatus } from "@prisma/client";

export const PROSPECT_TRANSITIONS: Record<ProspectStatus, readonly ProspectStatus[]> = {
  NEW: ["ASSIGNED", "CONTACTED", "ARCHIVED"], ASSIGNED: ["CONTACTED", "INTERESTED", "UNREACHABLE", "LOST", "ARCHIVED"],
  CONTACTED: ["INTERESTED", "QUALIFYING", "NOT_INTERESTED", "UNREACHABLE", "LOST", "ARCHIVED"], INTERESTED: ["QUALIFYING", "NOT_INTERESTED", "LOST", "ARCHIVED"],
  QUALIFYING: ["QUALIFIED", "INTERESTED", "NOT_INTERESTED", "LOST", "ARCHIVED"], QUALIFIED: ["CONVERTED", "LOST", "ARCHIVED"],
  NOT_INTERESTED: ["INTERESTED", "LOST", "ARCHIVED"], UNREACHABLE: ["CONTACTED", "LOST", "ARCHIVED"], LOST: ["INTERESTED", "ARCHIVED"], CONVERTED: [], ARCHIVED: [],
};

export function canTransitionProspect(from: ProspectStatus, to: ProspectStatus) { return from === to || PROSPECT_TRANSITIONS[from].includes(to); }
export function normalizeProspectText(value: string) { return value.replace(/บริษัท|จำกัด|มหาชน|co\.?|ltd\.?|plc\.?/gi, "").normalize("NFKC").toLocaleLowerCase("th-TH").replace(/[^\p{L}\p{M}\p{N}]/gu, ""); }
export function normalizeWebsiteDomain(value?: string | null) { if (!value) return null; try { return new URL(value.includes("://") ? value : `https://${value}`).hostname.replace(/^www\./, "").toLowerCase(); } catch { return null; } }
export function formatProspectCode(sequence: number, now = new Date()) { const year = new Intl.DateTimeFormat("en", { year: "numeric", timeZone: "Asia/Bangkok" }).format(now); return `PR-${year}-${String(sequence).padStart(7, "0")}`; }

export const DEFAULT_PROSPECT_WEIGHTS = { estimatedValue: 15, companySize: 8, branches: 7, industryFit: 8, contractTiming: 8, contactFrequency: 8, interest: 10, budget: 8, purchasePeriod: 7, sourceQuality: 6, aiScore: 8, recency: 4, completeness: 3 } as const;
export type ProspectScoringFacts = { estimatedOpportunityValue?: string | null; numberOfEmployees?: number | null; numberOfBranches?: number | null; industryId?: string | null; currentContractEndDate?: Date | null; contactAttemptCount?: number; status: ProspectStatus; expectedBudget?: string | null; expectedPurchasePeriod?: string | null; source: ProspectSource; aiOpportunityScore?: number | null; lastContactAt?: Date | null; completeness: number };
export function calculateProspectScore(facts: ProspectScoringFacts, now = new Date(), weights: Record<keyof typeof DEFAULT_PROSPECT_WEIGHTS, number> = DEFAULT_PROSPECT_WEIGHTS, thresholds = { hot: 75, warm: 40 }) {
  const points: Array<{ factor: keyof typeof weights; points: number }> = []; const add = (factor: keyof typeof weights, applies: boolean) => { if (applies) points.push({ factor, points: weights[factor] }); };
  add("estimatedValue", Number(facts.estimatedOpportunityValue ?? 0) > 0); add("companySize", (facts.numberOfEmployees ?? 0) >= 100); add("branches", (facts.numberOfBranches ?? 0) > 1); add("industryFit", Boolean(facts.industryId)); add("contractTiming", Boolean(facts.currentContractEndDate && facts.currentContractEndDate.getTime() <= now.getTime() + 183 * 86_400_000)); add("contactFrequency", (facts.contactAttemptCount ?? 0) > 0); add("interest", ["INTERESTED", "QUALIFYING", "QUALIFIED"].includes(facts.status)); add("budget", Number(facts.expectedBudget ?? 0) > 0); add("purchasePeriod", Boolean(facts.expectedPurchasePeriod)); add("sourceQuality", !( [ProspectSource.OTHER, ProspectSource.WEB_SCRAPER] as ProspectSource[]).includes(facts.source)); if (facts.aiOpportunityScore != null) points.push({ factor: "aiScore", points: Math.round(weights.aiScore * facts.aiOpportunityScore / 100) }); add("recency", Boolean(facts.lastContactAt && now.getTime() - facts.lastContactAt.getTime() <= 30 * 86_400_000)); if (facts.completeness > 0) points.push({ factor: "completeness", points: Math.round(weights.completeness * facts.completeness / 100) });
  const score = Math.max(0, Math.min(100, points.reduce((sum, item) => sum + item.points, 0))); const heatLevel: ProspectHeatLevel = score >= thresholds.hot ? "HOT" : score >= thresholds.warm ? "WARM" : "COLD"; return { score, heatLevel, breakdown: points };
}
