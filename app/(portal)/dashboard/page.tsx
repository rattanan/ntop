import Link from "next/link";
import { Activity, ArrowRight, Users } from "lucide-react";
import { OpportunityStage, type Prisma } from "@prisma/client";
import { requireSession } from "@/lib/auth";
import { loadAuthorizationContext } from "@/lib/authorization/authorization-context";
import { buildCustomerScopeWhere } from "@/lib/customer/customer-query-service";
import { buildLeadScopeWhere } from "@/lib/lead/prisma-lead-repository";
import { buildOpportunityScopeWhere } from "@/lib/opportunity/opportunity-query";
import { prisma } from "@/lib/prisma";

export default async function Dashboard({searchParams}:{searchParams:Promise<{from?:string;to?:string}>}) {
  const session=await requireSession(); const query=await searchParams;
  const context=await loadAuthorizationContext({actorId:session.id,legacyRole:session.role});
  const from=query.from&&/^\d{4}-\d{2}-\d{2}$/.test(query.from)?new Date(`${query.from}T00:00:00+07:00`):undefined;
  const to=query.to&&/^\d{4}-\d{2}-\d{2}$/.test(query.to)?new Date(`${query.to}T23:59:59+07:00`):undefined;
  const createdAt=from||to?{...(from?{gte:from}:{}),...(to?{lte:to}:{})}:undefined;
  const leadWhere={AND:[buildLeadScopeWhere(context),{status:{not:"ARCHIVED" as const}},...(createdAt?[{createdAt}]:[])]};
  const opportunityWhere:Prisma.OpportunityWhereInput={...buildOpportunityScopeWhere(context),stage:{notIn:[OpportunityStage.WON,OpportunityStage.LOST,OpportunityStage.CANCELLED,OpportunityStage.EXPIRED]}};
  const now=new Date();
  const [customers,active,pipeline,totalLeads,newLeads,hot,qualified,converted,overdue,statuses,activities]=await Promise.all([
    prisma.customer.count({where:buildCustomerScopeWhere(context)}), prisma.opportunity.count({where:opportunityWhere}),
    prisma.opportunity.aggregate({where:opportunityWhere,_sum:{estimatedValue:true}}), prisma.lead.count({where:leadWhere}),
    prisma.lead.count({where:{AND:[leadWhere,{status:"NEW"}]}}), prisma.lead.count({where:{AND:[leadWhere,{temperature:"HOT"}]}}),
    prisma.lead.count({where:{AND:[leadWhere,{status:"QUALIFIED"}]}}), prisma.lead.count({where:{AND:[buildLeadScopeWhere(context),{status:"CONVERTED"},...(createdAt?[{convertedAt:createdAt}]:[])]}}),
    prisma.lead.count({where:{AND:[leadWhere,{nextFollowUpAt:{lt:now}},{status:{notIn:["CONVERTED","DISQUALIFIED","INVALID","DUPLICATE","NOT_INTERESTED","NO_BUDGET","ARCHIVED"]}}]}}),
    prisma.lead.groupBy({by:["status"],where:leadWhere,_count:{_all:true},orderBy:{status:"asc"}}), prisma.activity.count({where:{ownerId:session.id}}),
  ]);
  const value=new Intl.NumberFormat("th-TH",{style:"currency",currency:"THB",maximumFractionDigits:0}).format(Number(pipeline._sum?.estimatedValue??0));
  const conversionRate=totalLeads+converted?Math.round(converted/(totalLeads+converted)*100):0;
  return <><div className="page-head"><div><p className="eyebrow">ภาพรวม Lead และ Pipeline</p><h1>สวัสดี, {session.name}</h1></div><div className="actions"><Link className="secondary" href="/leads/new">สร้าง Lead</Link><Link className="primary" href="/opportunities/new">สร้างโอกาสขาย</Link></div></div>
    <section className="card"><form method="get" className="card-body actions"><label>ตั้งแต่ <input className="control" type="date" name="from" defaultValue={query.from}/></label><label>ถึง <input className="control" type="date" name="to" defaultValue={query.to}/></label><button className="primary">กรองช่วงเวลา</button><Link className="secondary" href="/dashboard">ล้าง</Link></form></section>
    <div className="stats"><section className="card stat"><p>Lead ที่กำลังดำเนินการ</p><strong>{totalLeads}</strong><p>ใหม่ {newLeads} · Hot {hot}</p></section><section className="card stat"><p>Qualified / Converted</p><strong>{qualified} / {converted}</strong><p>Conversion {conversionRate}%</p></section><section className="card stat"><p>Follow-up เกินกำหนด</p><strong>{overdue}</strong></section><section className="card stat"><p>Pipeline</p><strong>{value}</strong><p>{active} โอกาสขาย</p></section></div>
    <div className="detail-grid dashboard-insights">
      <section className="card dashboard-visual-card">
        <div className="card-header dashboard-card-heading">
          <div><strong>Leads by Status</strong><small>สัดส่วน Lead ที่กำลังดำเนินการ</small></div>
          <span className="badge muted">{totalLeads.toLocaleString("th-TH")} รายการ</span>
        </div>
        <div className="card-body status-chart">
          {statuses.map((item) => {
            const count=item._count._all;
            const percentage=totalLeads?Math.round(count/totalLeads*100):0;
            return <div className="status-chart-row" key={item.status}>
              <div className="status-chart-label"><span>{item.status}</span><strong>{count.toLocaleString("th-TH")} <small>({percentage}%)</small></strong></div>
              <progress value={count} max={Math.max(totalLeads,1)} aria-label={`${item.status} ${count} รายการ คิดเป็น ${percentage}%`}/>
            </div>;
          })}
          {!statuses.length&&<div className="dashboard-empty-visual"><strong>ยังไม่มีข้อมูล Lead</strong><span>ข้อมูลสถานะจะแสดงเมื่อมี Lead ในขอบเขตสิทธิ์</span></div>}
        </div>
      </section>
      <section className="card dashboard-visual-card">
        <div className="card-header dashboard-card-heading"><div><strong>ข้อมูลในขอบเขตสิทธิ์</strong><small>เฉพาะรายการที่คุณได้รับอนุญาต</small></div></div>
        <div className="card-body scope-overview">
          <div className="scope-metrics">
            <div className="scope-metric"><span className="scope-metric-icon"><Users aria-hidden="true"/></span><span>บัญชีลูกค้า</span><strong>{customers.toLocaleString("th-TH")}</strong><small>บัญชีที่เข้าถึงได้</small></div>
            <div className="scope-metric"><span className="scope-metric-icon"><Activity aria-hidden="true"/></span><span>กิจกรรมของฉัน</span><strong>{activities.toLocaleString("th-TH")}</strong><small>กิจกรรมที่รับผิดชอบ</small></div>
          </div>
          <Link className="scope-action" href="/leads?overdue=1"><span><small>ต้องดำเนินการ</small><strong>Lead เกินกำหนด {overdue.toLocaleString("th-TH")} รายการ</strong></span><ArrowRight aria-hidden="true"/></Link>
        </div>
      </section>
    </div></>;
}
