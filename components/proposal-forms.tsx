"use client";

import { useActionState, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import type { FormState } from "@/app/action-types";
import { createProposal, editProposal, restoreProposal, transitionProposal } from "@/app/actions/proposal";
import type { ProposalSectionInput } from "@/lib/proposal/contracts";
import { FormNotice } from "./notice";

const initial: FormState = {};
const key = () => crypto.randomUUID();

export function ProposalCreateForm({ opportunities, templates, initialOpportunityId }: { opportunities: Array<{ id: string; name: string; customerName: string }>; templates: Array<{ id: string; name: string; category: string }>; initialOpportunityId?: string }) {
  const [state, action, pending] = useActionState(createProposal, initial);
  const [idempotencyKey] = useState(key);
  return <form action={action} className="card proposal-form"><div className="card-body"><input type="hidden" name="idempotencyKey" value={idempotencyKey}/><div className="form-grid">
    <label className="field full"><span>Proposal Name</span><input className="control" name="name" maxLength={255} required/></label>
    <label className="field"><span>Opportunity</span><select className="control" name="opportunityId" defaultValue={initialOpportunityId??""} required><option value="" disabled>เลือก Opportunity</option>{opportunities.map((item)=><option key={item.id} value={item.id}>{item.name} — {item.customerName}</option>)}</select></label>
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

export function ProposalAiGenerator({ proposalId, version, products, disabled }: { proposalId: string; version: number; products: Array<{ id: string; code: string; name: string; category: string }>; disabled: boolean }) {
  const router = useRouter(); const [pending, start] = useTransition(); const [query,setQuery]=useState(""); const [selected,setSelected]=useState<string[]>([]); const [message,setMessage]=useState("");
  const visible=useMemo(()=>products.filter((item)=>`${item.code} ${item.name} ${item.category}`.toLowerCase().includes(query.toLowerCase())).slice(0,20),[products,query]);
  const generate=()=>start(async()=>{setMessage("");const response=await fetch(`/api/v1/proposals/${proposalId}/generate`,{method:"POST",headers:{"Content-Type":"application/json","Idempotency-Key":key()},body:JSON.stringify({expectedVersion:version,productIds:selected})});const body=await response.json();if(!response.ok){setMessage(body.error?.code??"AI generation unavailable");return;}setMessage("AI created an editable draft version");router.refresh();});
  return <section className="card ai-proposal-card"><div className="card-header"><div><strong>AI Proposal Generator</strong><small>ใช้ Opportunity, Customer, Meeting Notes, Template และ Product ที่เลือก</small></div><span className="badge ai">AI Draft</span></div><div className="card-body"><input className="control" value={query} onChange={(event)=>setQuery(event.target.value)} placeholder="Search products" aria-label="Search products"/><div className="proposal-product-picker">{visible.map((item)=><label key={item.id}><input type="checkbox" checked={selected.includes(item.id)} onChange={(event)=>setSelected((current)=>event.target.checked?[...current,item.id]:current.filter((id)=>id!==item.id))}/><span><strong>{item.code}</strong> {item.name}<small>{item.category}</small></span></label>)}</div><p className="help">เลือก {selected.length} product · AI output ต้องตรวจและแก้ไขก่อนส่ง</p>{message&&<p className="help" role="status">{message}</p>}<button type="button" className="primary ai-action" onClick={generate} disabled={disabled||pending}>{pending?"Generating…":"✦ Generate Proposal"}</button></div></section>;
}

type CompareVersion={versionNumber:number;createdAt:string;sections:Array<{sectionCode:string;title:string;content:string}>};
export function ProposalVersionCompare({ versions }: { versions: CompareVersion[] }) {
  const [left,setLeft]=useState(versions[1]?.versionNumber??versions[0]?.versionNumber??1);const [right,setRight]=useState(versions[0]?.versionNumber??1);const a=versions.find((item)=>item.versionNumber===left);const b=versions.find((item)=>item.versionNumber===right);const codes=[...new Set([...(a?.sections??[]).map((s)=>s.sectionCode),...(b?.sections??[]).map((s)=>s.sectionCode)])];
  if(versions.length<2)return null;
  return <section className="card"><div className="card-header"><strong>Compare Versions</strong><div className="version-selectors"><select className="control" value={left} onChange={(e)=>setLeft(Number(e.target.value))}>{versions.map((v)=><option key={v.versionNumber} value={v.versionNumber}>v{v.versionNumber}</option>)}</select><span>vs</span><select className="control" value={right} onChange={(e)=>setRight(Number(e.target.value))}>{versions.map((v)=><option key={v.versionNumber} value={v.versionNumber}>v{v.versionNumber}</option>)}</select></div></div><div className="table-wrap"><table className="table proposal-compare"><thead><tr><th>Section</th><th>v{left}</th><th>v{right}</th></tr></thead><tbody>{codes.map((code)=>{const x=a?.sections.find((s)=>s.sectionCode===code);const y=b?.sections.find((s)=>s.sectionCode===code);const changed=x?.content!==y?.content;return <tr key={code} className={changed?"changed":""}><td>{x?.title??y?.title}</td><td>{x?.content||"—"}</td><td>{y?.content||"—"}</td></tr>})}</tbody></table></div></section>;
}

export function PrintProposalButton(){return <button type="button" className="secondary" onClick={()=>window.print()}>Print / Save PDF</button>}
