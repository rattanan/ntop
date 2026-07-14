import type { OpportunityStage } from "@prisma/client";

export type OpportunityHealthInput = {
  stage: OpportunityStage;
  lastActivityAt: Date | null;
  nextAction: string | null;
  qualificationResult: string | null;
  requirements: string | null;
  stakeholderSummary: string | null;
  solutionComplete: boolean;
  commercialReady: boolean;
  expectedCloseAt: Date | null;
};

export type OpportunityHealthConfig = {
  activityFreshDays: number;
  stageScores: Readonly<Record<OpportunityStage, number>>;
};

export const DEFAULT_OPPORTUNITY_HEALTH_CONFIG: OpportunityHealthConfig = {
  activityFreshDays: 14,
  stageScores: { QUALIFY: 3, DISCOVER: 7, SOLUTION: 11, PROPOSAL: 15, NEGOTIATION: 20, WON: 20, LOST: 0, CANCELLED: 0, EXPIRED: 0 },
};

export function calculateOpportunityHealth(input: OpportunityHealthInput, at = new Date(), config = DEFAULT_OPPORTUNITY_HEALTH_CONFIG) {
  const positives: string[] = [];
  const risks: string[] = [];
  let score = config.stageScores[input.stage];
  if (score >= 11) positives.push("ดีลผ่านขั้นวิเคราะห์ความต้องการแล้ว");
  const freshSince = new Date(at.getTime() - config.activityFreshDays * 86_400_000);
  if (input.lastActivityAt && input.lastActivityAt >= freshSince) { score += 15; positives.push("มีกิจกรรมล่าสุดกับลูกค้า"); }
  else risks.push(`ไม่มีกิจกรรมใน ${config.activityFreshDays} วันที่ผ่านมา`);
  if (input.nextAction?.trim()) { score += 10; positives.push("กำหนด Next action แล้ว"); } else risks.push("ยังไม่มี Next action");
  if (input.qualificationResult?.trim()) { score += 10; positives.push("ยืนยันผล Qualification แล้ว"); } else risks.push("Qualification ยังไม่สมบูรณ์");
  if (input.requirements?.trim()) { score += 10; positives.push("บันทึกความต้องการแล้ว"); } else risks.push("ยังไม่มีข้อมูล Requirement");
  if (input.stakeholderSummary?.trim()) { score += 10; positives.push("ระบุ Stakeholder แล้ว"); } else risks.push("ยังไม่ระบุ Stakeholder");
  if (input.solutionComplete) { score += 10; positives.push("Solution พร้อมใช้งาน"); } else risks.push("Solution ยังไม่พร้อม");
  if (input.commercialReady) { score += 10; positives.push("Commercial evidence พร้อม"); } else risks.push("Commercial evidence ยังไม่พร้อม");
  if (input.expectedCloseAt && input.expectedCloseAt >= at) score += 5;
  else risks.push(input.expectedCloseAt ? "Expected close date เกินกำหนด" : "ยังไม่มี Expected close date");
  score = Math.max(0, Math.min(100, score));
  const category = score >= 80 ? "HEALTHY" : score >= 60 ? "WATCH" : score >= 40 ? "AT_RISK" : "CRITICAL";
  return { score, category, positives, risks, calculatedAt: at } as const;
}
