"use client";

import { useActionState, useId, useState } from "react";

import type { FormState } from "@/app/action-types";
import { createCustomerContact, updateCustomerContact } from "@/app/actions/customer";

import { FormField, Input } from "./form-field";

const initial: FormState = {};
type ContactValue = { id:string; name:string; title:string|null; phone:string|null; email:string|null; relationship:string|null; purpose:string|null; isPrimary:boolean };

export function CustomerContactForm({ customerId, customerVersion, value }: { customerId:string; customerVersion:number; value?:ContactValue }) {
  const operation=value?updateCustomerContact.bind(null,customerId,value.id,customerVersion):createCustomerContact.bind(null,customerId,customerVersion);
  const [state,action,pending]=useActionState(operation,initial);
  const id=useId().replaceAll(":","");
  const key=useState(()=>crypto.randomUUID())[0];
  const fieldId=(name:string)=>`${id}-${name}`;
  return <form action={action} className="contact-form"><input type="hidden" name="idempotencyKey" value={key}/><div className="form-grid">
    <FormField label="ชื่อ-สกุล" name="name" htmlFor={fieldId("name")} required error={state.errors?.name}><Input id={fieldId("name")} name="name" defaultValue={value?.name} required error={!!state.errors?.name}/></FormField>
    <FormField label="ตำแหน่ง" name="title" htmlFor={fieldId("title")}><Input id={fieldId("title")} name="title" defaultValue={value?.title??""} placeholder="เช่น IT Director"/></FormField>
    <FormField label="โทรศัพท์" name="phone" htmlFor={fieldId("phone")}><Input id={fieldId("phone")} name="phone" type="tel" defaultValue={value?.phone??""}/></FormField>
    <FormField label="อีเมล" name="email" htmlFor={fieldId("email")} error={state.errors?.email}><Input id={fieldId("email")} name="email" type="email" defaultValue={value?.email??""} error={!!state.errors?.email}/></FormField>
    <FormField label="ความสัมพันธ์กับลูกค้า" name="relationship" htmlFor={fieldId("relationship")}><Input id={fieldId("relationship")} name="relationship" defaultValue={value?.relationship??""} placeholder="เช่น Decision Maker, Influencer"/></FormField>
    <FormField label="วัตถุประสงค์การติดต่อ" name="purpose" htmlFor={fieldId("purpose")}><Input id={fieldId("purpose")} name="purpose" defaultValue={value?.purpose??""} placeholder="เช่น Commercial, Technical, Billing"/></FormField>
    <label className="field contact-primary"><span><input type="checkbox" name="isPrimary" defaultChecked={value?.isPrimary??false}/> กำหนดเป็นผู้ติดต่อหลัก</span><small>เมื่อเลือก ระบบจะยกเลิก Primary ของ Contact รายอื่นใน Customer เดียวกัน</small></label>
  </div>{state.message&&<p className="notice">{state.message}</p>}<div className="actions"><button className="primary" disabled={pending}>{pending?"กำลังบันทึก…":value?"บันทึก Contact":"เพิ่ม Contact"}</button></div></form>;
}
