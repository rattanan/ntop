"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition, type CSSProperties, type FormEvent } from "react";
import {
  Activity, AlertTriangle, ArrowRight, BarChart3, Bell, BriefcaseBusiness, Building2, CalendarClock,
  CheckCircle2, CircleDollarSign, Download, FileSpreadsheet, Filter, Gauge, RefreshCw, ShieldCheck,
  Target, TrendingUp, Users,
} from "lucide-react";

import { DASHBOARD_FILTER_KEYS, dashboardFilterSearchParams } from "@/lib/dashboard/dashboard-filters";
import type { DashboardChartPoint, DashboardData, DashboardMetric } from "@/lib/dashboard/dashboard-query";

const sectionLabels: Record<string, string> = {
  executive: "Executive",
  sales: "Sales",
  salesManager: "Sales Manager",
  solution: "Solution / Engineer",
  approver: "Approver",
  operations: "Provisioning / Operation",
  customerSuccess: "Customer Success",
  admin: "Admin",
};

const metricIcons = {
  prospects: Building2,
  leads: Users,
  opportunities: BriefcaseBusiness,
  customers: ShieldCheck,
  pipeline: CircleDollarSign,
  weighted: TrendingUp,
  commit: Gauge,
  target: Target,
  approvals: CheckCircle2,
  "sla-work": CalendarClock,
  contracts: FileSpreadsheet,
  operations: Activity,
  incidents: AlertTriangle,
} as const;

const moneyFormatter = new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB", maximumFractionDigits: 0 });
const numberFormatter = new Intl.NumberFormat("th-TH", { maximumFractionDigits: 1 });
const dateTimeFormatter = new Intl.DateTimeFormat("th-TH", { timeZone: "Asia/Bangkok", dateStyle: "medium", timeStyle: "short" });

function displayMetric(item: DashboardMetric) {
  if (item.kind === "money") return moneyFormatter.format(Number(item.value));
  if (item.kind === "percent") return `${numberFormatter.format(Number(item.value))}%`;
  return numberFormatter.format(Number(item.value));
}

function filterQuery(data: DashboardData) {
  return dashboardFilterSearchParams(data.filters).toString();
}

function ChartCard({ title, subtitle, points, testId }: { title: string; subtitle: string; points: DashboardChartPoint[]; testId: string }) {
  const maximum = points.reduce((max, item) => Math.max(max, Number(item.value)), 0);
  return <section className="dashboard-panel dashboard-chart-card" data-testid={testId}>
    <header><div><h2>{title}</h2><p>{subtitle}</p></div><BarChart3 aria-hidden="true"/></header>
    {points.length ? <>
      <div className="dashboard-bar-chart" role="img" aria-label={`${title}: ${points.map((item) => `${item.label} ${item.count} รายการ`).join(", ")}`}>
        {points.slice(0, 8).map((item) => {
          const percentage = maximum ? Math.max(4, Math.round((Number(item.value) / maximum) * 100)) : 0;
          return <Link href={item.href} className="dashboard-bar-row" key={item.key} title={`${item.label}: ${moneyFormatter.format(Number(item.value))}`}>
            <span className="dashboard-bar-label"><strong>{item.label}</strong><small>{item.count.toLocaleString("th-TH")} รายการ</small></span>
            <span className="dashboard-bar-track"><span style={{ "--dashboard-bar-size": `${percentage}%` } as CSSProperties}/></span>
            <strong className="dashboard-bar-value">{moneyFormatter.format(Number(item.value))}</strong>
          </Link>;
        })}
      </div>
      <table className="sr-only"><caption>{title}</caption><thead><tr><th>รายการ</th><th>จำนวน</th><th>มูลค่า</th></tr></thead><tbody>{points.map((item) => <tr key={item.key}><td>{item.label}</td><td>{item.count}</td><td>{item.value}</td></tr>)}</tbody></table>
    </> : <div className="dashboard-inline-empty"><BarChart3 aria-hidden="true"/><strong>ยังไม่มีข้อมูลสำหรับกราฟนี้</strong><span>ลองปรับช่วงเวลาหรือ filter</span></div>}
  </section>;
}

function MetricCard({ item, compact = false }: { item: DashboardMetric; compact?: boolean }) {
  const Icon = metricIcons[item.key as keyof typeof metricIcons] ?? Gauge;
  return <Link href={item.href} className={`dashboard-metric-card ${compact ? "compact" : ""} tone-${item.tone ?? "default"}`} data-metric={item.key}>
    <span className="dashboard-metric-icon"><Icon aria-hidden="true"/></span>
    <span className="dashboard-metric-copy"><span>{item.label}</span><strong>{displayMetric(item)}</strong><small>{item.detail}</small></span>
    <ArrowRight className="dashboard-metric-arrow" aria-hidden="true"/>
  </Link>;
}

export function DashboardView({ data, userName }: { data: DashboardData; userName: string }) {
  const router = useRouter();
  const [isRefreshing, startRefresh] = useTransition();
  const [restoring, setRestoring] = useState(true);
  const query = useMemo(() => filterQuery(data), [data]);
  const exportBase = query ? `${query}&` : "";

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const hasDashboardFilter = DASHBOARD_FILTER_KEYS.some((key) => new URLSearchParams(window.location.search).has(key));
      const saved = localStorage.getItem("ntop-dashboard-filters");
      if (!hasDashboardFilter && saved) router.replace(`/dashboard?${saved}`);
      setRestoring(false);
    });
    return () => cancelAnimationFrame(frame);
  }, [router]);

  useEffect(() => {
    if (query) localStorage.setItem("ntop-dashboard-filters", query);
  }, [query]);

  function persistFilters(event: FormEvent<HTMLFormElement>) {
    const formData = new FormData(event.currentTarget);
    const params = new URLSearchParams();
    for (const key of DASHBOARD_FILTER_KEYS) {
      const value = formData.get(key);
      if (typeof value === "string" && value) params.set(key, value);
    }
    if (params.size) localStorage.setItem("ntop-dashboard-filters", params.toString());
    else localStorage.removeItem("ntop-dashboard-filters");
  }

  return <div className="enterprise-dashboard" data-testid="enterprise-dashboard" aria-busy={isRefreshing || restoring}>
    <header className="dashboard-hero">
      <div>
        <p className="eyebrow">NT Enterprise Command Center</p>
        <h1>สวัสดี, {userName}</h1>
        <p>ภาพรวมที่คำนวณจากข้อมูลจริงในขอบเขต <strong>{data.scopeLabel}</strong></p>
        <div className="dashboard-role-chips" aria-label="Dashboard ตามบทบาท">{data.permissions.sections.map((section) => <span key={section}>{sectionLabels[section]}</span>)}</div>
      </div>
      <div className="dashboard-hero-actions">
        <span className="dashboard-updated"><span className="dashboard-live-dot"/>อัปเดตล่าสุด <time dateTime={data.updatedAt}>{dateTimeFormatter.format(new Date(data.updatedAt))}</time></span>
        <button type="button" className="secondary" onClick={() => startRefresh(() => router.refresh())} disabled={isRefreshing} data-testid="dashboard-refresh"><RefreshCw className={isRefreshing ? "spin" : ""} aria-hidden="true"/>{isRefreshing ? "กำลังอัปเดต" : "Refresh"}</button>
        {data.permissions.canExport && <details className="dashboard-export"><summary className="primary"><Download aria-hidden="true"/>Export</summary><div><a href={`/api/v1/dashboard/export?${exportBase}format=xlsx`}><FileSpreadsheet/>Excel (.xlsx)</a><a href={`/api/v1/dashboard/export?${exportBase}format=csv`}><Download/>CSV</a></div></details>}
      </div>
    </header>

    <section className="dashboard-filter-panel" aria-labelledby="dashboard-filter-title">
      <div className="dashboard-filter-heading"><Filter aria-hidden="true"/><div><h2 id="dashboard-filter-title">Global Filter</h2><p>ทุก KPI, กราฟ และ export ใช้เงื่อนไขเดียวกัน</p></div></div>
      <form method="get" onSubmit={persistFilters} className="dashboard-filter-grid" data-testid="dashboard-filters">
        <label><span>ตั้งแต่</span><input className="control" type="date" name="from" defaultValue={data.filters.from}/></label>
        <label><span>ถึง</span><input className="control" type="date" name="to" defaultValue={data.filters.to}/></label>
        <label><span>หน่วยงาน</span><select className="control" name="departmentId" defaultValue={data.filters.departmentId ?? ""}><option value="">ทุกหน่วยงานที่มีสิทธิ์</option>{data.options.departments.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>
        <label><span>ทีม</span><select className="control" name="teamId" defaultValue={data.filters.teamId ?? ""}><option value="">ทุกทีมที่มีสิทธิ์</option>{data.options.teams.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>
        <label><span>Owner</span><select className="control" name="ownerId" defaultValue={data.filters.ownerId ?? ""}><option value="">ทุก Owner ที่มีสิทธิ์</option>{data.options.owners.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>
        <label><span>Segment</span><select className="control" name="segment" defaultValue={data.filters.segment ?? ""}><option value="">ทุก Segment</option>{data.options.segments.map((item) => <option value={item} key={item}>{item}</option>)}</select></label>
        <label><span>Product</span><select className="control" name="productId" defaultValue={data.filters.productId ?? ""}><option value="">ทุก Product</option>{data.options.products.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>
        <label><span>สถานะ Opportunity</span><select className="control" name="status" defaultValue={data.filters.status ?? ""}><option value="">ทุกสถานะ</option>{data.options.statuses.map((item) => <option value={item} key={item}>{item.replaceAll("_", " ")}</option>)}</select></label>
        <div className="dashboard-filter-actions"><button className="primary" type="submit"><Filter aria-hidden="true"/>ใช้ Filter</button><Link className="secondary" href="/dashboard" onClick={() => localStorage.removeItem("ntop-dashboard-filters")}>ล้างทั้งหมด</Link></div>
      </form>
    </section>

    {data.isEmpty ? <section className="dashboard-state dashboard-empty-state" data-testid="dashboard-empty">
      <BarChart3 aria-hidden="true"/><h2>ยังไม่มีข้อมูลในขอบเขตนี้</h2><p>ปรับ filter หรือเริ่มสร้างข้อมูลจากโมดูลที่คุณมีสิทธิ์ใช้งาน</p><Link className="primary" href="/prospects/new">สร้าง Prospect</Link>
    </section> : <>
      <section className="dashboard-section" aria-labelledby="dashboard-kpi-title">
        <div className="dashboard-section-head"><div><p className="eyebrow">Business pulse</p><h2 id="dashboard-kpi-title">KPI ภาพรวม</h2></div><span>{data.kpis.length} ตัวชี้วัด · คลิกเพื่อ Drill-down</span></div>
        <div className="dashboard-kpi-grid" data-testid="dashboard-kpis">{data.kpis.map((item) => <MetricCard item={item} key={item.key}/>)}</div>
      </section>

      <section className="dashboard-overview-grid">
        <section className="dashboard-panel dashboard-funnel" data-testid="dashboard-funnel">
          <header><div><h2>Sales Funnel</h2><p>Prospect → Lead → Opportunity → Quotation → Contract → Customer</p></div><TrendingUp aria-hidden="true"/></header>
          <div className="dashboard-funnel-flow">{data.funnel.map((item, index) => <Link href={item.href} key={item.key} style={{ "--funnel-step": index } as CSSProperties}><span>{item.label}</span><strong>{item.count.toLocaleString("th-TH")}</strong><small>{index ? `${data.funnel[index - 1].count ? Math.round((item.count / data.funnel[index - 1].count) * 100) : 0}% จากขั้นก่อนหน้า` : "จุดเริ่มต้น"}</small></Link>)}</div>
        </section>
        <section className="dashboard-panel dashboard-conversion" data-testid="dashboard-conversion">
          <header><div><h2>Conversion & Win/Loss</h2><p>อัตราจากข้อมูลต้นทางตาม filter</p></div><Gauge aria-hidden="true"/></header>
          <div className="dashboard-rate-list">
            <Link href="/leads"><span><strong>Lead Conversion</strong><small>Lead → Opportunity</small></span><b>{data.conversion.leadToOpportunity}%</b><progress max="100" value={data.conversion.leadToOpportunity}/></Link>
            <Link href="/opportunities?stage=WON"><span><strong>Win Rate</strong><small>Won ÷ (Won + Lost)</small></span><b>{data.conversion.winRate}%</b><progress className="success" max="100" value={data.conversion.winRate}/></Link>
            <Link href="/opportunities?stage=LOST"><span><strong>Loss Rate</strong><small>Lost ÷ (Won + Lost)</small></span><b>{data.conversion.lossRate}%</b><progress className="danger" max="100" value={data.conversion.lossRate}/></Link>
          </div>
        </section>
      </section>

      <section className="dashboard-section" aria-labelledby="dashboard-chart-title">
        <div className="dashboard-section-head"><div><p className="eyebrow">Pipeline intelligence</p><h2 id="dashboard-chart-title">Pipeline Analytics</h2></div><span>มูลค่า THB · สูงสุด 8 รายการต่อกราฟ</span></div>
        <div className="dashboard-chart-grid">
          <ChartCard title="Pipeline by Stage" subtitle="สถานะการขาย" points={data.charts.stage} testId="chart-stage"/>
          <ChartCard title="Pipeline by Segment" subtitle="Customer Segment" points={data.charts.segment} testId="chart-segment"/>
          <ChartCard title="Pipeline by Product" subtitle="สินค้าใน Primary Quote ล่าสุด" points={data.charts.product} testId="chart-product"/>
          <ChartCard title="Pipeline by Owner" subtitle="ผู้รับผิดชอบ" points={data.charts.owner} testId="chart-owner"/>
          <ChartCard title="Pipeline by Month" subtitle="เดือนที่คาดว่าจะปิด" points={data.charts.month} testId="chart-month"/>
        </div>
      </section>

      <section className="dashboard-section" aria-labelledby="dashboard-role-title">
        <div className="dashboard-section-head"><div><p className="eyebrow">Role intelligence</p><h2 id="dashboard-role-title">Dashboard ตามสิทธิ์</h2></div><span>แสดงจาก permission grant ในฐานข้อมูล</span></div>
        <div className="dashboard-role-grid">{data.roleFocus.map((focus) => <section className="dashboard-panel dashboard-role-panel" data-dashboard-section={focus.section} key={focus.section}>
          <header><div><span className="dashboard-role-label">{sectionLabels[focus.section]}</span><h3>{focus.title}</h3><p>{focus.description}</p></div><ShieldCheck aria-hidden="true"/></header>
          <div className="dashboard-role-metrics">{focus.metrics.map((item) => <MetricCard item={item} compact key={item.key}/>)}</div>
          <div className="dashboard-role-items">{focus.items.length ? focus.items.slice(0, 5).map((item) => <Link href={item.href} key={item.id}><span className={`dashboard-action-tone tone-${item.tone}`}/><span><strong>{item.title}</strong><small>{item.description}</small></span><ArrowRight aria-hidden="true"/></Link>) : <div className="dashboard-inline-empty"><CheckCircle2/><strong>ไม่มีรายการที่ต้องดำเนินการ</strong><span>ข้อมูลล่าสุดอยู่ในเกณฑ์ปกติ</span></div>}</div>
        </section>)}</div>
      </section>

      <section className="dashboard-activity-grid">
        {[
          ["Recent Activities", "เหตุการณ์ล่าสุดในขอบเขต", data.recentActivities, Activity],
          ["Notifications", "รายการที่ควรรับทราบ", data.notifications, Bell],
          ["Action Required", "งานที่ควรดำเนินการต่อ", data.actions, AlertTriangle],
        ].map(([title, subtitle, items, Icon]) => {
          const rows = items as DashboardData["actions"];
          const PanelIcon = Icon as typeof Activity;
          return <section className="dashboard-panel dashboard-feed" key={title as string}>
            <header><div><h2>{title as string}</h2><p>{subtitle as string}</p></div><PanelIcon aria-hidden="true"/></header>
            <div>{rows.length ? rows.slice(0, 8).map((item) => <Link href={item.href} key={item.id}><span className={`dashboard-action-tone tone-${item.tone}`}/><span><strong>{item.title}</strong><small>{item.description}</small><time dateTime={item.occurredAt}>{dateTimeFormatter.format(new Date(item.occurredAt))}</time></span><ArrowRight aria-hidden="true"/></Link>) : <div className="dashboard-inline-empty"><CheckCircle2/><strong>ไม่มีรายการ</strong><span>ระบบจะแสดงเมื่อมีข้อมูลในขอบเขต</span></div>}</div>
          </section>;
        })}
      </section>
    </>}
  </div>;
}
