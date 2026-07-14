import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CircleDollarSign,
  Flame,
  PhoneCall,
  Plus,
  SearchCheck,
  ShieldCheck,
  Target,
  TimerReset,
  Trophy,
} from "lucide-react";

import { requireSession } from "@/lib/auth";
import { loadAuthorizationContext } from "@/lib/authorization/authorization-context";
import { prisma } from "@/lib/prisma";
import { buildProspectScopeWhere, loadProspectPermissions } from "@/lib/prospect/prospect-authorization";

const numberFormat = new Intl.NumberFormat("th-TH");
const moneyFormat = new Intl.NumberFormat("th-TH", {
  style: "currency",
  currency: "THB",
  maximumFractionDigits: 0,
});

export default async function ProspectDashboard() {
  const session = await requireSession();
  const context = await loadAuthorizationContext({ actorId: session.id, legacyRole: session.role });
  const permissions = await loadProspectPermissions(context);
  const scope = buildProspectScopeWhere(context, permissions);
  const now = new Date();
  const [groups, total, value, converted, lost, overdue, top] = await Promise.all([
    prisma.prospect.groupBy({ by: ["status"], where: scope, _count: true }),
    prisma.prospect.count({ where: scope }),
    prisma.prospect.aggregate({ where: scope, _sum: { estimatedOpportunityValue: true } }),
    prisma.prospect.count({ where: { AND: [scope, { status: "CONVERTED" }] } }),
    prisma.prospect.count({ where: { AND: [scope, { status: "LOST" }] } }),
    prisma.prospect.count({
      where: {
        AND: [scope, { nextFollowUpAt: { lt: now }, status: { notIn: ["CONVERTED", "LOST", "ARCHIVED"] } }],
      },
    }),
    prisma.prospect.findMany({
      where: { AND: [scope, { heatLevel: "HOT" }] },
      select: { id: true, prospectCode: true, companyName: true, calculatedScore: true },
      orderBy: { calculatedScore: "desc" },
      take: 10,
    }),
  ]);
  const count = Object.fromEntries(groups.map((group) => [group.status, group._count]));
  const conversionRate = total ? Math.round(converted / total * 100) : 0;
  const estimatedValue = moneyFormat.format(Number(value._sum.estimatedOpportunityValue?.toString() ?? "0"));
  const cards = [
    { label: "Total Prospects", value: total, href: "/prospects", hint: "ทั้งหมดในขอบเขตสิทธิ์", icon: Building2 },
    { label: "New", value: count.NEW ?? 0, href: "/prospects?status=NEW", hint: "รอเริ่มดำเนินการ", icon: Plus },
    { label: "Contacted", value: count.CONTACTED ?? 0, href: "/prospects?status=CONTACTED", hint: "ติดต่อแล้ว", icon: PhoneCall },
    { label: "Interested", value: count.INTERESTED ?? 0, href: "/prospects?status=INTERESTED", hint: "แสดงความสนใจ", icon: Flame },
    { label: "Qualified", value: count.QUALIFIED ?? 0, href: "/prospects?status=QUALIFIED", hint: "พร้อมส่งต่อ", icon: SearchCheck },
    { label: "Converted", value: converted, href: "/prospects?status=CONVERTED", hint: `${conversionRate}% conversion`, icon: ShieldCheck },
    { label: "Lost", value: lost, href: "/prospects?status=LOST", hint: "ปิดโดยไม่ Convert", icon: Target },
    { label: "Overdue", value: overdue, href: "/prospects?overdue=1", hint: "ต้องติดตามทันที", icon: TimerReset, urgent: overdue > 0 },
  ] as const;

  return <main className="prospect-dashboard">
    <header className="page-head prospect-dashboard-head">
      <div>
        <p className="eyebrow">Prospect Management · Performance</p>
        <h1>Prospect Dashboard</h1>
        <p>ติดตามคุณภาพ Prospect และจัดลำดับงานที่ควรดำเนินการต่อ</p>
      </div>
      <div className="actions">
        <Link className="secondary" href="/prospects"><ArrowLeft aria-hidden="true" />รายการ Prospect</Link>
        <Link className="primary" href="/prospects/new"><Plus aria-hidden="true" />สร้าง Prospect</Link>
      </div>
    </header>

    <section className="card prospect-dashboard-hero" aria-label="สรุปมูลค่าและอัตรา Conversion">
      <div className="prospect-value-summary">
        <span className="prospect-summary-icon"><CircleDollarSign aria-hidden="true" /></span>
        <div><span>Estimated opportunity value</span><strong>{estimatedValue}</strong><small>มูลค่ารวมจาก Prospect ในขอบเขตสิทธิ์ของคุณ</small></div>
      </div>
      <div className="prospect-conversion-summary">
        <div className="prospect-conversion-ring">
          <svg viewBox="0 0 42 42" role="img" aria-label={`Conversion rate ${conversionRate}%`}>
            <circle className="prospect-ring-track" cx="21" cy="21" r="15.9" />
            <circle className="prospect-ring-value" cx="21" cy="21" r="15.9" pathLength="100" strokeDasharray={`${conversionRate} ${100 - conversionRate}`} />
          </svg>
          <strong>{conversionRate}%</strong>
        </div>
        <div><span>Conversion rate</span><strong>{numberFormat.format(converted)} converted</strong><small>จาก {numberFormat.format(total)} Prospect ทั้งหมด</small></div>
      </div>
    </section>

    <section className="prospect-kpi-grid" aria-label="ตัวชี้วัด Prospect">
      {cards.map(({ label, value: cardValue, href, hint, icon: Icon, ...card }) => <Link className={`card prospect-kpi-card${"urgent" in card && card.urgent ? " urgent" : ""}`} href={href} key={label}>
        <span className="prospect-kpi-icon"><Icon aria-hidden="true" /></span>
        <div><span>{label}</span><strong>{numberFormat.format(cardValue)}</strong><small>{hint}</small></div>
        <ArrowRight className="prospect-kpi-arrow" aria-hidden="true" />
      </Link>)}
    </section>

    <section className="prospect-chart-grid">
      <article className="card prospect-chart-card">
        <header className="card-header prospect-chart-heading">
          <div><p className="eyebrow">Distribution</p><h2>Prospect by Status</h2><small>เปรียบเทียบจำนวนและสัดส่วนในแต่ละสถานะ</small></div>
          <span className="badge muted">{numberFormat.format(total)} รายการ</span>
        </header>
        <div className="card-body prospect-status-chart">
          {groups.map((group) => {
            const percentage = total ? Math.round(group._count / total * 100) : 0;
            return <Link className="prospect-chart-row" href={`/prospects?status=${group.status}`} key={group.status}>
              <div><span>{group.status}</span><strong>{numberFormat.format(group._count)} <small>{percentage}%</small></strong></div>
              <progress value={group._count} max={Math.max(total, 1)} aria-label={`${group.status} ${numberFormat.format(group._count)} รายการ คิดเป็น ${percentage}%`} />
            </Link>;
          })}
          {!groups.length && <div className="dashboard-empty-visual"><strong>ยังไม่มีข้อมูล Prospect</strong><span>กราฟสถานะจะแสดงเมื่อมีข้อมูลในขอบเขตสิทธิ์</span></div>}
        </div>
      </article>

      <article className="card prospect-chart-card">
        <header className="card-header prospect-chart-heading">
          <div><p className="eyebrow">Priority queue</p><h2>Top Hot Prospects</h2><small>เรียงตามคะแนนเพื่อช่วยเลือกงานถัดไป</small></div>
          <span className="prospect-hot-badge"><Flame aria-hidden="true" /> Hot</span>
        </header>
        <div className="card-body prospect-score-chart">
          {top.map((prospect, index) => {
            const score = Math.max(0, Math.min(prospect.calculatedScore, 100));
            return <Link className="prospect-score-row" href={`/prospects/${prospect.id}`} key={prospect.id}>
              <span className="prospect-score-rank">{index === 0 ? <Trophy aria-label="อันดับหนึ่ง" /> : index + 1}</span>
              <span className="prospect-score-main">
                <span><strong>{prospect.companyName}</strong><small>{prospect.prospectCode}</small><b>{score}</b></span>
                <progress value={score} max="100" aria-label={`${prospect.companyName} score ${score} จาก 100`} />
              </span>
              <ArrowRight aria-hidden="true" />
            </Link>;
          })}
          {!top.length && <div className="dashboard-empty-visual"><strong>ยังไม่มี Hot Prospect</strong><span>รายการที่เป็น Hot จะแสดงตามลำดับคะแนนที่นี่</span></div>}
        </div>
      </article>
    </section>
  </main>;
}
