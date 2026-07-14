"use client";

import { useActionState, useState } from "react";
import Link from "next/link";

import type { FormState } from "@/app/action-types";
import { decideApproval } from "@/app/actions/approval";
import { overrideOpportunityProbability, transitionOpportunity } from "@/app/actions/opportunity";
import { createGovernedQuote, submitQuoteVersion } from "@/app/actions/quote";
import { STAGES } from "@/lib/constants";

import { FormField, Input, Textarea } from "./form-field";
import { FormNotice } from "./notice";

const initial: FormState = {};

function useIdempotencyKey() {
  return useState(() => crypto.randomUUID())[0];
}

export function OpportunityTransitionForm({ opportunityId, version, stage, expectedCloseAt }: { opportunityId: string; version: number; stage: string; expectedCloseAt?: string }) {
  const [state, action, pending] = useActionState(transitionOpportunity.bind(null, opportunityId), initial);
  const key = useIdempotencyKey();
  return <form action={action} className="card form-card">
    <div className="card-body">
      <input type="hidden" name="expectedVersion" value={version}/><input type="hidden" name="idempotencyKey" value={key}/>
      <div className="form-section"><h2>Transition ขั้นตอนขาย</h2><p>สถานะปัจจุบัน: <strong>{stage}</strong> · version {version}</p>
        <div className="form-grid">
          <FormField label="คำสั่ง" name="command" required><select className="control" name="command" defaultValue="FORWARD"><option value="FORWARD">เดินหน้า</option><option value="RETURN">ส่งกลับขั้นก่อน</option><option value="LOST">ปิดเป็น Lost</option><option value="REOPEN">Reopen</option><option value="CANCEL">ยกเลิก</option><option value="EXPIRE">ปิดเป็นหมดอายุ</option><option value="WON">ปิดเป็น Won</option></select></FormField>
          <FormField label="ขั้นตอนเป้าหมาย" name="targetStage" required><select className="control" name="targetStage" defaultValue={stage}>{STAGES.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></FormField>
          <FormField label="วันคาดว่าจะปิด" name="expectedCloseAt"><Input name="expectedCloseAt" type="datetime-local" defaultValue={expectedCloseAt}/></FormField>
          <FormField label="Lost category" name="lostCategory"><select className="control" name="lostCategory" defaultValue=""><option value="">เลือกเมื่อปิดเป็น Lost</option><option value="COMPETITOR">Competitor</option><option value="PRICE">Price</option><option value="NO_BUDGET">No Budget</option><option value="CUSTOMER_CANCELLED">Customer Cancelled</option><option value="TECHNICAL_LIMITATION">Technical Limitation</option><option value="OTHER">Other</option></select></FormField>
          <div className="field full"><FormField label="เหตุผล" name="reason" required><Textarea name="reason" required/></FormField></div>
          <div className="field full"><FormField label="Lost reason" name="lostReason"><Textarea name="lostReason"/></FormField></div><div className="field full"><FormField label="Cancelled reason" name="cancelledReason"><Textarea name="cancelledReason"/></FormField></div>
        </div>
      </div>
      <FormNotice state={state}/>
      <div className="actions"><button className="primary" disabled={pending}>{pending?"กำลังเปลี่ยน…":"ยืนยัน Transition"}</button></div>
    </div>
  </form>;
}

export function OpportunityProbabilityForm({ opportunityId, version, probability }: { opportunityId: string; version: number; probability: number }) {
  const [state, action, pending] = useActionState(overrideOpportunityProbability.bind(null, opportunityId), initial);
  const key = useIdempotencyKey();
  return <form action={action} className="probability-form"><input type="hidden" name="expectedVersion" value={version}/><input type="hidden" name="idempotencyKey" value={key}/><FormField label="Probability ใหม่ (%)" name="probability" required><Input name="probability" type="number" min="0" max="100" defaultValue={probability} required/></FormField><FormField label="เหตุผลการปรับ" name="reason" required help="เหตุผลจะถูกเก็บใน Audit history"><Input name="reason" minLength={5} maxLength={1000} required/></FormField><FormNotice state={state}/><button className="secondary" disabled={pending}>{pending?"กำลังบันทึก…":"บันทึก Probability"}</button></form>;
}

type QuoteEditorProduct = { id: string; code: string; name: string; listPrice: string; floorPrice: string | null };
type QuoteEditorLine = { key: string; productId: string; quantity: string; unitPrice: string; discountPct: string };
const SCALE = BigInt(10_000); const ZERO = BigInt(0); const ONE_HUNDRED = BigInt(100);
function scaled(value: string) { const match = value.trim().match(/^(\d+)(?:\.(\d{0,4}))?$/); if (!match) return ZERO; return BigInt(match[1]) * SCALE + BigInt((match[2] ?? "").padEnd(4, "0") || "0"); }
function displayMoney(value: bigint) { const whole = value / SCALE; const fraction = String(value % SCALE).padStart(4, "0").replace(/0+$/, ""); return `${whole.toLocaleString("th-TH")}${fraction ? `.${fraction}` : ""}`; }
function lineTotal(line: QuoteEditorLine) { const subtotal = scaled(line.unitPrice) * scaled(line.quantity) / SCALE; return subtotal - subtotal * scaled(line.discountPct) / (ONE_HUNDRED * SCALE); }

export function GovernedQuoteForm({ products, opportunities }: { products: QuoteEditorProduct[]; opportunities: Array<{ id: string; name: string; customerName: string }> }) {
  const [state, action, pending] = useActionState(createGovernedQuote, initial); const key = useIdempotencyKey();
  const [lines, setLines] = useState<QuoteEditorLine[]>([{ key: "line-1", productId: "", quantity: "1", unitPrice: "0", discountPct: "0" }]);
  const update = (keyValue: string, values: Partial<QuoteEditorLine>) => setLines((current) => current.map((line) => line.key === keyValue ? { ...line, ...values } : line));
  const total = lines.reduce((sum, line) => sum + lineTotal(line), ZERO);
  return <form action={action} className="quote-editor"><input type="hidden" name="idempotencyKey" value={key}/><input type="hidden" name="itemsJson" value={JSON.stringify(lines.map(({ productId, quantity, unitPrice, discountPct }) => ({ productId, quantity, unitPrice, discountPct })))}/>
    <section className="card quote-header-card"><div className="card-header"><div><span className="quote-step">01</span><div><strong>Quotation Header</strong><small>ข้อมูลหลักของใบเสนอราคาและ Opportunity</small></div></div><span className="badge muted">Draft Version</span></div><div className="card-body"><div className="form-grid">
      <FormField label="Opportunity" name="opportunityId" required><select className="control" name="opportunityId" defaultValue="" required><option value="" disabled>เลือก Opportunity</option>{opportunities.map(item=><option key={item.id} value={item.id}>{item.name} — {item.customerName}</option>)}</select></FormField>
      <FormField label="สกุลเงิน" name="currency"><Input name="currency" value="THB" readOnly/></FormField>
      <FormField label="ใช้ได้ถึง" name="validUntil"><Input name="validUntil" type="date"/></FormField>
      <div className="field full"><FormField label="หมายเหตุ / เงื่อนไขการขาย" name="notes"><Textarea name="notes"/></FormField></div>
    </div></div></section>
    <section className="card quote-lines-card"><div className="card-header"><div><span className="quote-step">02</span><div><strong>Product &amp; Pricing Details</strong><small>เพิ่มได้สูงสุด 100 รายการ ราคาและส่วนลดตรวจ Floor Price ฝั่ง server</small></div></div><button type="button" className="secondary" disabled={lines.length>=100} onClick={() => setLines((current) => [...current, { key: crypto.randomUUID(), productId: "", quantity: "1", unitPrice: "0", discountPct: "0" }])}>+ เพิ่มสินค้า</button></div><div className="quote-lines-wrap"><table className="quote-lines-table"><thead><tr><th>#</th><th>Product / Service</th><th>จำนวน</th><th>List Price</th><th>Floor Price</th><th>ราคาขาย/หน่วย</th><th>ส่วนลด %</th><th>ยอดสุทธิ</th><th/></tr></thead><tbody>{lines.map((line,index)=>{const product=products.find((item)=>item.id===line.productId);const effective=line.quantity&&scaled(line.quantity)>ZERO?lineTotal(line)*SCALE/scaled(line.quantity):ZERO;const belowFloor=product?.floorPrice?effective<scaled(product.floorPrice):false;return <tr key={line.key} className={belowFloor?"below-floor":""}><td>{index+1}</td><td><select className="control" value={line.productId} required onChange={(event)=>{const selected=products.find((item)=>item.id===event.target.value);update(line.key,{productId:event.target.value,unitPrice:selected?.listPrice??"0"});}}><option value="" disabled>เลือกสินค้า</option>{products.map((item)=><option value={item.id} key={item.id}>{item.code} — {item.name}</option>)}</select></td><td><input className="control quote-number" inputMode="decimal" value={line.quantity} onChange={(event)=>update(line.key,{quantity:event.target.value})} required/></td><td className="money-cell">{product?displayMoney(scaled(product.listPrice)):"—"}</td><td className="money-cell floor-cell">{product?.floorPrice?displayMoney(scaled(product.floorPrice)):<span className="unset-price">ยังไม่กำหนด</span>}</td><td><input className="control quote-number" inputMode="decimal" value={line.unitPrice} onChange={(event)=>update(line.key,{unitPrice:event.target.value})} required/></td><td><input className="control quote-number" inputMode="decimal" value={line.discountPct} onChange={(event)=>update(line.key,{discountPct:event.target.value})} required/></td><td className="money-cell"><strong>{displayMoney(lineTotal(line))}</strong>{belowFloor&&<small>ต่ำกว่า Floor</small>}</td><td><button type="button" className="remove-line" aria-label={`ลบรายการ ${index+1}`} disabled={lines.length===1} onClick={()=>setLines((current)=>current.filter((item)=>item.key!==line.key))}>×</button></td></tr>})}</tbody></table></div><div className="quote-summary"><span>{lines.length} รายการ</span><div><small>ยอดสุทธิทั้งเอกสาร</small><strong>{displayMoney(total)} THB</strong></div></div></section>
    <FormNotice state={state}/><div className="quote-actions"><Link href="/quotes" className="secondary">ยกเลิก</Link><button className="primary" disabled={pending||lines.some((line)=>!line.productId)}>{pending?"กำลังสร้าง…":"สร้าง Draft Version"}</button></div>
  </form>;
}

export function QuoteSubmitForm({ quoteId, quoteVersionId }: { quoteId: string; quoteVersionId: string }) {
  const [state, action, pending] = useActionState(submitQuoteVersion.bind(null, quoteId, quoteVersionId), initial);
  const key = useIdempotencyKey();
  return <form action={action}><input type="hidden" name="idempotencyKey" value={key}/><FormNotice state={state}/><button className="primary" disabled={pending}>{pending?"กำลังตรวจ gate…":"ส่งขออนุมัติ"}</button></form>;
}

export function ApprovalDecisionForm({ requestId, stepId, version }: { requestId: string; stepId: string; version: number }) {
  const [state, action, pending] = useActionState(decideApproval.bind(null, requestId, stepId, version), initial);
  const key = useIdempotencyKey();
  return <form action={action} className="card form-card"><div className="card-body"><input type="hidden" name="idempotencyKey" value={key}/><div className="form-grid">
    <FormField label="คำตัดสิน" name="decision" required><select className="control" name="decision"><option value="APPROVE">Approve</option><option value="REJECT">Reject</option><option value="RETURN">Return</option><option value="DELEGATE">Delegate</option><option value="ESCALATE">Escalate</option></select></FormField>
    <FormField label="Delegate to user ID" name="delegateToActorId"><Input name="delegateToActorId"/></FormField>
    <div className="field full"><FormField label="เหตุผล" name="reason" required><Textarea name="reason" required/></FormField></div>
  </div><FormNotice state={state}/><div className="actions"><button className="primary" disabled={pending}>{pending?"กำลังบันทึก…":"ยืนยันคำตัดสิน"}</button></div></div></form>;
}
