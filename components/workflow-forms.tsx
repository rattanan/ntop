"use client";

import { Pencil, X } from "lucide-react";
import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";

import type { FormState } from "@/app/action-types";
import { decideApproval } from "@/app/actions/approval";
import { overrideOpportunityProbability, transitionOpportunity } from "@/app/actions/opportunity";
import { createGovernedQuote, submitQuoteVersion, transitionQuoteVersion } from "@/app/actions/quote";
import { STAGES } from "@/lib/constants";

import { FormField, Input, Textarea } from "./form-field";
import { FormNotice } from "./notice";
import { SearchableProductSelect } from "./searchable-product-select";
import { SearchableOptionSelect } from "./searchable-option-select";

const initial: FormState = {};

function useIdempotencyKey() {
  return useState(() => crypto.randomUUID())[0];
}

type OpportunityTransitionOption = { id: string; command: string; targetStage: string; requiredFields: string[] };
const transitionCommandLabels: Record<string, string> = { FORWARD:"เดินหน้า",RETURN:"ส่งกลับขั้นก่อน",LOST:"ปิดเป็น Lost",REOPEN:"Reopen",CANCEL:"ยกเลิก",EXPIRE:"ปิดเป็นหมดอายุ",WON:"ปิดเป็น Won" };
const transitionFieldLabels: Record<string, string> = { qualificationResult:"ผลการคัดกรอง",nextAction:"กิจกรรมถัดไป",requirements:"สรุปความต้องการ",stakeholderSummary:"ผู้มีส่วนได้ส่วนเสียและผู้ตัดสินใจ",expectedCloseAt:"วันคาดว่าจะปิด",coverageConfirmed:"ผล Coverage ที่ยืนยันแล้ว",solutionComplete:"Solution Design ที่เสร็จสมบูรณ์",quoteSubmitted:"Quotation ที่ส่งแล้ว",quoteApproved:"Quotation ที่อนุมัติแล้ว",quoteAccepted:"Quotation ที่ลูกค้ายอมรับ",reason:"เหตุผล",lostReason:"เหตุผลที่ Lost",lostCategory:"หมวดหมู่ Lost",cancelledReason:"เหตุผลที่ยกเลิก" };
const opportunityStageLabel = (stage: string) => STAGES.find(([value])=>value===stage)?.[1]??stage;

export function OpportunityTransitionForm({ opportunityId, version, stage, expectedCloseAt, transitions }: { opportunityId: string; version: number; stage: string; expectedCloseAt?: string; transitions: OpportunityTransitionOption[] }) {
  const [state, action, pending] = useActionState(transitionOpportunity.bind(null, opportunityId), initial);
  const key = useIdempotencyKey();
  const [selectedId,setSelectedId] = useState(transitions[0]?.id??"");
  const selected = transitions.find((transition)=>transition.id===selectedId)??transitions[0];
  return <form action={action} className="card form-card">
    <div className="card-body">
      <input type="hidden" name="expectedVersion" value={version}/><input type="hidden" name="idempotencyKey" value={key}/>
      <input type="hidden" name="command" value={selected?.command??""}/><input type="hidden" name="targetStage" value={selected?.targetStage??""}/>
      <div className="form-section"><h2>Transition ขั้นตอนขาย</h2><p>สถานะปัจจุบัน: <strong>{opportunityStageLabel(stage)}</strong> · version {version}</p>
        {selected ? <div className="form-grid">
          <FormField label="เส้นทางที่อนุญาต" name="transitionRoute" required help="แสดงเฉพาะ Transition Policy ที่เปิดใช้งาน"><select className="control" value={selected.id} onChange={(event)=>setSelectedId(event.target.value)}>{transitions.map((transition)=><option key={transition.id} value={transition.id}>{transitionCommandLabels[transition.command]??transition.command} → {opportunityStageLabel(transition.targetStage)}</option>)}</select></FormField>
          <FormField label="วันคาดว่าจะปิด" name="expectedCloseAt"><Input name="expectedCloseAt" type="datetime-local" defaultValue={expectedCloseAt}/></FormField>
          <div className="field full"><p className="help">ระบบจะตรวจข้อมูลก่อนเปลี่ยนขั้นตอน: {selected.requiredFields.map((field)=>transitionFieldLabels[field]??field).join(", ")||"ไม่มีข้อมูลเพิ่มเติม"} · <Link className="link" href={`/opportunities/${opportunityId}/edit`}>แก้ไขข้อมูล Opportunity</Link></p></div>
          {selected.targetStage==="LOST"&&<><FormField label="Lost category" name="lostCategory" required><select className="control" name="lostCategory" defaultValue="" required><option value="" disabled>เลือกหมวดหมู่ Lost</option><option value="COMPETITOR">Competitor</option><option value="PRICE">Price</option><option value="NO_BUDGET">No Budget</option><option value="CUSTOMER_CANCELLED">Customer Cancelled</option><option value="TECHNICAL_LIMITATION">Technical Limitation</option><option value="OTHER">Other</option></select></FormField><div className="field full"><FormField label="เหตุผลที่ Lost" name="lostReason" required><Textarea name="lostReason" required/></FormField></div></>}
          {selected.targetStage==="CANCELLED"&&<div className="field full"><FormField label="เหตุผลที่ยกเลิก" name="cancelledReason" required><Textarea name="cancelledReason" required/></FormField></div>}
          <div className="field full"><FormField label="เหตุผล" name="reason" required><Textarea name="reason" required/></FormField></div>
        </div>:<div className="notice warning">ไม่มี Transition Policy ที่เปิดใช้งานจากขั้นตอนนี้ กรุณาติดต่อผู้ดูแล Workflow</div>}
      </div>
      <FormNotice state={state}/>
      <div className="actions"><button className="primary" disabled={pending||!selected}>{pending?"กำลังเปลี่ยน…":"ยืนยัน Transition"}</button></div>
    </div>
  </form>;
}

type ProbabilityHistoryItem = { id: string; previousProbability: number; newProbability: number; reason: string; changedByName: string; changedAt: string };

export function OpportunityProbabilityDialog({ opportunityId, version, probability, history }: { opportunityId: string; version: number; probability: number; history: ProbabilityHistoryItem[] }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [state, action, pending] = useActionState(overrideOpportunityProbability.bind(null, opportunityId), initial);
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());
  useEffect(() => { if (state.status === "success") dialog.current?.close(); }, [state.status]);
  const openDialog = () => {
    if (state.status === "success") setIdempotencyKey(crypto.randomUUID());
    dialog.current?.showModal();
  };
  return <>
    <button className="probability-edit-button" type="button" aria-label="แก้ไข Probability" title="แก้ไข Probability" onClick={openDialog}><Pencil aria-hidden="true"/></button>
    <dialog className="confirm-dialog probability-dialog" ref={dialog} aria-labelledby="probability-dialog-title" onCancel={(event) => { if (pending) event.preventDefault(); }}>
      <form action={action}>
        <div className="confirm-dialog-head"><div><strong id="probability-dialog-title">Forecast probability override</strong><small>ระบุ Probability ใหม่พร้อมเหตุผลเพื่อบันทึก Audit history</small></div><button className="dialog-close" type="button" aria-label="ปิดหน้าต่าง" disabled={pending} onClick={() => dialog.current?.close()}><X aria-hidden="true"/></button></div>
        <div className="confirm-dialog-body"><input type="hidden" name="expectedVersion" value={version}/><input type="hidden" name="idempotencyKey" value={idempotencyKey}/><div className="probability-dialog-fields"><FormField label="Probability ใหม่ (%)" name="probability" required><Input name="probability" type="number" min="0" max="100" defaultValue={probability} required autoFocus/></FormField><FormField label="เหตุผลการปรับ" name="reason" required help="เหตุผลจะถูกเก็บใน Audit history"><Input name="reason" minLength={5} maxLength={1000} required/></FormField></div><FormNotice state={state.status === "success" ? initial : state}/>{history.length>0&&<div className="probability-history"><h3>ประวัติล่าสุด</h3>{history.map((item)=><p key={item.id}><strong>{item.previousProbability}% → {item.newProbability}%</strong><span>{item.reason} · {item.changedByName} · {item.changedAt}</span></p>)}</div>}</div>
        <div className="confirm-dialog-actions"><button className="secondary" type="button" disabled={pending} onClick={() => dialog.current?.close()}>ยกเลิก</button><button className="primary" disabled={pending}>{pending?"กำลังบันทึก…":"บันทึก Probability"}</button></div>
      </form>
    </dialog>
  </>;
}

type QuoteEditorProduct = { id: string; code: string; name: string; listPrice: string; floorPrice: string | null };
type QuoteEditorLine = { key: string; productId: string; quantity: string; unitPrice: string; discountPct: string };
const SCALE = BigInt(10_000); const ZERO = BigInt(0); const ONE_HUNDRED = BigInt(100);
function scaled(value: string) { const match = value.trim().match(/^(\d+)(?:\.(\d{0,4}))?$/); if (!match) return ZERO; return BigInt(match[1]) * SCALE + BigInt((match[2] ?? "").padEnd(4, "0") || "0"); }
function displayMoney(value: bigint) { const whole = value / SCALE; const fraction = String(value % SCALE).padStart(4, "0").replace(/0+$/, ""); return `${whole.toLocaleString("th-TH")}${fraction ? `.${fraction}` : ""}`; }
function lineTotal(line: QuoteEditorLine) { const subtotal = scaled(line.unitPrice) * scaled(line.quantity) / SCALE; return subtotal - subtotal * scaled(line.discountPct) / (ONE_HUNDRED * SCALE); }

export function GovernedQuoteForm({ products, opportunities, quoteId, proposalId, initialOpportunityId, initialValidUntil, initialNotes, initialLines }: { products: QuoteEditorProduct[]; opportunities: Array<{ id: string; name: string; customerName: string }>; quoteId?: string; proposalId?: string; initialOpportunityId?: string; initialValidUntil?: string; initialNotes?: string; initialLines?: Array<Omit<QuoteEditorLine, "key">> }) {
  const [state, action, pending] = useActionState(createGovernedQuote, initial); const key = useIdempotencyKey();
  const [lines, setLines] = useState<QuoteEditorLine[]>(initialLines?.length ? initialLines.map((line, index) => ({ ...line, key: `line-${index + 1}` })) : [{ key: "line-1", productId: "", quantity: "1", unitPrice: "0", discountPct: "0" }]);
  const update = (keyValue: string, values: Partial<QuoteEditorLine>) => setLines((current) => current.map((line) => line.key === keyValue ? { ...line, ...values } : line));
  const total = lines.reduce((sum, line) => sum + lineTotal(line), ZERO);
  return <form action={action} className="quote-editor"><input type="hidden" name="idempotencyKey" value={key}/><input type="hidden" name="quoteId" value={quoteId ?? ""}/><input type="hidden" name="proposalId" value={proposalId ?? ""}/><input type="hidden" name="itemsJson" value={JSON.stringify(lines.map(({ productId, quantity, unitPrice, discountPct }) => ({ productId, quantity, unitPrice, discountPct })))}/>
    <section className="card quote-header-card"><div className="card-header"><div><span className="quote-step">01</span><div><strong>Quotation Header</strong><small>ข้อมูลหลักของใบเสนอราคาและ Opportunity</small></div></div><span className="badge muted">Draft Version</span></div><div className="card-body"><div className="form-grid">
      <FormField label="Opportunity" name="opportunityId" required><SearchableOptionSelect id="opportunityId" name="opportunityId" options={opportunities.map(item=>({id:item.id,label:item.name,description:item.customerName}))} defaultValue={initialOpportunityId} placeholder="ค้นหา Opportunity หรือลูกค้า" required disabled={Boolean(initialOpportunityId)}/></FormField>
      <FormField label="สกุลเงิน" name="currency"><Input name="currency" value="THB" readOnly/></FormField>
      <FormField label="ใช้ได้ถึง" name="validUntil"><Input name="validUntil" type="date" defaultValue={initialValidUntil}/></FormField>
      <div className="field full"><FormField label="หมายเหตุ / เงื่อนไขการขาย" name="notes"><Textarea name="notes" defaultValue={initialNotes}/></FormField></div>
    </div></div></section>
    <section className="card quote-lines-card"><div className="card-header"><div><span className="quote-step">02</span><div><strong>Product &amp; Pricing Details</strong><small>เพิ่มได้สูงสุด 100 รายการ ราคาและส่วนลดตรวจ Floor Price ฝั่ง server</small></div></div><button type="button" className="secondary" disabled={lines.length>=100} onClick={() => setLines((current) => [...current, { key: crypto.randomUUID(), productId: "", quantity: "1", unitPrice: "0", discountPct: "0" }])}>+ เพิ่มสินค้า</button></div><div className="quote-lines-wrap"><table className="quote-lines-table"><thead><tr><th>#</th><th><span className="required-label">Product / Service</span></th><th><span className="required-label">จำนวน</span></th><th>List Price</th><th>Floor Price</th><th><span className="required-label">ราคาขาย/หน่วย</span></th><th><span className="required-label">ส่วนลด %</span></th><th>ยอดสุทธิ</th><th/></tr></thead><tbody>{lines.map((line,index)=>{const product=products.find((item)=>item.id===line.productId);const effective=line.quantity&&scaled(line.quantity)>ZERO?lineTotal(line)*SCALE/scaled(line.quantity):ZERO;const belowFloor=product?.floorPrice?effective<scaled(product.floorPrice):false;return <tr key={line.key} className={belowFloor?"below-floor":""}><td>{index+1}</td><td><SearchableProductSelect id={`quote-product-${line.key}`} ariaLabel={`Product / Service รายการ ${index+1}`} options={products} value={line.productId} required onChange={(productId,selected)=>update(line.key,{productId,unitPrice:selected?.listPrice??"0"})}/></td><td><input className="control quote-number" inputMode="decimal" value={line.quantity} onChange={(event)=>update(line.key,{quantity:event.target.value})} required/></td><td className="money-cell">{product?displayMoney(scaled(product.listPrice)):"—"}</td><td className="money-cell floor-cell">{product?.floorPrice?displayMoney(scaled(product.floorPrice)):<span className="unset-price">ยังไม่กำหนด</span>}</td><td><input className="control quote-number" inputMode="decimal" value={line.unitPrice} onChange={(event)=>update(line.key,{unitPrice:event.target.value})} required/></td><td><input className="control quote-number" inputMode="decimal" value={line.discountPct} onChange={(event)=>update(line.key,{discountPct:event.target.value})} required/></td><td className="money-cell"><strong>{displayMoney(lineTotal(line))}</strong>{belowFloor&&<small>ต่ำกว่า Floor</small>}</td><td><button type="button" className="remove-line" aria-label={`ลบรายการ ${index+1}`} disabled={lines.length===1} onClick={()=>setLines((current)=>current.filter((item)=>item.key!==line.key))}>×</button></td></tr>})}</tbody></table></div><div className="quote-summary"><span>{lines.length} รายการ</span><div><small>ยอดสุทธิทั้งเอกสาร</small><strong>{displayMoney(total)} THB</strong></div></div></section>
    <FormNotice state={state}/><div className="quote-actions"><Link href="/quotes" className="secondary">ยกเลิก</Link><button className="primary" disabled={pending||lines.some((line)=>!line.productId)}>{pending?"กำลังสร้าง…":"สร้าง Draft Version"}</button></div>
  </form>;
}

export function QuoteSubmitForm({ quoteId, quoteVersionId }: { quoteId: string; quoteVersionId: string }) {
  const [state, action, pending] = useActionState(submitQuoteVersion.bind(null, quoteId, quoteVersionId), initial);
  const key = useIdempotencyKey();
  return <form action={action}><input type="hidden" name="idempotencyKey" value={key}/><FormNotice state={state}/><button className="primary" disabled={pending}>{pending?"กำลังตรวจ gate…":"ส่งขออนุมัติ"}</button></form>;
}

export function QuoteCommercialTransitionForm({ quoteId, quoteVersionId, status }: { quoteId: string; quoteVersionId: string; status: "APPROVED" | "SENT" }) {
  const toStatus = status === "APPROVED" ? "SENT" : "ACCEPTED";
  const [state, action, pending] = useActionState(transitionQuoteVersion.bind(null, quoteId, quoteVersionId, toStatus), initial);
  const key = useIdempotencyKey();
  return <form action={action}><input type="hidden" name="idempotencyKey" value={key}/><FormNotice state={state}/><button className="primary" disabled={pending}>{pending ? "กำลังบันทึก…" : toStatus === "SENT" ? "ยืนยันการส่งให้ลูกค้า" : "บันทึกลูกค้ายอมรับ"}</button></form>;
}

export function ApprovalDecisionForm({ requestId, stepId, version }: { requestId: string; stepId: string; version: number }) {
  const [state, action, pending] = useActionState(decideApproval.bind(null, requestId, stepId, version), initial);
  const key = useIdempotencyKey();
  return <form action={action} className="card form-card"><div className="card-body"><input type="hidden" name="idempotencyKey" value={key}/><div className="form-grid">
    <FormField label="คำตัดสิน" name="decision" required><select id="decision" className="control" name="decision"><option value="APPROVE">Approve</option><option value="REJECT">Reject</option><option value="RETURN">Return</option><option value="DELEGATE">Delegate</option><option value="ESCALATE">Escalate</option></select></FormField>
    <FormField label="Delegate to user ID" name="delegateToActorId"><Input name="delegateToActorId"/></FormField>
    <div className="field full"><FormField label="เหตุผล" name="reason" required><Textarea name="reason" required/></FormField></div>
  </div><FormNotice state={state}/><div className="actions"><button className="primary" disabled={pending}>{pending?"กำลังบันทึก…":"ยืนยันคำตัดสิน"}</button></div></div></form>;
}
