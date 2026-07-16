"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import type { FormState } from "@/app/action-types";
import { addLeadActivity, assignLead, convertLead, qualifyLead, updateLead } from "@/app/actions/lead";
import { ACTIVITY_TYPES, FLOWS, LEAD_SOURCES, LEAD_STATUSES, SEGMENTS } from "@/lib/constants";

import { FormField, Input, Textarea } from "./form-field";
import { FormNotice, Notice } from "./notice";

const initial: FormState = {};
type LeadValue = { id:string; version:number; company:string; contactName:string; contactEmail:string|null; contactPhone:string|null; source:string; status:string; score:number; recommendedProducts:string|null; notes:string|null; disqualificationReason?:string|null; customerId:string|null };
type CustomerOption = { id:string; name:string; taxId:string; province:string };
type OwnerOption = { id:string; name:string; email:string };

export function LeadLifecycleForm({ lead, canArchive }: { lead: LeadValue; canArchive: boolean }) {
  const [state, action, pending] = useActionState(updateLead.bind(null, lead.id, lead.version), initial);
  const key = useState(() => crypto.randomUUID())[0];
  return <form action={action} className="card form-card"><div className="card-body"><div className="form-section"><h2>จัดการวงจรข้อมูล Lead</h2><p>Lead จะไม่ถูกลบ กิจกรรม อีเมล การประชุม และบันทึกทั้งหมดยังคงอยู่</p><input type="hidden" name="idempotencyKey" value={key}/><input type="hidden" name="company" value={lead.company}/><input type="hidden" name="contactName" value={lead.contactName}/><input type="hidden" name="contactEmail" value={lead.contactEmail??""}/><input type="hidden" name="contactPhone" value={lead.contactPhone??""}/><input type="hidden" name="source" value={lead.source}/><input type="hidden" name="score" value={lead.score}/><input type="hidden" name="recommendedProducts" value={lead.recommendedProducts??""}/><input type="hidden" name="notes" value={lead.notes??""}/><input type="hidden" name="customerId" value={lead.customerId??""}/><FormField label="เหตุผล" name="disqualificationReason" required error={state.errors?.disqualificationReason}><Textarea name="disqualificationReason" minLength={2} required/></FormField></div><FormNotice state={state}/><div className="actions"><button className="secondary" name="status" value="INVALID" disabled={pending}>Mark Invalid</button>{canArchive&&<button className="danger-secondary" name="status" value="ARCHIVED" disabled={pending}>Archive Lead</button>}</div></div></form>;
}

export function LeadAssignForm({ lead, owners }: { lead: LeadValue; owners: OwnerOption[] }) {
  const [state, action, pending] = useActionState(assignLead.bind(null, lead.id, lead.version), initial);
  const key = useState(() => crypto.randomUUID())[0];
  return <form action={action} className="card form-card"><div className="card-body"><input type="hidden" name="idempotencyKey" value={key}/><div className="form-section"><h2>Assign / Reassign Lead</h2><div className="form-grid"><FormField label="ผู้รับผิดชอบใหม่" name="ownerId" required><select id="ownerId" className="control" name="ownerId" required defaultValue=""><option value="" disabled>เลือกผู้รับผิดชอบ</option>{owners.map(owner=><option key={owner.id} value={owner.id}>{owner.name} — {owner.email}</option>)}</select></FormField><FormField label="เหตุผล" name="reason" required error={state.errors?.reason}><Input name="reason" minLength={5} required error={!!state.errors?.reason}/></FormField></div></div><FormNotice state={state}/><div className="actions"><button className="primary" disabled={pending}>{pending?"กำลังมอบหมาย…":"ยืนยันการมอบหมาย"}</button></div></div></form>;
}

export function LeadActivityForm({ leadId }: { leadId: string }) {
  const [state, action, pending] = useActionState(addLeadActivity.bind(null, leadId), initial);
  const key = useState(() => crypto.randomUUID())[0];
  return <form action={action} className="card form-card"><div className="card-body"><input type="hidden" name="idempotencyKey" value={key}/><div className="form-section"><h2>บันทึกกิจกรรมและ Follow-up</h2><div className="form-grid"><FormField label="หัวข้อ" name="subject" required error={state.errors?.subject}><Input name="subject" required error={!!state.errors?.subject}/></FormField><FormField label="ประเภท" name="type" required><select id="type" className="control" name="type" defaultValue="CALL">{ACTIVITY_TYPES.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></FormField><FormField label="วันเวลากิจกรรม" name="activityAt" required error={state.errors?.activityAt}><Input name="activityAt" type="datetime-local" required error={!!state.errors?.activityAt}/></FormField><FormField label="ติดตามครั้งถัดไป" name="nextFollowUpAt"><Input name="nextFollowUpAt" type="datetime-local"/></FormField><div className="field full"><FormField label="รายละเอียด / Outcome / Next action" name="notes"><Textarea name="notes"/></FormField></div></div></div><FormNotice state={state}/><div className="actions"><button className="primary" disabled={pending}>{pending?"กำลังบันทึก…":"บันทึกกิจกรรม"}</button></div></div></form>;
}

const qualificationItems = [["need","มีความต้องการชัดเจน"],["serviceArea","อยู่ในพื้นที่ให้บริการ"],["budget","มีงบประมาณหรือแหล่งงบ"],["authority","ระบุผู้มีอำนาจตัดสินใจ"],["timeline","มีกรอบเวลาจัดซื้อ"],["productFit","บริการ NT ตอบโจทย์"],["legalClearance","ไม่มีข้อจำกัดกฎหมาย/COI"],["verifiedContact","ข้อมูลติดต่อผ่านการตรวจสอบ"]] as const;
export function LeadQualificationForm({ lead }: { lead: LeadValue }) {
  const [state, action, pending] = useActionState(qualifyLead.bind(null, lead.id, lead.version), initial); const key=useState(()=>crypto.randomUUID())[0];
  return <form action={action} className="card form-card"><div className="card-body"><input type="hidden" name="idempotencyKey" value={key}/><div className="form-section"><h2>Qualification Checklist</h2><p>ระบบคำนวณ completeness และ Lead Score ใหม่เมื่อยืนยัน</p><div className="form-grid">{qualificationItems.map(([key,label])=><label key={key}><input type="checkbox" name={key}/> {label}</label>)}<div className="field full"><FormField label="สรุปความต้องการ" name="requirementSummary" required error={state.errors?.requirementSummary}><Textarea name="requirementSummary" minLength={5} required error={!!state.errors?.requirementSummary}/></FormField></div><FormField label="มูลค่าประมาณการ (บาท)" name="estimatedBudget" required error={state.errors?.estimatedBudget}><Input name="estimatedBudget" type="number" min="0" step="0.0001" required error={!!state.errors?.estimatedBudget}/></FormField><FormField label="เหตุผล Manager Override (เมื่อ checklist ไม่ครบ)" name="overrideReason"><Input name="overrideReason" minLength={5}/></FormField></div></div><FormNotice state={state}/><div className="actions"><button className="primary" disabled={pending}>{pending?"กำลังประเมิน…":"ยืนยัน Qualification"}</button></div></div></form>;
}

export function LeadEditForm({ lead, customers }: { lead: LeadValue; customers: CustomerOption[] }) {
  const [state, action, pending] = useActionState(updateLead.bind(null, lead.id, lead.version), initial);
  const key = useState(() => crypto.randomUUID())[0];
  return <form action={action} className="card form-card"><div className="card-body"><input type="hidden" name="idempotencyKey" value={key}/><div className="form-section"><h2>แก้ไข Lead</h2><p>Version {lead.version} · ระบบจะป้องกันการบันทึกทับข้อมูลใหม่กว่า</p><div className="form-grid">
    <FormField label="บริษัท" name="company" required error={state.errors?.company}><Input id="company" name="company" defaultValue={lead.company} required error={!!state.errors?.company}/></FormField>
    <FormField label="ชื่อผู้ติดต่อ" name="contactName" required error={state.errors?.contactName}><Input id="contactName" name="contactName" defaultValue={lead.contactName} required error={!!state.errors?.contactName}/></FormField>
    <FormField label="อีเมล" name="contactEmail" error={state.errors?.contactEmail}><Input id="contactEmail" name="contactEmail" type="email" defaultValue={lead.contactEmail ?? ""} error={!!state.errors?.contactEmail}/></FormField>
    <FormField label="โทรศัพท์" name="contactPhone"><Input id="contactPhone" name="contactPhone" defaultValue={lead.contactPhone ?? ""}/></FormField>
    <FormField label="แหล่งที่มา" name="source" required><select id="source" name="source" className="control" defaultValue={lead.source}>{LEAD_SOURCES.map(([value,label])=><option value={value} key={value}>{label}</option>)}</select></FormField>
    <FormField label="สถานะ" name="status" required error={state.errors?.status}><select id="status" name="status" className="control" defaultValue={lead.status}>{LEAD_STATUSES.filter(([value])=>value!=="CONVERTED").map(([value,label])=><option value={value} key={value}>{label}</option>)}</select></FormField>
    <FormField label="Lead Score" name="score" required><Input id="score" name="score" type="number" min="0" max="100" defaultValue={lead.score} required/></FormField>
    <FormField label="Customer ที่เชื่อมอยู่" name="customerId"><select id="customerId" name="customerId" className="control" defaultValue={lead.customerId ?? ""}><option value="">ยังไม่เชื่อม Customer</option>{customers.map(customer=><option key={customer.id} value={customer.id}>{customer.name} ({customer.taxId})</option>)}</select></FormField>
    <div className="field full"><FormField label="สินค้าที่แนะนำ" name="recommendedProducts"><Input id="recommendedProducts" name="recommendedProducts" defaultValue={lead.recommendedProducts ?? ""}/></FormField></div>
    <div className="field full"><FormField label="บันทึก" name="notes"><Textarea id="notes" name="notes" defaultValue={lead.notes ?? ""}/></FormField></div>
    <div className="field full"><FormField label="เหตุผล Disqualified" name="disqualificationReason" error={state.errors?.disqualificationReason}><Textarea id="disqualificationReason" name="disqualificationReason" defaultValue={lead.disqualificationReason ?? ""}/></FormField></div>
  </div></div><FormNotice state={state}/><div className="actions"><button className="primary" disabled={pending}>{pending?"กำลังบันทึก…":"บันทึกการแก้ไข"}</button></div></div></form>;
}

export function LeadConvertForm({ lead, customers, duplicateCandidates }: { lead: LeadValue; customers: CustomerOption[]; duplicateCandidates: CustomerOption[] }) {
  const [mode, setMode] = useState<"CREATE"|"LINK">(lead.customerId||duplicateCandidates.length ? "LINK" : "CREATE");
  const [state, action, pending] = useActionState(convertLead.bind(null, lead.id, lead.version), initial);
  const key = useState(() => crypto.randomUUID())[0];
  return <section className="card"><div className="card-header"><div><strong>Convert เป็น Customer</strong><small>ทำรายการครั้งเดียวแบบ idempotent พร้อม audit</small></div></div><div className="card-body">
    {lead.status!=="QUALIFIED"&&<Notice variant="warning">Lead ต้องอยู่สถานะ “ผ่านการคัดกรอง” ก่อน Convert กรุณาแก้ไขสถานะและบันทึกก่อน</Notice>}
    {duplicateCandidates.length>0&&<Notice variant="warning"><strong>พบ Customer ชื่อเดียวกัน {duplicateCandidates.length} รายการ</strong>{duplicateCandidates.map(customer=><p key={customer.id}><Link className="link" href={`/customers/${customer.id}`}>{customer.name}</Link> · {customer.taxId} · {customer.province}</p>)}</Notice>}
    <div className="actions"><button type="button" className={mode==="LINK"?"primary":"secondary"} onClick={()=>setMode("LINK")}>เชื่อม Customer เดิม</button><button type="button" className={mode==="CREATE"?"primary":"secondary"} onClick={()=>setMode("CREATE")}>สร้าง Customer ใหม่</button></div>
    <form action={action} style={{marginTop:20}}><input type="hidden" name="idempotencyKey" value={key}/><input type="hidden" name="conversionMode" value={mode}/><div className="form-grid">
      {mode==="LINK"?<FormField label="Customer ที่ต้องการเชื่อม" name="existingCustomerId" required><select id="existingCustomerId" name="existingCustomerId" className="control" defaultValue={lead.customerId??duplicateCandidates[0]?.id??""} required><option value="" disabled>เลือก Customer</option>{customers.map(customer=><option key={customer.id} value={customer.id}>{customer.name} ({customer.taxId})</option>)}</select></FormField>:<>
        <FormField label="เลขนิติบุคคล" name="taxId" required error={state.errors?.taxId}><Input id="taxId" name="taxId" inputMode="numeric" pattern="[0-9]{13}" required error={!!state.errors?.taxId}/></FormField>
        <FormField label="ประเภทลูกค้า" name="type" required><select id="type" name="type" className="control" defaultValue="B2B"><option value="B2G">B2G — ภาครัฐ</option><option value="B2B">B2B — ภาคเอกชน</option></select></FormField>
        <FormField label="Segment" name="segment" required><select id="segment" name="segment" className="control" defaultValue="" required><option value="" disabled>เลือก Segment</option>{SEGMENTS.map(segment=><option key={segment}>{segment}</option>)}</select></FormField>
        <FormField label="จังหวัด" name="province" required><Input id="province" name="province" required/></FormField>
        {duplicateCandidates.length>0&&<div className="field full"><FormField label="เหตุผลที่สร้างใหม่แม้พบรายการซ้ำ" name="duplicateOverrideReason" required><Textarea id="duplicateOverrideReason" name="duplicateOverrideReason" minLength={5} required/></FormField></div>}
      </>}
      <div className="field full"><h3>ข้อมูล Opportunity</h3></div>
      <FormField label="ชื่อ Opportunity" name="opportunityName" required error={state.errors?.opportunityName}><Input id="opportunityName" name="opportunityName" defaultValue={`${lead.company} — ${lead.recommendedProducts??"โอกาสขายใหม่"}`} required error={!!state.errors?.opportunityName}/></FormField>
      <FormField label="Sales Flow" name="opportunityFlow" required><select id="opportunityFlow" name="opportunityFlow" className="control" defaultValue="" required><option value="" disabled>เลือก Flow</option>{FLOWS.map(flow=><option key={flow} value={flow}>{flow}</option>)}</select></FormField>
      <FormField label="มูลค่าประมาณการ (บาท)" name="estimatedValue" required error={state.errors?.estimatedValue}><Input id="estimatedValue" name="estimatedValue" type="number" min="0" step="0.0001" required error={!!state.errors?.estimatedValue}/></FormField>
      <FormField label="วันที่คาดว่าจะปิด" name="expectedCloseAt" required error={state.errors?.expectedCloseAt}><Input id="expectedCloseAt" name="expectedCloseAt" type="date" required error={!!state.errors?.expectedCloseAt}/></FormField>
      <FormField label="โอกาสชนะ (%)" name="probability" required><Input id="probability" name="probability" type="number" min="0" max="100" defaultValue="40" required/></FormField>
      <FormField label="สินค้า/บริการที่สนใจ" name="productInterest"><Input id="productInterest" name="productInterest" defaultValue={lead.recommendedProducts??""}/></FormField>
    </div><FormNotice state={state}/><div className="actions"><button className="primary" disabled={pending||lead.status!=="QUALIFIED"}>{pending?"กำลัง Convert…":mode==="LINK"?"เชื่อมและสร้าง Opportunity":"สร้าง Customer, Contact และ Opportunity"}</button></div></form>
  </div></section>;
}
