"use client";

import { ArchiveRestore, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { PROSPECT_DELETE_REASONS } from "@/lib/data-retention/data-retention-policy";
import { Notice, type NoticeVariant } from "./notice";

const reasonLabels: Record<(typeof PROSPECT_DELETE_REASONS)[number], string> = {
  DUPLICATE: "ข้อมูลซ้ำ",
  WRONG_COMPANY: "บริษัทไม่ถูกต้อง",
  INVALID_DATA: "ข้อมูลไม่ถูกต้อง",
  COMPANY_CLOSED: "บริษัทปิดกิจการ",
  OTHER: "อื่น ๆ",
};

type Feedback = { text: string; variant: NoticeVariant } | null;

export function ProspectSoftDeleteAction({ id, version }: { id: string; version: number }) {
  const router = useRouter(); const [open, setOpen] = useState(false); const [pending, setPending] = useState(false); const [feedback, setFeedback] = useState<Feedback>(null);
  return <div className="retention-action">
    <button className="danger-secondary" type="button" onClick={() => setOpen(value => !value)}><Trash2 aria-hidden="true"/>ลบแบบกู้คืนได้</button>
    {open&&<form onSubmit={async event=>{
      event.preventDefault(); if (!confirm("ยืนยันซ่อน Prospect นี้จากผู้ใช้ทั่วไป? ผู้ดูแลระบบสามารถกู้คืนได้")) return;
      setPending(true); setFeedback(null); const reason=new FormData(event.currentTarget).get("reason");
      try { const response=await fetch(`/api/v1/prospects/${id}`,{method:"DELETE",headers:{"content-type":"application/json","idempotency-key":crypto.randomUUID()},body:JSON.stringify({expectedVersion:version,reason})});const result=await response.json();if(!response.ok)throw new Error(result.error?.message??"ลบ Prospect ไม่สำเร็จ");setFeedback({text:"ลบ Prospect แบบกู้คืนได้แล้ว",variant:"success"});router.push("/prospects");router.refresh(); }
      catch(error){setFeedback({text:error instanceof Error?error.message:"ลบ Prospect ไม่สำเร็จ",variant:"error"});setPending(false);}
    }} className="retention-inline-form"><label className="field"><span>เหตุผล <span className="required">*</span></span><select className="control" name="reason" required defaultValue=""><option value="" disabled>เลือกเหตุผล</option>{PROSPECT_DELETE_REASONS.map(reason=><option key={reason} value={reason}>{reasonLabels[reason]}</option>)}</select></label><div className="actions"><button type="button" className="secondary" onClick={()=>setOpen(false)}>ยกเลิก</button><button className="danger" disabled={pending}>{pending?"กำลังดำเนินการ…":"ยืนยัน Soft Delete"}</button></div></form>}
    {feedback&&<Notice variant={feedback.variant}>{feedback.text}</Notice>}
  </div>;
}

export function DeletedProspectActions({ id, version, canPermanentlyDelete }: { id: string; version: number; canPermanentlyDelete: boolean }) {
  const router=useRouter();const[pending,setPending]=useState(false);const[feedback,setFeedback]=useState<Feedback>(null);
  const request=async(method:"POST"|"DELETE",path:string)=>{setPending(true);setFeedback(null);try{const response=await fetch(path,{method,headers:{"content-type":"application/json"},body:JSON.stringify({expectedVersion:version})});const result=await response.json();if(!response.ok)throw new Error(result.error?.code==="PERMANENT_DELETE_BLOCKED"?`ลบถาวรไม่ได้: ${(result.error.data?.references??[]).join(", ")}`:result.error?.message??"ดำเนินการไม่สำเร็จ");setFeedback({text:method==="POST"?"กู้คืน Prospect แล้ว":"ลบข้อมูลถาวรแล้ว",variant:"success"});router.refresh();}catch(error){setFeedback({text:error instanceof Error?error.message:"ดำเนินการไม่สำเร็จ",variant:"error"});}finally{setPending(false);}};
  return <div className="retention-row-actions"><button className="secondary" disabled={pending} onClick={()=>request("POST",`/api/v1/admin/deleted-records/prospects/${id}/restore`)}><ArchiveRestore aria-hidden="true"/>กู้คืน</button>{canPermanentlyDelete&&<button className="danger-secondary" disabled={pending} onClick={()=>confirm("ลบถาวรเฉพาะข้อมูลทดสอบ/นำเข้าผิดที่ไม่มีธุรกรรมและ Audit เท่านั้น ยืนยันหรือไม่?")&&request("DELETE",`/api/v1/admin/deleted-records/prospects/${id}`)}><Trash2 aria-hidden="true"/>ลบถาวร</button>}{feedback&&<Notice variant={feedback.variant}>{feedback.text}</Notice>}</div>;
}

export function CustomerLifecycleActions({id,version}:{id:string;version:number}){
  const router=useRouter();const[pending,setPending]=useState(false);const[feedback,setFeedback]=useState<Feedback>(null);const[reason,setReason]=useState("");
  const submit=async(status:"INACTIVE"|"BLACKLISTED"|"CLOSED")=>{if(reason.trim().length<3){setFeedback({text:"กรุณาระบุเหตุผลอย่างน้อย 3 ตัวอักษร",variant:"error"});return;}setPending(true);setFeedback(null);try{const response=await fetch(`/api/v1/customers/${id}/lifecycle`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({expectedVersion:version,status,reason})});const result=await response.json();if(!response.ok)throw new Error(result.error?.message??"เปลี่ยนสถานะ Customer ไม่สำเร็จ");setFeedback({text:"เปลี่ยนสถานะ Customer แล้ว",variant:"success"});router.refresh();}catch(error){setFeedback({text:error instanceof Error?error.message:"เปลี่ยนสถานะ Customer ไม่สำเร็จ",variant:"error"});}finally{setPending(false);}};
  return <section className="card compact-card"><div className="card-header"><div><strong>Customer lifecycle</strong><small>ไม่มีการลบ Customer และข้อมูลธุรกรรมเดิม</small></div></div><div className="card-body"><label className="field"><span>เหตุผล <span className="required">*</span></span><textarea className="control" value={reason} onChange={event=>setReason(event.target.value)} minLength={3}/></label><div className="actions"><button className="secondary" disabled={pending} onClick={()=>submit("INACTIVE")}>Deactivate</button><button className="secondary" disabled={pending} onClick={()=>submit("BLACKLISTED")}>Blacklist</button><button className="danger-secondary" disabled={pending} onClick={()=>submit("CLOSED")}>Close Account</button></div>{feedback&&<Notice variant={feedback.variant}>{feedback.text}</Notice>}</div></section>;
}
