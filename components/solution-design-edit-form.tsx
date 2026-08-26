"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  design: {
    id: string;
    version: number;
    solutionDesignName: string | null;
    solutionCategory: string | null;
    description: string | null;
    objective: string | null;
    targetDesignDate: string | null;
  };
  categories: Array<{ code: string; name: string }>;
};

export function SolutionDesignEditForm({design,categories}:Props){
  const router=useRouter();const[pending,setPending]=useState(false);const[message,setMessage]=useState("");
  return <form className="card form-card" onSubmit={async event=>{event.preventDefault();setPending(true);setMessage("");const form=new FormData(event.currentTarget);try{const response=await fetch(`/api/v1/solution-designs/${design.id}`,{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({expectedVersion:design.version,solutionDesignName:String(form.get("solutionDesignName")??""),solutionCategory:String(form.get("solutionCategory")??"")||null,description:String(form.get("description")??"")||null,objective:String(form.get("objective")??"")||null,targetDesignDate:String(form.get("targetDesignDate")??"")||null})});const payload=await response.json();if(!response.ok)throw new Error(payload.error?.message??"แก้ไข Solution Design ไม่สำเร็จ");router.push(`/solution-designs/${design.id}`);router.refresh();}catch(error){setMessage(error instanceof Error?error.message:"แก้ไข Solution Design ไม่สำเร็จ");}finally{setPending(false);}}}>
    <div className="card-header"><div><strong>แก้ไข Solution Design</strong><small>บันทึกชื่อ รายละเอียด และข้อมูลสรุป โดยเก็บ version history</small></div></div>
    <div className="card-body"><div className="form-grid">
      <label className="field full"><span>ชื่อ Solution</span><input className="control" name="solutionDesignName" defaultValue={design.solutionDesignName??""} maxLength={255} required/></label>
      <label className="field"><span>Solution category</span><select className="control" name="solutionCategory" defaultValue={design.solutionCategory??""}><option value="">ไม่ระบุ</option>{categories.map(category=><option key={category.code} value={category.code}>{category.name}</option>)}</select><small>จัดการจาก Admin › Solution Reference Data และไม่ใช่ Proposal Template</small></label>
      <label className="field"><span>Target date</span><input className="control" name="targetDesignDate" type="date" defaultValue={design.targetDesignDate??""}/></label>
      <label className="field full"><span>รายละเอียด</span><textarea className="control" name="description" rows={5} maxLength={10000} defaultValue={design.description??""}/></label>
      <label className="field full"><span>Objective</span><textarea className="control" name="objective" rows={5} maxLength={10000} defaultValue={design.objective??""}/></label>
    </div>{message&&<p className="notice" role="status">{message}</p>}<div className="actions"><button className="primary" disabled={pending}>{pending?"กำลังบันทึก…":"บันทึกการแก้ไข"}</button><button className="secondary" type="button" onClick={()=>router.back()}>ยกเลิก</button></div></div>
  </form>;
}
