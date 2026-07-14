import Link from "next/link";
import { AlertTriangle, ArrowRight, BarChart3, CalendarRange, CircleDollarSign, Gauge, Plus, ShieldCheck, Target, TrendingUp } from "lucide-react";

import type { calculateForecast, calculateTargetMetrics, PipelineFact } from "@/lib/forecast/forecast-calculator";
import type { resolveFiscalPeriod } from "@/lib/forecast/fiscal-period";

type Props = {
  facts: readonly PipelineFact[];
  calculation: ReturnType<typeof calculateForecast>;
  targetMetrics: ReturnType<typeof calculateTargetMetrics> | null;
  period: ReturnType<typeof resolveFiscalPeriod>;
  asOf: Date;
  filters: { periodType: string; ownerId: string; category: string; stage: string };
};

const stageOrder = ["QUALIFY", "DISCOVER", "SOLUTION", "PROPOSAL", "NEGOTIATION"] as const;
const stageLabels: Record<string, string> = { QUALIFY: "Qualify", DISCOVER: "Discover", SOLUTION: "Solution", PROPOSAL: "Proposal", NEGOTIATION: "Negotiation" };
const moneyFormat = new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB", maximumFractionDigits: 0 });
const numberFormat = new Intl.NumberFormat("th-TH");

function formatMoney(value: { toString(): string }) { return moneyFormat.format(Number(value.toString())); }

export function PipelineDashboard({ facts, calculation, targetMetrics, period, asOf, filters }: Props) {
  const owners = [...new Map(facts.map((fact) => [fact.ownerId, fact.ownerName ?? fact.ownerId])).entries()].sort((a, b) => a[1].localeCompare(b[1], "th"));
  const stages = stageOrder.map((stage) => {
    const items = calculation.items.filter((item) => item.stage === stage && item.category !== "OMITTED");
    const value = items.reduce((sum, item) => sum + Number(item.forecastAmount.toString()), 0);
    return { stage, label: stageLabels[stage], count: items.length, value };
  });
  const maxStageValue = Math.max(1, ...stages.map((item) => item.value));
  const riskCount = facts.filter((fact) => Array.isArray(fact.riskSnapshot.signals) && fact.riskSnapshot.signals.length > 0).length;
  const stalledCount = facts.filter((fact) => asOf.getTime() - fact.stageEnteredAt.getTime() > 30 * 86_400_000).length;
  const completeCount = facts.filter((fact) => Object.keys(fact.qualitySnapshot).length === 0).length;
  const qualityPercent = facts.length ? Math.round(completeCount / facts.length * 100) : 100;
  const periodLabel = `${period.periodStart.toLocaleDateString("th-TH", { timeZone: period.timezone })} – ${new Date(period.periodEnd.getTime() - 1).toLocaleDateString("th-TH", { timeZone: period.timezone })}`;
  const kpis = [
    { label: "Open Pipeline", value: formatMoney(calculation.pipelineAmount), hint: `${numberFormat.format(calculation.items.length)} opportunities`, icon: CircleDollarSign },
    { label: "Weighted Pipeline", value: formatMoney(calculation.weightedAmount), hint: "Revenue × probability", icon: TrendingUp },
    { label: "Commit", value: formatMoney(calculation.commitAmount), hint: "ทีมยืนยันว่าจะปิดได้", icon: ShieldCheck },
    { label: "Best Case", value: formatMoney(calculation.bestCaseAmount), hint: "Commit + Best Case", icon: BarChart3 },
    { label: "Target Attainment", value: targetMetrics?.targetAttainmentPercent ? `${targetMetrics.targetAttainmentPercent.toFixed(1)}%` : "—", hint: targetMetrics ? `${formatMoney(targetMetrics.actualClosedWon)} actual` : "ยังไม่มี Sales Target ที่ใช้งาน", icon: Target },
    { label: "Pipeline Coverage", value: targetMetrics?.pipelineCoverage ? `${targetMetrics.pipelineCoverage.toFixed(2)}x` : "—", hint: targetMetrics ? `${formatMoney(targetMetrics.remainingTarget)} remaining` : "ตั้ง Target เพื่อคำนวณ Coverage", icon: Gauge },
  ];
  return <main className="pipeline-page">
    <header className="pipeline-hero">
      <div><p className="eyebrow">Commercial · Sales Pipeline</p><h1>Pipeline & Forecast</h1><p>เห็นสถานะรายได้ ความเสี่ยง และงานที่ควรทำต่อจากข้อมูลในขอบเขตสิทธิ์ของคุณ</p></div>
      <Link className="primary" href="/opportunities/new"><Plus aria-hidden="true" />สร้าง Opportunity</Link>
    </header>

    <form className="pipeline-filters card" method="get" aria-label="ตัวกรอง Pipeline">
      <label><span>ช่วงเวลา</span><select className="control" name="periodType" defaultValue={filters.periodType}><option value="MONTH">Fiscal month</option><option value="QUARTER">Fiscal quarter</option><option value="YEAR">Fiscal year</option></select></label>
      <label><span>เจ้าของ</span><select className="control" name="ownerId" defaultValue={filters.ownerId}><option value="">ทุกคนในขอบเขต</option>{owners.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
      <label><span>Forecast category</span><select className="control" name="category" defaultValue={filters.category}><option value="">ทุก Category</option><option value="COMMIT">Commit</option><option value="BEST_CASE">Best Case</option><option value="PIPELINE">Pipeline</option><option value="OMITTED">Omitted</option></select></label>
      <button className="secondary" type="submit">ใช้ตัวกรอง</button>
      <p className="pipeline-period"><CalendarRange aria-hidden="true" />FY{period.fiscalYear} · {periodLabel} · {period.timezone}</p>
    </form>

    <section className="pipeline-kpis" aria-label="ตัวชี้วัด Pipeline">
      {kpis.map(({ label, value, hint, icon: Icon }) => <article className="card pipeline-kpi" key={label}><div><span>{label}</span><Icon aria-hidden="true" /></div><strong>{value}</strong><small>{hint}</small></article>)}
    </section>

    <section className="pipeline-main-grid">
      <article className="card pipeline-panel"><header><div><p className="eyebrow">Pipeline funnel</p><h2>มูลค่าตาม Sales Stage</h2></div><span>{numberFormat.format(facts.length)} รายการ</span></header><div className="pipeline-funnel" role="img" aria-label={`Pipeline funnel มี ${stages.length} ขั้น รวม ${formatMoney(calculation.pipelineAmount)}`}>{stages.map((item) => <Link href={`?periodType=${filters.periodType}&stage=${item.stage}`} className="pipeline-stage" key={item.stage}><span><strong>{item.label}</strong><small>{numberFormat.format(item.count)} deals</small></span><span className="pipeline-stage-track"><i style={{ width: `${Math.max(4, item.value / maxStageValue * 100)}%` }} /></span><b>{moneyFormat.format(item.value)}</b></Link>)}</div></article>
      <article className="card pipeline-panel"><header><div><p className="eyebrow">Forecast mix</p><h2>ระดับความมั่นใจ</h2></div><Link href="/opportunities">ดู Opportunity <ArrowRight aria-hidden="true" /></Link></header><div className="forecast-stack" aria-label="Forecast category summary"><div className="forecast-row commit"><span><strong>Commit</strong><small>ยืนยันโดยทีมขาย</small></span><b>{formatMoney(calculation.commitAmount)}</b></div><div className="forecast-row best"><span><strong>Best Case</strong><small>รวม Commit</small></span><b>{formatMoney(calculation.bestCaseAmount)}</b></div><div className="forecast-row weighted"><span><strong>Weighted</strong><small>ปรับตาม Probability</small></span><b>{formatMoney(calculation.weightedAmount)}</b></div></div></article>
    </section>

    <section className="pipeline-health" aria-label="Pipeline health">
      <article className="card"><AlertTriangle aria-hidden="true" /><div><span>Risk signals</span><strong>{numberFormat.format(riskCount)}</strong><small>Opportunity ที่มีสัญญาณความเสี่ยง</small></div></article>
      <article className="card"><CalendarRange aria-hidden="true" /><div><span>Stalled over 30 days</span><strong>{numberFormat.format(stalledCount)}</strong><small>ควรทบทวน next action และ close date</small></div></article>
      <article className="card"><ShieldCheck aria-hidden="true" /><div><span>Data quality</span><strong>{qualityPercent}%</strong><small>{numberFormat.format(completeCount)} จาก {numberFormat.format(facts.length)} รายการครบถ้วน</small></div></article>
    </section>

    <section className="card pipeline-table-panel"><header><div><p className="eyebrow">Drill-down</p><h2>Opportunity ใน Forecast</h2></div><span>{numberFormat.format(calculation.items.length)} รายการ</span></header><div className="table-wrap"><table className="table"><thead><tr><th>Opportunity</th><th>ลูกค้า</th><th>Stage</th><th>Category</th><th>Close date</th><th className="numeric-cell">Amount</th><th className="numeric-cell">Weighted</th></tr></thead><tbody>{calculation.items.slice(0, 100).map((item) => <tr key={item.opportunityId}><td><Link className="link" href={`/opportunities/${item.opportunityId}`}>{item.opportunityName ?? item.opportunityId}</Link><br/><small>{item.opportunityNumber ?? "ยังไม่มีเลข"} · {item.ownerName ?? item.ownerId}</small></td><td>{item.customerName ?? item.customerId}</td><td><span className="badge muted">{stageLabels[item.stage] ?? item.stage}</span></td><td><span className="badge">{item.category}</span></td><td>{item.expectedCloseAt?.toLocaleDateString("th-TH") ?? "ยังไม่กำหนด"}</td><td className="numeric-cell">{formatMoney(item.forecastAmount)}</td><td className="numeric-cell">{formatMoney(item.weightedAmount)}</td></tr>)}</tbody></table>{!calculation.items.length && <div className="empty"><div><strong>ไม่พบ Opportunity ในช่วงเวลานี้</strong><p>ลองเปลี่ยนช่วงเวลาหรือตัวกรองเพื่อดู Pipeline</p></div></div>}</div></section>
  </main>;
}
