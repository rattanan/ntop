"use client";

import { BrainCircuit, Check, Download, FileText, FileUp, LoaderCircle, Pencil, Plus, ShieldCheck, Sparkles, Trash2, UserRoundCog, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import { addLeadActivity, assignLead, convertLead } from "@/app/actions/lead";
import type { FormState } from "@/app/action-types";
import { FormField, Input, Textarea } from "@/components/form-field";
import { FormNotice, Notice } from "@/components/notice";
import { COMPANY_SIZE_OPTIONS, type CustomerClassificationOption } from "@/lib/customer/customer-classification";
import type { ProvinceOption } from "@/lib/customer/province-reference";
import { ACTIVITY_TYPES, FLOWS } from "@/lib/constants";

type Owner={userId:string;name:string;email:string;organizationUnitId:string;organizationUnitName:string;organizationUnitCode:string};
type Customer={id:string;name:string;taxId:string;province:string};
type Lead={id:string;version:number;company:string;taxId:string|null;customerType?:string|null;segment?:string|null;subIndustry?:string|null;companySize?:string|null;province?:string|null;contactName:string;contactEmail:string|null;contactPhone:string|null;recommendedProducts:string|null;requirementSummary:string|null;estimatedBudget:string|null;expectedPurchaseAt?:string|null;customerId:string|null};

function DialogFrame({dialogRef,title,description,children}:{dialogRef:React.RefObject<HTMLDialogElement|null>;title:string;description:string;children:React.ReactNode}){return <dialog className="record-action-dialog" ref={dialogRef} onClick={event=>{if(event.target===event.currentTarget)event.currentTarget.close();}}><div className="record-action-dialog-panel"><div className="record-action-dialog-head"><div><strong>{title}</strong><small>{description}</small></div><button type="button" className="icon-action" aria-label="ปิดหน้าต่าง" onClick={()=>dialogRef.current?.close()}><X aria-hidden="true"/></button></div>{children}</div></dialog>;}

export function LeadAssignDialog({lead,owners}:{lead:Lead;owners:Owner[]}){const ref=useRef<HTMLDialogElement>(null),router=useRouter(),[state,action,pending]=useActionState(assignLead.bind(null,lead.id,lead.version),{} as FormState),key=useState(()=>crypto.randomUUID())[0];useEffect(()=>{if(state.status!=="success"||!state.redirectTo)return;const timer=window.setTimeout(()=>{ref.current?.close();router.push(state.redirectTo!);router.refresh();},700);return()=>window.clearTimeout(timer);},[router,state.redirectTo,state.status]);return <><button className="icon-action owner-pencil" type="button" aria-label="Assign หรือ Reassign Lead" title="Assign / Reassign Lead" onClick={()=>ref.current?.showModal()}><Pencil aria-hidden="true"/></button><DialogFrame dialogRef={ref} title="Assign / Reassign Lead" description="เปลี่ยนผู้รับผิดชอบและหน่วยงาน พร้อมบันทึกเหตุผลใน audit"><form action={action} className="dialog-form"><input type="hidden" name="idempotencyKey" value={key}/><FormField label="ผู้รับผิดชอบและหน่วยงานใหม่" name="ownerAssignment" required><select className="control" name="ownerAssignment" defaultValue="" required disabled={!owners.length}><option value="" disabled>{owners.length?"เลือกผู้รับผิดชอบและหน่วยงาน":"ไม่พบผู้ใช้ที่เลือกได้"}</option>{owners.map(owner=><option key={`${owner.userId}:${owner.organizationUnitId}`} value={JSON.stringify({ownerId:owner.userId,organizationUnitId:owner.organizationUnitId})}>{owner.name} — {owner.organizationUnitName} ({owner.organizationUnitCode})</option>)}</select></FormField><FormField label="เหตุผล" name="reason" required error={state.errors?.reason}><Input name="reason" minLength={5} required/></FormField><FormNotice state={state}/><div className="actions"><button type="button" className="secondary" onClick={()=>ref.current?.close()}>ยกเลิก</button><button className="primary" disabled={pending||!owners.length}>{pending?"กำลังมอบหมาย…":"ยืนยันการมอบหมาย"}</button></div></form></DialogFrame></>}

export function LeadActivityDialog({leadId}:{leadId:string}){const ref=useRef<HTMLDialogElement>(null),router=useRouter(),[state,action,pending]=useActionState(addLeadActivity.bind(null,leadId),{} as FormState),key=useState(()=>crypto.randomUUID())[0];useEffect(()=>{if(state.status!=="success")return;const timer=window.setTimeout(()=>{ref.current?.close();router.refresh();},650);return()=>window.clearTimeout(timer);},[router,state.status]);return <><button className="secondary" type="button" onClick={()=>ref.current?.showModal()}><Plus aria-hidden="true"/>สร้าง Activity</button><DialogFrame dialogRef={ref} title="สร้าง Activity" description="บันทึกกิจกรรมและกำหนด Follow-up ของ Lead"><form action={action} className="dialog-form"><input type="hidden" name="idempotencyKey" value={key}/><div className="form-grid"><FormField label="หัวข้อ" name="subject" required error={state.errors?.subject}><Input name="subject" required/></FormField><FormField label="ประเภท" name="type" required><select className="control" name="type" defaultValue="CALL">{ACTIVITY_TYPES.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></FormField><FormField label="วันเวลากิจกรรม" name="activityAt" required error={state.errors?.activityAt}><Input name="activityAt" type="datetime-local" required/></FormField><FormField label="ติดตามครั้งถัดไป" name="nextFollowUpAt"><Input name="nextFollowUpAt" type="datetime-local"/></FormField><div className="field full"><FormField label="รายละเอียด / Outcome / Next action" name="notes"><Textarea name="notes"/></FormField></div></div><FormNotice state={state}/><div className="actions"><button type="button" className="secondary" onClick={()=>ref.current?.close()}>ยกเลิก</button><button className="primary" disabled={pending}>{pending?"กำลังบันทึก…":"บันทึก Activity"}</button></div></form></DialogFrame></>}

export function LeadConversionActions({lead,customers,duplicateCandidates,classifications,provinces}:{lead:Lead;customers:Customer[];duplicateCandidates:Customer[];classifications:CustomerClassificationOption[];provinces:ProvinceOption[]}){const ref=useRef<HTMLDialogElement>(null),router=useRouter(),[mode,setMode]=useState<"LINK"|"CREATE">("LINK"),[state,action,pending]=useActionState(convertLead.bind(null,lead.id,lead.version),{} as FormState),key=useState(()=>crypto.randomUUID())[0],[segment,setSegment]=useState(lead.segment??"");const subIndustries=classifications.find(item=>item.code===segment)?.subIndustries??[];useEffect(()=>{if(!state.redirectTo)return;const timer=window.setTimeout(()=>{router.push(state.redirectTo!);router.refresh();},900);return()=>window.clearTimeout(timer);},[router,state.redirectTo]);const open=(next:"LINK"|"CREATE")=>{setMode(next);ref.current?.showModal();};const missingContact=!lead.contactEmail&&!lead.contactPhone;return <><div className="actions"><button className="primary" type="button" onClick={()=>open("LINK")}><UserRoundCog aria-hidden="true"/>เชื่อม Customer เดิม + สร้าง Opportunity</button><button className="secondary" type="button" onClick={()=>open("CREATE")}><Plus aria-hidden="true"/>สร้าง Customer ใหม่ + Opportunity</button></div><DialogFrame dialogRef={ref} title={mode==="LINK"?"เชื่อม Customer เดิมและสร้าง Opportunity":"สร้าง Customer ใหม่และ Opportunity"} description="ระบบทำรายการแบบ transaction พร้อม audit และจะเปิด Opportunity ที่สร้างสำเร็จ"><form className="dialog-form" onSubmit={event=>{event.preventDefault();const formData=new FormData(event.currentTarget);startTransition(()=>action(formData));}}><input type="hidden" name="idempotencyKey" value={key}/><input type="hidden" name="conversionMode" value={mode}/>{duplicateCandidates.length>0&&mode==="CREATE"&&<Notice variant="warning">พบ Customer ชื่อเดียวกัน {duplicateCandidates.length} รายการ กรุณาตรวจสอบก่อนสร้างซ้ำ</Notice>}<div className="form-grid">
{mode==="LINK"?<FormField label="Customer ที่ต้องการเชื่อม" name="existingCustomerId" required><select className="control" name="existingCustomerId" defaultValue={lead.customerId??duplicateCandidates[0]?.id??""} required><option value="" disabled>เลือก Customer</option>{customers.map(item=><option key={item.id} value={item.id}>{item.name} ({item.taxId})</option>)}</select></FormField>:<><FormField label="เลขนิติบุคคล" name="taxId" required error={state.errors?.taxId}><Input name="taxId" defaultValue={lead.taxId??""} required/></FormField><FormField label="ประเภท Customer" name="type" required><select className="control" name="type" defaultValue={lead.customerType??"B2B"}><option value="B2G">B2G — ภาครัฐ</option><option value="B2B">B2B — ภาคเอกชน</option></select></FormField><FormField label="Segment" name="segment" required error={state.errors?.segment}><select className="control" name="segment" value={segment} onChange={event=>setSegment(event.target.value)} required><option value="" disabled>เลือก Segment</option>{classifications.map(item=><option key={item.code} value={item.code}>{item.code} — {item.name}</option>)}</select></FormField><FormField label="อุตสาหกรรมย่อย" name="subIndustry"><select className="control" name="subIndustry" key={segment} defaultValue={subIndustries.some(item=>item.code===lead.subIndustry)?lead.subIndustry??"":""} disabled={!segment}><option value="">ไม่ระบุ</option>{subIndustries.map(item=><option key={item.code} value={item.code}>{item.code} — {item.name}</option>)}</select></FormField><FormField label="ขนาดบริษัท" name="companySize"><select className="control" name="companySize" defaultValue={lead.companySize??""}><option value="">ไม่ระบุ</option>{COMPANY_SIZE_OPTIONS.map(item=><option key={item.code} value={item.code}>{item.code} — {item.name}</option>)}</select></FormField><FormField label="จังหวัด" name="province" required error={state.errors?.province}><Input name="province" list="lead-conversion-provinces" defaultValue={lead.province??""} required placeholder="ค้นหาจังหวัด"/><datalist id="lead-conversion-provinces">{provinces.map(item=><option key={item.code} value={item.name}>{item.code} — {item.name}</option>)}</datalist></FormField>{duplicateCandidates.length>0&&<div className="field full"><FormField label="เหตุผลที่สร้างใหม่แม้พบรายการซ้ำ" name="duplicateOverrideReason" required><Textarea name="duplicateOverrideReason" minLength={5} required/></FormField></div>}</>}
{missingContact&&<><div className="field full"><Notice variant="warning">Lead นี้ยังไม่มีอีเมลหรือโทรศัพท์ กรุณากรอกข้อมูล Contact ก่อน Convert หากยังไม่มีข้อมูล ระบบจะไม่ออกจากหน้านี้</Notice></div><FormField label="ชื่อผู้ติดต่อ" name="conversionContactName" required error={state.errors?.contactName}><Input name="conversionContactName" defaultValue={lead.contactName} required/></FormField><FormField label="อีเมลผู้ติดต่อ" name="conversionContactEmail" error={state.errors?.contactEmail}><Input name="conversionContactEmail" type="email"/></FormField><FormField label="โทรศัพท์ผู้ติดต่อ" name="conversionContactPhone" error={state.errors?.contactPhone}><Input name="conversionContactPhone"/></FormField></>}
<div className="field full"><h3>ข้อมูล Opportunity</h3></div><FormField label="ชื่อ Opportunity" name="opportunityName" required error={state.errors?.opportunityName}><Input name="opportunityName" defaultValue={`${lead.company} — ${lead.recommendedProducts??"โอกาสขายใหม่"}`} required/></FormField><FormField label="Sales Flow" name="opportunityFlow" required><select name="opportunityFlow" className="control" defaultValue="" required><option value="" disabled>เลือก Flow</option>{FLOWS.map(flow=><option key={flow}>{flow}</option>)}</select></FormField><FormField label="มูลค่าประมาณการ" name="estimatedValue" required error={state.errors?.estimatedValue}><Input name="estimatedValue" type="number" min="0" step="0.0001" defaultValue={lead.estimatedBudget??""} required/></FormField><FormField label="Expected Close Date" name="expectedCloseAt" required><Input name="expectedCloseAt" type="date" defaultValue={lead.expectedPurchaseAt??""} required/></FormField><FormField label="Probability" name="probability" required><Input name="probability" type="number" min="0" max="100" defaultValue="50" required/></FormField><div className="field full"><FormField label="Product Interest / Next action" name="productInterest"><Textarea name="productInterest" defaultValue={lead.recommendedProducts??""}/></FormField></div></div><FormNotice state={state}/><div className="actions"><button type="button" className="secondary" disabled={pending} onClick={()=>ref.current?.close()}>ยกเลิก</button><button className="primary" disabled={pending}>{pending?"กำลังสร้าง…":"ยืนยันและสร้าง Opportunity"}</button></div></form></DialogFrame></>}

export type LeadInsightDraft = {
  companySummary: string;
  opportunityScore: number;
  riskScore: number;
  confidenceScore: number;
  recommendedProducts: string[];
  suggestedNextAction: string;
};

export function LeadInsightPanel({ id, status, canUpdate, initialDraft, summary, scores, updatedAt }: { id: string; status: string; canUpdate: boolean; initialDraft: LeadInsightDraft | null; summary: string | null; scores: { opportunity: number | null; risk: number | null; confidence: number | null }; updatedAt: string | null }) {
  const router = useRouter();
  const [draft, setDraft] = useState(initialDraft);
  const [pending, setPending] = useState<"request" | "confirm" | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const run = async (kind: "request" | "confirm") => {
    setPending(kind); setMessage(null);
    try {
      const response = await fetch(kind === "request" ? `/api/v1/leads/${id}/insight` : `/api/v1/leads/${id}/insight/confirm`, { method: "POST", headers: kind === "request" ? { "idempotency-key": crypto.randomUUID() } : undefined });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error?.message ?? "AI Insight ไม่สำเร็จ");
      if (kind === "request") { setDraft(result.data as LeadInsightDraft); setMessage({ type: "success", text: "AI draft พร้อมตรวจสอบ กรุณายืนยันก่อนนำไปใช้" }); }
      else { setDraft(null); setMessage({ type: "success", text: "ยืนยันและบันทึก AI Insight แล้ว" }); }
      router.refresh();
    } catch (error) { setMessage({ type: "error", text: error instanceof Error ? error.message : "AI Insight ไม่สำเร็จ" }); }
    finally { setPending(null); }
  };
  return <section className="card ai-insight-card">
    <div className="card-header ai-insight-header"><div><span className="ai-insight-icon"><BrainCircuit aria-hidden="true" /></span><div><strong>AI Insight</strong><small>วิเคราะห์จากรายละเอียด Contact กิจกรรม และเอกสารที่ผู้ใช้มีสิทธิ์เข้าถึง</small></div></div><span className="badge ai">{status}</span></div>
    <div className="card-body">
      <p className="help">AI Insight เป็นคำแนะนำจากข้อมูลไม่มีโครงสร้างและไม่เปลี่ยน Lead Score หรือ Temperature อัตโนมัติ ต้องยืนยันโดยผู้ใช้ก่อนบันทึก</p>
      {canUpdate && <div className="actions"><button type="button" className={draft || status === "READY" ? "secondary" : "primary"} disabled={pending !== null || status === "PROCESSING"} onClick={() => void run("request")}>{pending === "request" || status === "PROCESSING" ? <><LoaderCircle className="spin" aria-hidden="true" />กำลังวิเคราะห์…</> : <><Sparkles aria-hidden="true" />Generate AI Insight</>}</button>{(draft || status === "READY") && <button type="button" className="primary" disabled={pending !== null} onClick={() => void run("confirm")}>{pending === "confirm" ? <><LoaderCircle className="spin" aria-hidden="true" />กำลังยืนยัน…</> : <><Check aria-hidden="true" />ยืนยันใช้ Insight</>}</button>}</div>}
      {draft && <div className="ai-draft-review"><strong>AI draft — รอการยืนยัน</strong><p data-expandable-text>{draft.companySummary}</p><div className="ai-draft-score-row"><span>Opportunity <strong>{draft.opportunityScore}/100</strong></span><span>Risk <strong>{draft.riskScore}/100</strong></span><span>Confidence <strong>{draft.confidenceScore}/100</strong></span></div><small>แนะนำ: {draft.recommendedProducts.join(", ") || "—"}</small><small>Next action: {draft.suggestedNextAction}</small></div>}
      {!draft && <><p data-expandable-text>{summary ?? "ยังไม่มี AI Insight ที่ยืนยันแล้ว"}</p>{scores.opportunity !== null && <div className="ai-draft-score-row"><span>Opportunity <strong>{scores.opportunity}/100</strong></span><span>Risk <strong>{scores.risk}/100</strong></span><span>Confidence <strong>{scores.confidence}/100</strong></span></div>}</>}
      {updatedAt && <p className="ai-provenance">AI generated · {updatedAt}</p>}
      {message && <p className={`form-feedback ${message.type}`} role={message.type === "error" ? "alert" : "status"}>{message.text}</p>}
    </div>
  </section>;
}

export type LeadDocumentItem = { id: string; fileName: string; category: string; mimeType: string; formattedSize: string };

export function LeadDocumentPanel({ id, documents, canUpdate }: { id: string; documents: LeadDocumentItem[]; canUpdate: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  return <div className="lead-document-panel">
    <div className="document-list">{documents.map(document => <article className="document-row" key={document.id}>
      <span className="document-icon"><FileText aria-hidden="true" /></span>
      <div><strong>{document.fileName}</strong><p>{document.category} · {document.mimeType} · {document.formattedSize}</p></div>
      <div className="document-row-actions"><a className="icon-action" href={`/api/v1/leads/${id}/documents/${document.id}`} aria-label={`ดาวน์โหลด ${document.fileName}`}><Download aria-hidden="true" /></a>{canUpdate && <button className="icon-action" type="button" disabled={pending !== null} aria-label={`ลบ ${document.fileName}`} onClick={async () => {
        if (!window.confirm(`ยืนยันลบเอกสาร ${document.fileName}?`)) return;
        setPending(document.id); setMessage(null);
        try {
          const response = await fetch(`/api/v1/leads/${id}/documents/${document.id}`, { method: "DELETE", headers: { "idempotency-key": crypto.randomUUID() } });
          const result = await response.json();
          if (!response.ok) throw new Error(result.error?.message ?? "ลบเอกสารไม่สำเร็จ");
          setMessage({ type: "success", text: "ลบเอกสารแล้ว" }); router.refresh();
        } catch (error) { setMessage({ type: "error", text: error instanceof Error ? error.message : "ลบเอกสารไม่สำเร็จ" }); }
        finally { setPending(null); }
      }}>{pending === document.id ? <LoaderCircle className="spin" aria-hidden="true" /> : <Trash2 aria-hidden="true" />}</button>}</div>
    </article>)}{!documents.length && <div className="compact-empty">ยังไม่มีเอกสาร</div>}</div>
    {canUpdate && <form className="document-upload" onSubmit={async event => {
      event.preventDefault(); setPending("upload"); setMessage(null);
      const form = event.currentTarget; const formData = new FormData(form); const file = formData.get("file");
      if (!(file instanceof File) || !file.size) { setMessage({ type: "error", text: "กรุณาเลือกไฟล์ที่ต้องการอัปโหลด" }); setPending(null); return; }
      if (file.size > 10_000_000) { setMessage({ type: "error", text: "ไฟล์ต้องมีขนาดไม่เกิน 10 MB" }); setPending(null); return; }
      try {
        const response = await fetch(`/api/v1/leads/${id}/documents`, { method: "POST", headers: { "idempotency-key": crypto.randomUUID() }, body: formData });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error?.message ?? "อัปโหลดเอกสารไม่สำเร็จ");
        setMessage({ type: "success", text: "อัปโหลดและตรวจสอบเอกสารเรียบร้อยแล้ว" }); form.reset(); router.refresh();
      } catch (error) { setMessage({ type: "error", text: error instanceof Error ? error.message : "อัปโหลดเอกสารไม่สำเร็จ" }); }
      finally { setPending(null); }
    }}>
      <div className="document-upload-heading"><span><FileUp aria-hidden="true" /></span><div><strong>Upload document</strong><small>ไฟล์จะถูกตรวจสอบก่อนแสดงในรายการ</small></div></div>
      <label htmlFor="lead-document-category">Document category <span className="required">*</span></label>
      <Input id="lead-document-category" name="category" list="lead-document-categories" placeholder="เช่น Proposal หรือ Company profile" required minLength={2} maxLength={100} />
      <datalist id="lead-document-categories"><option value="Company profile" /><option value="Proposal" /><option value="Requirement" /><option value="Contract" /><option value="Other" /></datalist>
      <label htmlFor="lead-document-file">File <span className="required">*</span></label>
      <Input className="file-control" id="lead-document-file" name="file" type="file" required accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.csv,.txt,.jpg,.jpeg,.png" aria-describedby="lead-document-help" />
      <p className="help" id="lead-document-help">PDF, Office, CSV, TXT, JPG หรือ PNG · สูงสุด 10 MB</p>
      <button className="primary" disabled={pending !== null}>{pending === "upload" ? <><LoaderCircle className="spin" aria-hidden="true" />กำลังตรวจสอบ…</> : <><ShieldCheck aria-hidden="true" />Upload securely</>}</button>
    </form>}
    {message && <p className={`form-feedback lead-document-feedback ${message.type}`} role={message.type === "error" ? "alert" : "status"}>{message.text}</p>}
  </div>;
}
