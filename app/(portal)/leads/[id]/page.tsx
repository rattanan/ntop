import { ArrowRight, Pencil } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { LeadActivityDialog,LeadAssignDialog,LeadConversionActions,LeadDocumentPanel,LeadInsightPanel,type LeadInsightDraft } from "@/components/lead-detail-actions";
import { LeadLifecycleForm,LeadQualificationForm } from "@/components/lead-workflow-forms";
import { requireSession } from "@/lib/auth";
import { loadAssignableOwnerOptions,loadAuthorizationContext } from "@/lib/authorization/authorization-context";
import { PERMISSIONS,permissionPolicy } from "@/lib/authorization/permission-policy";
import { loadCustomerClassifications } from "@/lib/customer/customer-classification";
import { buildCustomerScopeWhere } from "@/lib/customer/customer-query-service";
import { loadProvinceOptions } from "@/lib/customer/province-reference";
import { buildLeadScopeWhere } from "@/lib/lead/prisma-lead-repository";
import { LEAD_ACTIVITY_ROLES,LEAD_ASSIGNER_ROLES,LEAD_CORE_UPDATE_ROLES,LEAD_QUALIFIABLE_STATUSES } from "@/lib/lead/lead-rules";
import { formatMoney } from "@/lib/number-format";
import { prisma } from "@/lib/prisma";

const source:Record<string,string>={IMPORT:"Import",WEBSITE:"Website",EVENT:"Event",PARTNER:"Partner",REFERRAL:"Referral",EXISTING_CUSTOMER:"Existing Customer",MARKETING_CAMPAIGN:"Marketing Campaign",API:"API",GOVERNMENT_TENDER:"Government Tender"};
const status:Record<string,string>={NEW:"ใหม่",ASSIGNED:"มอบหมายแล้ว",CONTACTED:"ติดต่อแล้ว",QUALIFIED:"ผ่านการคัดกรอง",NURTURING:"กำลังติดตาม",CONVERTED:"แปลงแล้ว",DISQUALIFIED:"ไม่ผ่าน",INVALID:"ข้อมูลไม่ถูกต้อง",DUPLICATE:"ข้อมูลซ้ำ",NOT_INTERESTED:"ไม่สนใจ",NO_BUDGET:"ไม่มีงบประมาณ",ARCHIVED:"เก็บถาวร"};
function insightDraft(value:unknown):LeadInsightDraft|null{if(!value||typeof value!=="object")return null;const output=(value as{output?:unknown}).output;if(!output||typeof output!=="object")return null;const item=output as Record<string,unknown>;if(typeof item.companySummary!=="string"||typeof item.opportunityScore!=="number"||typeof item.riskScore!=="number"||typeof item.confidenceScore!=="number"||!Array.isArray(item.recommendedProducts)||typeof item.suggestedNextAction!=="string")return null;return{companySummary:item.companySummary,opportunityScore:item.opportunityScore,riskScore:item.riskScore,confidenceScore:item.confidenceScore,recommendedProducts:item.recommendedProducts.filter((entry):entry is string=>typeof entry==="string"),suggestedNextAction:item.suggestedNextAction};}
function gaugeColor(temperature:string){return temperature==="HOT"?"#dc2626":temperature==="WARM"?"#d97706":"#2563eb";}
function bytes(value:number){return new Intl.NumberFormat("th-TH",{maximumFractionDigits:1}).format(value/1_000_000)+" MB";}

export default async function LeadDetail({params}:{params:Promise<{id:string}>}){
  const{id}=await params,session=await requireSession(),context=await loadAuthorizationContext({actorId:session.id,legacyRole:session.role});
  const lead=await prisma.lead.findFirst({where:{id,...buildLeadScopeWhere(context)},include:{owner:true,customer:true,statusHistory:{include:{actor:true},orderBy:{transitionedAt:"desc"},take:50},assignmentHistory:{include:{actor:true},orderBy:{assignedAt:"desc"},take:50},activities:{where:{deletedAt:null},include:{owner:true},orderBy:{createdAt:"desc"},take:100},opportunity:true,salesDocuments:{where:{deletedAt:null},orderBy:{createdAt:"desc"},take:100}}});
  if(!lead)notFound();
  const canAssign=context.assignments.some(item=>(LEAD_ASSIGNER_ROLES as readonly string[]).includes(item.role)),customerScope=buildCustomerScopeWhere(context);
  const[customers,duplicateCandidates,owners,classifications,provinces]=await Promise.all([
    prisma.customer.findMany({where:{AND:[{mergedIntoCustomerId:null},customerScope]},select:{id:true,name:true,taxId:true,province:true},orderBy:{name:"asc"},take:200}),
    prisma.customer.findMany({where:{AND:[{mergedIntoCustomerId:null,name:lead.company},customerScope]},select:{id:true,name:true,taxId:true,province:true},orderBy:{updatedAt:"desc"},take:20}),
    canAssign?loadAssignableOwnerOptions(context):Promise.resolve([]),loadCustomerClassifications(),loadProvinceOptions(),
  ]);
  const roleCodes=context.assignments.map(item=>item.role),canArchive=roleCodes.length>0&&(await prisma.rolePermissionGrant.count({where:{roleCode:{in:roleCodes},permissionCode:PERMISSIONS.leadArchive}}))>0,activeLead=lead.status!=="CONVERTED"&&lead.status!=="ARCHIVED",canCoreUpdate=activeLead&&permissionPolicy.allows(session,PERMISSIONS.recordUpdate)&&context.assignments.some(item=>(LEAD_CORE_UPDATE_ROLES as readonly string[]).includes(item.role)),canAddActivity=activeLead&&context.assignments.some(item=>(LEAD_ACTIVITY_ROLES as readonly string[]).includes(item.role));
  const formValue={id:lead.id,version:lead.version,company:lead.company,companyNameEnglish:lead.companyNameEnglish,taxId:lead.taxId,branchNumber:lead.branchNumber,customerType:lead.customerType,segment:lead.segment,subIndustry:lead.subIndustry,companySize:lead.companySize,numberOfEmployees:lead.numberOfEmployees,website:lead.website,address:lead.address,subDistrict:lead.subDistrict,district:lead.district,province:lead.province,postalCode:lead.postalCode,region:lead.region,currentTelecomProvider:lead.currentTelecomProvider,currentInternetProvider:lead.currentInternetProvider,currentCloudProvider:lead.currentCloudProvider,currentSecurityProvider:lead.currentSecurityProvider,contactName:lead.contactName,jobTitle:lead.jobTitle,department:lead.department,contactEmail:lead.contactEmail,contactPhone:lead.contactPhone,source:lead.source,status:lead.status,score:lead.score,recommendedProducts:lead.recommendedProducts,requirementSummary:lead.requirementSummary,estimatedBudget:lead.estimatedBudget?.toString()??null,expectedPurchaseAt:lead.expectedPurchaseAt?.toISOString().slice(0,10)??null,notes:lead.notes,disqualificationReason:lead.disqualificationReason,customerId:lead.customerId};
  const draft=lead.enrichmentStatus==="READY"?insightDraft(lead.enrichmentData):null;
  const timelineItems=[
    ...lead.activities.map(item=>({id:`activity:${item.id}`,kind:"activity" as const,label:"Activity",title:item.subject,detail:item.notes,meta:`${item.type} · ${item.owner.name}`,at:item.createdAt})),
    ...lead.statusHistory.map(item=>({id:`status:${item.id}`,kind:"status" as const,label:"Status",title:`${status[item.fromStatus]} → ${status[item.toStatus]}`,detail:item.reason,meta:`โดย ${item.actor.name}`,at:item.transitionedAt})),
    ...lead.assignmentHistory.map(item=>({id:`assignment:${item.id}`,kind:"assignment" as const,label:"Owner",title:"มอบหมายผู้รับผิดชอบ",detail:item.reason,meta:`โดย ${item.actor.name}`,at:item.assignedAt})),
  ].sort((left,right)=>right.at.getTime()-left.at.getTime());
  return <>
    <div className="page-head"><div><p className="eyebrow">Lead 360 · v{lead.version}</p><h1>{lead.company}</h1><p>{lead.contactName} · {source[lead.source]??lead.source}</p></div><div className="actions record-head-actions">{lead.customer&&<Link className="secondary" href={`/customers/${lead.customer.id}`}>เปิด Customer</Link>}{lead.opportunity&&<Link className="primary" href={`/opportunities/${lead.opportunity.id}`}>เปิด Opportunity<ArrowRight aria-hidden="true"/></Link>}{canCoreUpdate&&<Link className="secondary" href={`/leads/${id}/edit`}><Pencil aria-hidden="true"/>แก้ไข</Link>}<Link className="secondary" href="/leads">กลับรายการ Lead</Link></div></div>
    <div className="lead-overview-row">
    <section className="card lead-overview-card"><div className="card-header lead-section-header"><div><strong>ภาพรวม Lead</strong><small>อัปเดตล่าสุด {lead.updatedAt.toLocaleString("th-TH",{timeZone:"Asia/Bangkok"})}</small></div><span className="badge">{status[lead.status]}</span></div><div className="card-body detail-grid">
      <div><p className="detail-label">ผู้ติดต่อ</p><p className="detail-value">{lead.contactName}</p><small>{[lead.contactEmail,lead.contactPhone].filter(Boolean).join(" · ")||"—"}</small></div>
      <div><p className="detail-label">Lead Score <span className="metric-help" title="คะแนนจากกฎ Qualification: 0–39 Cold, 40–69 Warm, 70–100 Hot คะแนนนี้ไม่ใช่คะแนน AI">?</span></p><div className="lead-score-summary"><div className="lead-score-gauge" style={{"--score":lead.score,"--gauge":gaugeColor(lead.temperature)} as React.CSSProperties}><span className="lead-score-gauge-value">{lead.score}/100</span></div><span className={`badge temperature-badge ${lead.temperature.toLowerCase()}`}>{lead.temperature}</span></div></div>
      <div><p className="detail-label">ผู้รับผิดชอบ</p><p className="detail-value">{lead.owner.name}{canAssign&&canCoreUpdate&&<LeadAssignDialog lead={formValue} owners={owners}/>}</p></div>
      <div><p className="detail-label">Segment / Sub-industry</p><p className="detail-value">{[lead.segment,lead.subIndustry].filter(Boolean).join(" · ")||"—"}</p><small>{lead.companySize?`ขนาด ${lead.companySize}`:""}</small></div>
      <div><p className="detail-label">Estimated Value</p><p className="detail-value">{formatMoney(lead.estimatedBudget)}</p></div>
      <div><p className="detail-label">Target Close Date</p><p className="detail-value">{lead.expectedPurchaseAt?.toLocaleDateString("th-TH",{timeZone:"Asia/Bangkok"})??"—"}</p></div>
      <div><p className="detail-label">จังหวัด</p><p className="detail-value">{lead.province??"—"}</p></div>
      <div><p className="detail-label">สินค้าที่แนะนำ</p><p className="detail-value" data-expandable-text>{lead.recommendedProducts||"—"}</p></div>
    </div>{lead.requirementSummary&&<div className="card-body"><p className="detail-label">สรุปความต้องการ</p><p data-expandable-text>{lead.requirementSummary}</p></div>}{lead.notes&&<div className="card-body"><p className="detail-label">บันทึก</p><p data-expandable-text>{lead.notes}</p></div>}</section>
    <LeadInsightPanel id={id} status={lead.enrichmentStatus} canUpdate={canCoreUpdate} initialDraft={draft} summary={lead.aiSummary} scores={{opportunity:lead.aiOpportunityScore,risk:lead.aiRiskScore,confidence:lead.aiConfidenceScore}} updatedAt={lead.enrichmentUpdatedAt?.toLocaleString("th-TH",{timeZone:"Asia/Bangkok"})??null}/>
    </div>

    <section className="card lead-documents"><div className="card-header lead-section-header"><div><strong>เอกสาร Lead</strong><small>เอกสารจาก Prospect จะแสดงอัตโนมัติหลัง Convert โดยไม่สร้างไฟล์ซ้ำ</small></div><span className="badge muted">{lead.salesDocuments.length} files</span></div><div className="card-body"><LeadDocumentPanel id={id} documents={lead.salesDocuments.map(item=>({id:item.id,fileName:item.fileName,category:item.category,mimeType:item.mimeType,formattedSize:bytes(item.sizeBytes)}))} canUpdate={canCoreUpdate}/></div></section>

    <section className="card lead-timeline-card"><div className="card-header lead-section-header"><div><strong>กิจกรรมและประวัติ</strong><small>เรียงตามเวลาที่บันทึกในฐานข้อมูล จากใหม่ไปเก่า</small></div><div className="lead-timeline-header-actions"><span className="badge muted">{timelineItems.length} รายการ</span>{canAddActivity&&<LeadActivityDialog leadId={lead.id}/>}</div></div><div className="card-body lead-timeline" role="list" aria-label="กิจกรรมและประวัติของ Lead">
      {timelineItems.map(item=><article className={`lead-timeline-item ${item.kind}`} role="listitem" key={item.id}><span className="lead-timeline-marker" aria-hidden="true"/><div className="lead-timeline-content"><div className="lead-timeline-title"><strong>{item.title}</strong><span className="lead-timeline-kind">{item.label}</span></div>{item.detail&&<p data-expandable-text>{item.detail}</p>}<div className="lead-timeline-meta"><span>{item.meta}</span><time dateTime={item.at.toISOString()}>{item.at.toLocaleString("th-TH",{timeZone:"Asia/Bangkok"})}</time></div></div></article>)}
      {!timelineItems.length&&<p className="empty">ยังไม่มีประวัติกิจกรรม</p>}
    </div></section>

    {canCoreUpdate&&activeLead&&!lead.opportunity&&<section className="card" style={{marginTop:20}}><div className="card-header"><div><strong>Convert Lead</strong><small>เลือก action ที่ต้องการ ระบบจะแสดงแบบฟอร์มใน popup</small></div></div><div className="card-body"><LeadConversionActions lead={formValue} customers={customers} duplicateCandidates={duplicateCandidates} classifications={classifications} provinces={provinces}/></div></section>}
    {lead.customer&&<p className="notice" style={{marginTop:20}}>Lead นี้เชื่อมกับ Customer แล้ว: <Link className="link" href={`/customers/${lead.customer.id}`}>{lead.customer.name}</Link></p>}
    {canCoreUpdate&&<div className="lead-workflow-stack">{(LEAD_QUALIFIABLE_STATUSES as readonly string[]).includes(lead.status)&&<LeadQualificationForm lead={formValue}/>}<LeadLifecycleForm lead={formValue} canArchive={canArchive}/></div>}
    {!canAddActivity&&!canCoreUpdate&&activeLead&&<p className="notice" style={{marginTop:20}}>บัญชีนี้ไม่มีสิทธิ์แก้ไขหรือ Convert Lead</p>}
  </>;
}
