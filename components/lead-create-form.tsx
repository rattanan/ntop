"use client";

import { useActionState, useState } from "react";
import { createLead } from "@/app/actions/lead";
import type { FormState } from "@/app/action-types";
import type { CustomerClassificationOption } from "@/lib/customer/customer-classification";
import type { ProvinceOption } from "@/lib/customer/province-reference";
import { LeadFormFields } from "./lead-form-fields";
import { FormField, Textarea } from "./form-field";
import { FormNotice } from "./notice";

export function LeadCreateForm({ customers, classifications, provinces }: { customers: Array<{ id: string; name: string; taxId: string }>; classifications: CustomerClassificationOption[]; provinces: ProvinceOption[] }) {
  const [state, action, pending] = useActionState(createLead, {} as FormState);
  const key = useState(() => crypto.randomUUID())[0];
  return <form action={action} className="card form-card"><div className="card-body">
    <input type="hidden" name="idempotencyKey" value={key}/><input type="hidden" name="status" value="NEW"/><input type="hidden" name="score" value="0"/>
    <p>ใช้โครงสร้างข้อมูลหลักชุดเดียวกับ Prospect และระบบจะตรวจข้อมูลซ้ำก่อนสร้าง</p>
    <LeadFormFields customers={customers} classifications={classifications} provinces={provinces} errors={state.errors}/>
    <section className="form-section"><FormField label="เหตุผลยืนยันสร้างต่อเมื่อพบรายการซ้ำ" name="duplicateOverrideReason" help="เว้นว่างในครั้งแรก ระบบจะแจ้งจำนวนรายการที่อาจซ้ำ"><Textarea name="duplicateOverrideReason" minLength={5}/></FormField></section>
    <FormNotice state={state}/><div className="actions"><button className="primary" disabled={pending}>{pending ? "กำลังตรวจสอบและบันทึก…" : "ตรวจสอบและสร้าง Lead"}</button></div>
  </div></form>;
}
