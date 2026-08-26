"use client";

import { useActionState, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import type { FormState } from "@/app/action-types";
import { createProposal, editProposal, restoreProposal, transitionProposal } from "@/app/actions/proposal";
import { filterProductOptions } from "@/lib/presales/product-option-search";
import type { ProposalSectionInput } from "@/lib/proposal/contracts";
import { FormNotice } from "./notice";
import { SearchableOptionSelect } from "./searchable-option-select";

const initial: FormState = {};
const key = () => crypto.randomUUID();

export function ProposalCreateForm({ opportunities, templates, initialOpportunityId }: { opportunities: Array<{ id: string; name: string; customerName: string }>; templates: Array<{ id: string; name: string; category: string }>; initialOpportunityId?: string }) {
  const [state, action, pending] = useActionState(createProposal, initial);
  const [idempotencyKey] = useState(key);
  return <form action={action} className="card proposal-form"><div className="card-body"><input type="hidden" name="idempotencyKey" value={idempotencyKey}/><div className="form-grid">
    <label className="field full"><span>Proposal Name</span><input className="control" name="name" maxLength={255} required/></label>
    <label className="field"><span>Opportunity</span><SearchableOptionSelect name="opportunityId" options={opportunities.map(item=>({id:item.id,label:item.name,description:item.customerName}))} defaultValue={initialOpportunityId} placeholder="ค้นหา Opportunity หรือลูกค้า" required/></label>
    <label className="field"><span>Template</span><select className="control" name="templateId" defaultValue=""><option value="">Standard Proposal</option>{templates.map((item)=><option key={item.id} value={item.id}>{item.category} — {item.name}</option>)}</select></label>
    <label className="field"><span>Expire Date</span><input className="control" name="expireDate" type="date"/></label>
    <label className="field"><span>Tags</span><input className="control" name="tags" placeholder="enterprise, cloud"/></label>
    <label className="field full"><span>Description</span><textarea className="control" name="description" rows={4} maxLength={10000}/></label>
  </div><FormNotice state={state}/><div className="actions"><button className="primary" disabled={pending||!opportunities.length}>{pending?"กำลังสร้าง…":"Create Proposal"}</button></div></div></form>;
}

export function ProposalEditor({ proposalId, version, name, description, expireDate, tags, sections, terminal }: { proposalId: string; version: number; name: string; description: string | null; expireDate: string | null; tags: string[]; sections: ProposalSectionInput[]; terminal: boolean }) {
  const [state, action, pending] = useActionState(editProposal.bind(null, proposalId), initial);
  const [idempotencyKey] = useState(key);
  const [draft, setDraft] = useState(sections);
  const update = (code: string, content: string) => setDraft((current)=>current.map((section)=>section.sectionCode===code?{...section,content}:section));
  return <form action={action} className="proposal-editor"><input type="hidden" name="idempotencyKey" value={idempotencyKey}/><input type="hidden" name="expectedVersion" value={version}/><input type="hidden" name="sectionsJson" value={JSON.stringify(draft)}/>
    <section className="card"><div className="card-header"><div><strong>Proposal Content</strong><small>การบันทึกแต่ละครั้งสร้าง immutable version ใหม่</small></div><span className="badge">v{version}</span></div><div className="card-body"><div className="form-grid"><label className="field full"><span>Proposal Name</span><input className="control" name="name" defaultValue={name} required maxLength={255} disabled={terminal}/></label><label className="field"><span>Expire Date</span><input className="control" name="expireDate" type="date" defaultValue={expireDate?.slice(0,10)} disabled={terminal}/></label><label className="field"><span>Tags</span><input className="control" name="tags" defaultValue={tags.join(", ")} disabled={terminal}/></label><label className="field full"><span>Description</span><textarea className="control" name="description" rows={3} defaultValue={description??""} disabled={terminal}/></label></div></div></section>
    <div className="proposal-sections">{draft.map((section)=><section className="card proposal-section" key={section.sectionCode}><div className="card-header"><div><span className="proposal-section-index">{String(section.sortOrder+1).padStart(2,"0")}</span><strong>{section.title}</strong></div><span className="badge muted">{section.sectionCode}</span></div><div className="card-body"><textarea className="control proposal-content" aria-label={section.title} value={section.content} onChange={(event)=>update(section.sectionCode,event.target.value)} rows={7} disabled={terminal}/></div></section>)}</div>
    <FormNotice state={state}/>{!terminal&&<div className="proposal-sticky-actions"><span>Draft changes become version {version+1}</span><button className="primary" disabled={pending}>{pending?"Saving…":"Save New Version"}</button></div>}
  </form>;
}

export function ProposalStatusForm({ proposalId, version, transitions }: { proposalId: string; version: number; transitions: Array<{ code: string; label: string }> }) {
  const [state, action, pending] = useActionState(transitionProposal.bind(null, proposalId), initial); const [idempotencyKey] = useState(key);
  if (!transitions.length) return null;
  return <form action={action} className="card"><div className="card-header"><strong>Workflow</strong></div><div className="card-body"><input type="hidden" name="expectedVersion" value={version}/><input type="hidden" name="idempotencyKey" value={idempotencyKey}/><div className="form-grid"><label className="field"><span>Next Status</span><select className="control" name="toStatusCode">{transitions.map((item)=><option key={item.code} value={item.code}>{item.label}</option>)}</select></label><label className="field"><span>Comment</span><input className="control" name="comment" minLength={1} maxLength={1000} required/></label></div><FormNotice state={state}/><button className="secondary" disabled={pending}>{pending?"Updating…":"Update Status"}</button></div></form>;
}

export function ProposalRestoreButton({ proposalId, expectedVersion, sourceVersionNumber, disabled }: { proposalId: string; expectedVersion: number; sourceVersionNumber: number; disabled: boolean }) {
  const [state, action, pending] = useActionState(restoreProposal.bind(null, proposalId), initial); const [idempotencyKey] = useState(key);
  return <form action={action}><input type="hidden" name="expectedVersion" value={expectedVersion}/><input type="hidden" name="sourceVersionNumber" value={sourceVersionNumber}/><input type="hidden" name="idempotencyKey" value={idempotencyKey}/><button className="secondary compact" disabled={disabled||pending}>{pending?"Restoring…":"Restore"}</button><FormNotice state={state}/></form>;
}

export function ProposalAiGenerator({ proposalId, version, products, disabled, availabilityMessage }: { proposalId: string; version: number; products: Array<{ id: string; code: string; name: string; category: string }>; disabled: boolean; availabilityMessage?: string }) {
  const router = useRouter(); const [pending, start] = useTransition(); const [query,setQuery]=useState(""); const [selected,setSelected]=useState<string[]>([]); const [message,setMessage]=useState("");
  const visible=useMemo(()=>filterProductOptions(products,query,50),[products,query]);
  const generate=()=>start(async()=>{setMessage("");const response=await fetch(`/api/v1/proposals/${proposalId}/generate`,{method:"POST",headers:{"Content-Type":"application/json","Idempotency-Key":key()},body:JSON.stringify({expectedVersion:version,productIds:selected})});const body=await response.json();if(!response.ok){setMessage(body.error?.code==="AI_PROVIDER_UNAVAILABLE"?"AI Provider ไม่พร้อมใช้งาน กรุณาลองใหม่ภายหลังหรือติดต่อผู้ดูแลระบบ":body.error?.message??"ไม่สามารถสร้าง Proposal ด้วย AI ได้");return;}setMessage("AI สร้าง Draft ที่แก้ไขได้เรียบร้อย");router.refresh();});
  return <section className="card ai-proposal-card"><div className="card-header"><div><strong>ตัวช่วยสร้างข้อเสนอด้วย AI</strong><small>ใช้ข้อมูลโอกาสขาย ลูกค้า บันทึกการประชุม แม่แบบ และสินค้า/บริการที่เลือก เพื่อสร้างร่างภาษาไทย</small></div><span className="badge ai">ร่างจาก AI</span></div><div className="card-body"><input className="control" type="search" value={query} onChange={(event)=>setQuery(event.target.value)} placeholder="ค้นหารหัส ชื่อ หรือหมวดสินค้า/บริการ" aria-label="ค้นหาสินค้าและบริการ" aria-controls="proposal-product-results" disabled={disabled}/><div className="proposal-product-picker" id="proposal-product-results" role="group" aria-label="ผลการค้นหาสินค้าและบริการ">{visible.map((item)=><label key={item.id}><input type="checkbox" checked={selected.includes(item.id)} disabled={disabled} onChange={(event)=>setSelected((current)=>event.target.checked?[...current,item.id]:current.filter((id)=>id!==item.id))}/><span><strong>{item.code}</strong> {item.name}<small>{item.category}</small></span></label>)}{!visible.length&&<p className="proposal-product-empty" role="status">ไม่พบสินค้า/บริการที่ค้นหา</p>}</div><p className="help">แสดงสูงสุด 50 รายการ · เลือกแล้ว {selected.length} รายการ · ต้องตรวจและแก้ไขเนื้อหาจาก AI ก่อนส่ง</p>{availabilityMessage&&<p className="notice" role="status">{availabilityMessage}</p>}{message&&<p className="help" role="status">{message}</p>}<button type="button" className="primary ai-action" onClick={generate} disabled={disabled||pending}>{pending?"กำลังสร้างข้อเสนอ…":"✦ สร้างข้อเสนอภาษาไทย"}</button></div></section>;
}

type CompareVersion={versionNumber:number;createdAt:string;sections:Array<{sectionCode:string;title:string;content:string}>};
export function ProposalVersionCompare({ versions }: { versions: CompareVersion[] }) {
  const [left,setLeft]=useState(versions[1]?.versionNumber??versions[0]?.versionNumber??1);const [right,setRight]=useState(versions[0]?.versionNumber??1);const a=versions.find((item)=>item.versionNumber===left);const b=versions.find((item)=>item.versionNumber===right);const codes=[...new Set([...(a?.sections??[]).map((s)=>s.sectionCode),...(b?.sections??[]).map((s)=>s.sectionCode)])];
  if(versions.length<2)return null;
  return <section className="card"><div className="card-header"><strong>Compare Versions</strong><div className="version-selectors"><select className="control" value={left} onChange={(e)=>setLeft(Number(e.target.value))}>{versions.map((v)=><option key={v.versionNumber} value={v.versionNumber}>v{v.versionNumber}</option>)}</select><span>vs</span><select className="control" value={right} onChange={(e)=>setRight(Number(e.target.value))}>{versions.map((v)=><option key={v.versionNumber} value={v.versionNumber}>v{v.versionNumber}</option>)}</select></div></div><div className="table-wrap"><table className="table proposal-compare"><thead><tr><th>Section</th><th>v{left}</th><th>v{right}</th></tr></thead><tbody>{codes.map((code)=>{const x=a?.sections.find((s)=>s.sectionCode===code);const y=b?.sections.find((s)=>s.sectionCode===code);const changed=x?.content!==y?.content;return <tr key={code} className={changed?"changed":""}><td>{x?.title??y?.title}</td><td>{x?.content||"—"}</td><td>{y?.content||"—"}</td></tr>})}</tbody></table></div></section>;
}

export function PrintProposalButton(){return <button type="button" className="secondary" onClick={()=>window.print()}>Print / Save PDF</button>}
