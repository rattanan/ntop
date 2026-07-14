import type { LeadStatus, LeadTemperature, Prisma } from "@prisma/client";
import Link from "next/link";

import { LeadColumnVisibilityControls } from "@/components/lead-column-visibility-controls";
import { ModuleTabs } from "@/components/module-tabs";
import { requireSession } from "@/lib/auth";
import { loadAuthorizationContext } from "@/lib/authorization/authorization-context";
import { PERMISSIONS, permissionPolicy } from "@/lib/authorization/permission-policy";
import { LEAD_STATUSES } from "@/lib/constants";
import { buildLeadScopeWhere } from "@/lib/lead/prisma-lead-repository";
import { LEAD_CREATE_ROLES, LEAD_EXPORT_ROLES, LEAD_IMPORT_ROLES } from "@/lib/lead/lead-rules";
import { prisma } from "@/lib/prisma";
import { LeadImportForm } from "@/components/lead-import-form";

const source:Record<string,string>={IMPORT:"นำเข้า",WEBSITE:"เว็บไซต์",EVENT:"กิจกรรม",PARTNER:"พันธมิตร",REFERRAL:"ผู้แนะนำ",EXISTING_CUSTOMER:"ลูกค้าเดิม",MARKETING_CAMPAIGN:"แคมเปญ",API:"API",GOVERNMENT_TENDER:"ประกวดราคา"};
const statusLabel=Object.fromEntries(LEAD_STATUSES);
const temperatures: Array<[LeadTemperature,string]>=[["HOT","Hot"],["WARM","Warm"],["COLD","Cold"]];
const sortable={updatedAt:"อัปเดตล่าสุด",score:"คะแนน",company:"ชื่อบริษัท",nextFollowUpAt:"กำหนดติดตาม"} as const;

const columnKeys=["lead","source","status","score","followUp","owner","actions"] as const;
type Search={q?:string;status?:string;temperature?:string;owner?:string;overdue?:string;archived?:string;sort?:string;direction?:string;page?:string;columns?:string;tab?:string};
export default async function LeadsPage({searchParams}:{searchParams:Promise<Search>}){
  const query=await searchParams;
  const session=await requireSession();
  const context=await loadAuthorizationContext({actorId:session.id,legacyRole:session.role});
  const page=Math.max(1,Number.parseInt(query.page??"1",10)||1);
  const sort=query.sort&&query.sort in sortable?query.sort as keyof typeof sortable:"updatedAt";
  const direction=query.direction==="asc"?"asc":"desc";
  const requestedColumns=(query.columns??"").split(",").filter(value=>(columnKeys as readonly string[]).includes(value));
  const columns=requestedColumns.length?[...new Set(requestedColumns)]:[...columnKeys];
  const status=query.status&&LEAD_STATUSES.some(([value])=>value===query.status)?query.status as LeadStatus:undefined;
  const temperature=query.temperature&&temperatures.some(([value])=>value===query.temperature)?query.temperature as LeadTemperature:undefined;
  const where:Prisma.LeadWhereInput={AND:[buildLeadScopeWhere(context),query.archived==="1"?{}:{status:{not:"ARCHIVED"}},status?{status}:{},temperature?{temperature}:{},query.owner?{ownerId:query.owner}:{},query.overdue==="1"?{nextFollowUpAt:{lt:new Date()},status:{notIn:["CONVERTED","DISQUALIFIED","INVALID","DUPLICATE","NOT_INTERESTED","NO_BUDGET","ARCHIVED"]}}:{},query.q?{OR:[{company:{contains:query.q}},{contactName:{contains:query.q}},{contactEmail:{contains:query.q}},{contactPhone:{contains:query.q}},{taxId:{contains:query.q}},{leadNumber:{contains:query.q}}]}:{}]};
  const organizationUnitIds=context.assignments.flatMap(item=>item.organizationUnitId?[item.organizationUnitId]:[]);const enterprise=context.assignments.some(item=>item.scope==="ENTERPRISE");
  const [leads,total,owners]=await Promise.all([
    prisma.lead.findMany({where,include:{owner:true,customer:true},orderBy:[{[sort]:direction},{id:"desc"}],skip:(page-1)*50,take:50}),
    prisma.lead.count({where}),
    prisma.user.findMany({where:{active:true,...(!enterprise?{OR:[{id:session.id},...(organizationUnitIds.length?[{enterpriseRoleAssignments:{some:{organizationUnitId:{in:organizationUnitIds},active:true}}}]:[])]}:{})},select:{id:true,name:true},orderBy:{name:"asc"},take:200}),
  ]);
  const canCreate=permissionPolicy.allows(session,PERMISSIONS.recordCreate)&&context.assignments.some(item=>(LEAD_CREATE_ROLES as readonly string[]).includes(item.role));
  const canImport=context.assignments.some(item=>(LEAD_IMPORT_ROLES as readonly string[]).includes(item.role));
  const canExport=context.assignments.some(item=>(LEAD_EXPORT_ROLES as readonly string[]).includes(item.role));
  const activeTab=query.tab==="import"&&canImport?"import":"list";
  const href=(next:number)=>`/leads?${new URLSearchParams({...Object.fromEntries(Object.entries(query).filter(([,v])=>v)),page:String(next)} as Record<string,string>)}`;
  const currentQuery=Object.fromEntries(Object.entries(query).filter(([,value])=>typeof value==="string"&&value.length>0)) as Record<string,string>;
  return <><div className="page-head"><div><p className="eyebrow">Lead Management</p><h1>รายชื่อผู้มุ่งหวัง</h1><p>{total.toLocaleString("th-TH")} รายการตามขอบเขตสิทธิ์</p></div><div className="actions">{canExport&&<Link href={`/api/v1/leads/export${status?`?status=${status}`:""}`} className="secondary">Export CSV</Link>}{canCreate&&<Link href="/leads/new" className="primary">สร้าง Lead</Link>}</div></div>
    <ModuleTabs label="เมนู Lead" items={[{label:"รายการ Lead",href:"/leads",active:activeTab==="list"},...(canImport?[{label:"Import Lead",href:"/leads?tab=import",active:activeTab==="import"}]:[])]}/>
    {activeTab==="import"?<LeadImportForm/>:<>
    <section className="card"><form method="get" className="card-body form-grid" aria-label="ตัวกรอง Lead">
      <label className="field"><span>ค้นหา</span><input className="control" name="q" defaultValue={query.q} placeholder="บริษัท ผู้ติดต่อ เลข Lead หรือ Tax ID"/></label>
      <label className="field"><span>สถานะ</span><select className="control" name="status" defaultValue={query.status??""}><option value="">ทุกสถานะ</option>{LEAD_STATUSES.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
      <label className="field"><span>Temperature</span><select className="control" name="temperature" defaultValue={query.temperature??""}><option value="">ทุกระดับ</option>{temperatures.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
      <label className="field"><span>ผู้รับผิดชอบ</span><select className="control" name="owner" defaultValue={query.owner??""}><option value="">ทุกคนที่มองเห็น</option>{owners.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}</select></label>
      <label className="field"><span>เรียงตาม</span><select className="control" name="sort" defaultValue={sort}>{Object.entries(sortable).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
      <label className="field"><span>ลำดับ</span><select className="control" name="direction" defaultValue={direction}><option value="desc">มากไปน้อย / ใหม่ไปเก่า</option><option value="asc">น้อยไปมาก / เก่าไปใหม่</option></select></label>
      <label><input type="checkbox" name="overdue" value="1" defaultChecked={query.overdue==="1"}/> เกินกำหนดติดตาม</label>
      <label><input type="checkbox" name="archived" value="1" defaultChecked={query.archived==="1"}/> รวมรายการเก็บถาวร</label>
      <div className="actions"><LeadColumnVisibilityControls query={currentQuery} columns={columns}/><button className="primary">ค้นหา</button><Link className="secondary" href="/leads">ล้างตัวกรอง</Link></div>
    </form></section>
    <section className="card"><div className="table-wrap"><table className="table"><thead><tr>{columns.includes("lead")&&<th>Lead / บริษัท</th>}{columns.includes("source")&&<th>แหล่งที่มา</th>}{columns.includes("status")&&<th>สถานะ</th>}{columns.includes("score")&&<th>Score</th>}{columns.includes("followUp")&&<th>ติดตามครั้งถัดไป</th>}{columns.includes("owner")&&<th>ผู้รับผิดชอบ</th>}{columns.includes("actions")&&<th>การทำงาน</th>}</tr></thead><tbody>{leads.map(lead=><tr key={lead.id}>{columns.includes("lead")&&<td><Link className="link" href={`/leads/${lead.id}`}><strong>{lead.leadNumber??lead.company}</strong></Link><br/><small>{lead.company} · {lead.contactName}</small></td>}{columns.includes("source")&&<td>{source[lead.source]}</td>}{columns.includes("status")&&<td><span className="badge">{statusLabel[lead.status]}</span></td>}{columns.includes("score")&&<td>{lead.score} · {lead.temperature}</td>}{columns.includes("followUp")&&<td>{lead.nextFollowUpAt?.toLocaleString("th-TH",{timeZone:"Asia/Bangkok"})??"—"}</td>}{columns.includes("owner")&&<td>{lead.owner.name}</td>}{columns.includes("actions")&&<td><Link className="secondary" href={`/leads/${lead.id}`}>{lead.status==="CONVERTED"?"ดูข้อมูล":"เปิด / แก้ไข"}</Link></td>}</tr>)}</tbody></table>{!leads.length&&<div className="empty">ไม่พบ Lead ตามตัวกรองและสิทธิ์ปัจจุบัน</div>}</div>
      <div className="card-body actions"><span>หน้า {page} / {Math.max(1,Math.ceil(total/50))}</span>{page>1&&<Link className="secondary" href={href(page-1)}>ก่อนหน้า</Link>}{page*50<total&&<Link className="secondary" href={href(page+1)}>ถัดไป</Link>}</div>
    </section></>}
  </>;
}
