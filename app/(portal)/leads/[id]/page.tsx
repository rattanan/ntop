import Link from "next/link";
import { notFound } from "next/navigation";

import { LeadActivityForm, LeadAssignForm, LeadConvertForm, LeadEditForm, LeadLifecycleForm, LeadQualificationForm } from "@/components/lead-workflow-forms";
import { requireSession } from "@/lib/auth";
import { loadAuthorizationContext } from "@/lib/authorization/authorization-context";
import { PERMISSIONS, permissionPolicy } from "@/lib/authorization/permission-policy";
import { buildCustomerScopeWhere } from "@/lib/customer/customer-query-service";
import { buildLeadScopeWhere } from "@/lib/lead/prisma-lead-repository";
import { LEAD_ACTIVITY_ROLES, LEAD_ASSIGNER_ROLES, LEAD_CORE_UPDATE_ROLES, LEAD_QUALIFIABLE_STATUSES } from "@/lib/lead/lead-rules";
import { prisma } from "@/lib/prisma";

const source:Record<string,string>={IMPORT:"Import",WEBSITE:"Website",EVENT:"Event",PARTNER:"Partner",REFERRAL:"Referral",EXISTING_CUSTOMER:"Existing Customer"};
const status:Record<string,string>={NEW:"ใหม่",ASSIGNED:"มอบหมายแล้ว",CONTACTED:"ติดต่อแล้ว",QUALIFIED:"ผ่านการคัดกรอง",NURTURING:"กำลังติดตาม",CONVERTED:"แปลงเป็นลูกค้า",DISQUALIFIED:"ไม่ผ่าน",INVALID:"ข้อมูลไม่ถูกต้อง",DUPLICATE:"ข้อมูลซ้ำ",NOT_INTERESTED:"ไม่สนใจ",NO_BUDGET:"ไม่มีงบประมาณ",ARCHIVED:"เก็บถาวร"};

export default async function LeadDetail({params}:{params:Promise<{id:string}>}){
  const {id}=await params;
  const session=await requireSession();
  const context=await loadAuthorizationContext({actorId:session.id,legacyRole:session.role});
  const lead=await prisma.lead.findFirst({where:{id,...buildLeadScopeWhere(context)},include:{owner:true,customer:true,statusHistory:{include:{actor:true},orderBy:{transitionedAt:"desc"},take:50},assignmentHistory:{include:{actor:true},orderBy:{assignedAt:"desc"},take:50},activities:{where:{deletedAt:null},include:{owner:true},orderBy:{createdAt:"desc"},take:100},opportunity:true}});
  if(!lead)notFound();
  const customerScope=buildCustomerScopeWhere(context);
  const organizationUnitIds=context.assignments.flatMap(item=>item.organizationUnitId?[item.organizationUnitId]:[]);const enterprise=context.assignments.some(item=>item.scope==="ENTERPRISE");
  const [customers,duplicateCandidates,owners]=await Promise.all([
    prisma.customer.findMany({where:{AND:[{mergedIntoCustomerId:null},customerScope]},select:{id:true,name:true,taxId:true,province:true},orderBy:{name:"asc"},take:200}),
    prisma.customer.findMany({where:{AND:[{mergedIntoCustomerId:null,name:lead.company},customerScope]},select:{id:true,name:true,taxId:true,province:true},orderBy:{updatedAt:"desc"},take:20}),
    prisma.user.findMany({where:{active:true,...(!enterprise?{OR:[{id:session.id},...(organizationUnitIds.length?[{enterpriseRoleAssignments:{some:{organizationUnitId:{in:organizationUnitIds},active:true}}}]:[])]}:{})},select:{id:true,name:true,email:true},orderBy:{name:"asc"},take:200}),
  ]);
  const roleCodes=context.assignments.map(item=>item.role);const canArchive=roleCodes.length>0&&(await prisma.rolePermissionGrant.count({where:{roleCode:{in:roleCodes},permissionCode:PERMISSIONS.leadArchive}}))>0;
  const activeLead=lead.status!=="CONVERTED"&&lead.status!=="ARCHIVED";
  const canCoreUpdate=activeLead&&permissionPolicy.allows(session,PERMISSIONS.recordUpdate)&&context.assignments.some(item=>(LEAD_CORE_UPDATE_ROLES as readonly string[]).includes(item.role));
  const canAddActivity=activeLead&&context.assignments.some(item=>(LEAD_ACTIVITY_ROLES as readonly string[]).includes(item.role));
  const canAssign=context.assignments.some(item=>(LEAD_ASSIGNER_ROLES as readonly string[]).includes(item.role));
  const formValue={id:lead.id,version:lead.version,company:lead.company,contactName:lead.contactName,contactEmail:lead.contactEmail,contactPhone:lead.contactPhone,source:lead.source,status:lead.status,score:lead.score,recommendedProducts:lead.recommendedProducts,notes:lead.notes,disqualificationReason:lead.disqualificationReason,customerId:lead.customerId};
  return <><div className="page-head"><div><p className="eyebrow">Lead 360 · v{lead.version}</p><h1>{lead.company}</h1><p>{lead.contactName} · {source[lead.source]}</p></div><Link className="secondary" href="/leads">กลับรายการ Lead</Link></div>
    <section className="card"><div className="card-header"><div><strong>ภาพรวม Lead</strong><small>อัปเดตล่าสุด {lead.updatedAt.toLocaleString("th-TH",{timeZone:"Asia/Bangkok"})}</small></div><span className="badge">{status[lead.status]}</span></div><div className="card-body detail-grid">
      <div><p className="detail-label">ผู้ติดต่อ</p><p className="detail-value">{lead.contactName}</p><small>{lead.contactEmail||lead.contactPhone||"—"}</small></div>
      <div><p className="detail-label">Lead Score</p><p className="detail-value">{lead.score}/100</p></div>
      <div><p className="detail-label">Temperature</p><p className="detail-value">{lead.temperature}</p></div>
      <div><p className="detail-label">ผู้รับผิดชอบ</p><p className="detail-value">{lead.owner.name}</p></div>
      <div><p className="detail-label">สินค้าที่แนะนำ</p><p className="detail-value">{lead.recommendedProducts||"—"}</p></div>
    </div>{lead.requirementSummary&&<div className="card-body"><p className="detail-label">สรุปความต้องการ</p><p>{lead.requirementSummary}</p></div>}{lead.notes&&<div className="card-body"><p className="detail-label">บันทึก</p><p>{lead.notes}</p></div>}</section>
    <section className="card" style={{marginTop:20}}><div className="card-header"><div><strong>กิจกรรมและประวัติ</strong><small>Timeline ตามเวลาที่บันทึกในฐานข้อมูล</small></div></div><div className="card-body">
      {lead.activities.map(item=><p key={item.id}><strong>{item.subject}</strong> · {item.type} · {item.owner.name}<br/><small>{item.createdAt.toLocaleString("th-TH",{timeZone:"Asia/Bangkok"})}</small></p>)}
      {lead.statusHistory.map(item=><p key={item.id}><strong>{status[item.fromStatus]} → {status[item.toStatus]}</strong> โดย {item.actor.name}{item.reason?` · ${item.reason}`:""}<br/><small>{item.transitionedAt.toLocaleString("th-TH",{timeZone:"Asia/Bangkok"})}</small></p>)}
      {lead.assignmentHistory.map(item=><p key={item.id}><strong>มอบหมายผู้รับผิดชอบ</strong> โดย {item.actor.name}{item.reason?` · ${item.reason}`:""}<br/><small>{item.assignedAt.toLocaleString("th-TH",{timeZone:"Asia/Bangkok"})}</small></p>)}
      {!lead.activities.length&&!lead.statusHistory.length&&!lead.assignmentHistory.length&&<p className="empty">ยังไม่มีประวัติกิจกรรม</p>}
    </div></section>
    {lead.customer&&<p className="notice" style={{marginTop:20}}>Lead นี้เชื่อมกับ Customer แล้ว: <Link className="link" href={`/customers/${lead.customer.id}`}>{lead.customer.name}</Link></p>}
    {(canAddActivity||canCoreUpdate)&&<div className="lead-workflow-stack">{canAddActivity&&<LeadActivityForm leadId={lead.id}/>} {canCoreUpdate&&<>{canAssign&&<LeadAssignForm lead={formValue} owners={owners}/>} {(LEAD_QUALIFIABLE_STATUSES as readonly string[]).includes(lead.status)&&<LeadQualificationForm lead={formValue}/>}<LeadLifecycleForm lead={formValue} canArchive={canArchive}/><LeadEditForm lead={formValue} customers={customers}/><LeadConvertForm lead={formValue} customers={customers} duplicateCandidates={duplicateCandidates}/></>}</div>}
    {!canAddActivity&&!canCoreUpdate&&activeLead&&<p className="notice" style={{marginTop:20}}>บัญชีนี้ไม่มีสิทธิ์แก้ไขหรือ Convert Lead</p>}
  </>;
}
