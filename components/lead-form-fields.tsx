"use client";

import { useState } from "react";
import { FormField, Input, Textarea } from "@/components/form-field";
import { COMPANY_SIZE_OPTIONS, type CustomerClassificationOption } from "@/lib/customer/customer-classification";
import type { ProvinceOption } from "@/lib/customer/province-reference";
import { LEAD_SOURCES } from "@/lib/constants";

export type LeadFormValue = {
  company?: string; companyNameEnglish?: string | null; taxId?: string | null; branchNumber?: string | null; customerType?: string | null; segment?: string | null; subIndustry?: string | null; companySize?: string | null; numberOfEmployees?: number | null; website?: string | null; address?: string | null; subDistrict?: string | null; district?: string | null; province?: string | null; postalCode?: string | null; region?: string | null; currentTelecomProvider?: string | null; currentInternetProvider?: string | null; currentCloudProvider?: string | null; currentSecurityProvider?: string | null; contactName?: string; jobTitle?: string | null; department?: string | null; contactEmail?: string | null; contactPhone?: string | null; source?: string; recommendedProducts?: string | null; requirementSummary?: string | null; estimatedBudget?: string | null; expectedPurchaseAt?: string | null; notes?: string | null; customerId?: string | null;
};

export function LeadFormFields({ value = {}, classifications, provinces, customers, errors }: { value?: LeadFormValue; classifications: CustomerClassificationOption[]; provinces: ProvinceOption[]; customers: Array<{ id: string; name: string; taxId: string }>; errors?: Record<string, string[]> }) {
  const [segment, setSegment] = useState(value.segment ?? "");
  const subIndustries = classifications.find(item => item.code === segment)?.subIndustries ?? [];
  const error = (name: string) => errors?.[name];
  return <>
    <section className="form-section"><h2>1. Company Information</h2><div className="form-grid">
      <FormField label="ชื่อบริษัท/หน่วยงาน" name="company" required error={error("company")}><Input name="company" defaultValue={value.company} required /></FormField>
      <FormField label="ชื่อภาษาอังกฤษ" name="companyNameEnglish"><Input name="companyNameEnglish" defaultValue={value.companyNameEnglish ?? ""} /></FormField>
      <FormField label="เลขนิติบุคคล" name="taxId"><Input name="taxId" defaultValue={value.taxId ?? ""} /></FormField>
      <FormField label="เลขสาขา" name="branchNumber"><Input name="branchNumber" defaultValue={value.branchNumber ?? ""} /></FormField>
      <FormField label="ประเภท Customer" name="customerType"><select className="control" name="customerType" defaultValue={value.customerType ?? ""}><option value="">ไม่ระบุ</option><option value="B2G">B2G — ภาครัฐ</option><option value="B2B">B2B — ภาคเอกชน</option></select></FormField>
      <FormField label="Segment" name="segment" error={error("segment")}><select className="control" name="segment" value={segment} onChange={event => setSegment(event.target.value)}><option value="">ไม่ระบุ</option>{classifications.map(item => <option key={item.code} value={item.code}>{item.code} — {item.name}</option>)}</select></FormField>
      <FormField label="อุตสาหกรรมย่อย" name="subIndustry"><select className="control" name="subIndustry" key={segment} defaultValue={subIndustries.some(item => item.code === value.subIndustry) ? value.subIndustry ?? "" : ""} disabled={!segment}><option value="">ไม่ระบุ</option>{subIndustries.map(item => <option key={item.code} value={item.code}>{item.code} — {item.name}</option>)}</select></FormField>
      <FormField label="ขนาดบริษัท" name="companySize"><select className="control" name="companySize" defaultValue={value.companySize ?? ""}><option value="">ไม่ระบุ</option>{COMPANY_SIZE_OPTIONS.map(item => <option key={item.code} value={item.code}>{item.code} — {item.name}</option>)}</select></FormField>
      <FormField label="จำนวนพนักงาน" name="numberOfEmployees"><Input name="numberOfEmployees" type="number" min="0" defaultValue={value.numberOfEmployees ?? ""} /></FormField>
      <FormField label="เว็บไซต์" name="website" error={error("website")}><Input name="website" type="url" defaultValue={value.website ?? ""} /></FormField>
      <FormField label="Customer เดิม (ถ้ามี)" name="customerId"><select className="control" name="customerId" defaultValue={value.customerId ?? ""}><option value="">ยังไม่เชื่อม</option>{customers.map(item => <option key={item.id} value={item.id}>{item.name} ({item.taxId})</option>)}</select></FormField>
    </div></section>
    <section className="form-section"><h2>2. Address and Territory</h2><div className="form-grid">
      <div className="field full"><FormField label="ที่อยู่" name="address"><Textarea name="address" defaultValue={value.address ?? ""} /></FormField></div>
      <FormField label="ตำบล/แขวง" name="subDistrict"><Input name="subDistrict" defaultValue={value.subDistrict ?? ""} /></FormField>
      <FormField label="อำเภอ/เขต" name="district"><Input name="district" defaultValue={value.district ?? ""} /></FormField>
      <FormField label="จังหวัด" name="province" error={error("province")}><Input name="province" list="thai-provinces" defaultValue={value.province ?? ""} placeholder="พิมพ์รหัสหรือชื่อจังหวัดเพื่อค้นหา" autoComplete="off" /><datalist id="thai-provinces">{provinces.map(item => <option key={item.code} value={item.name}>{item.code} — {item.name} · {item.region}</option>)}</datalist></FormField>
      <FormField label="รหัสไปรษณีย์" name="postalCode"><Input name="postalCode" defaultValue={value.postalCode ?? ""} /></FormField>
      <FormField label="ภูมิภาค" name="region"><Input name="region" defaultValue={value.region ?? ""} /></FormField>
    </div></section>
    <section className="form-section"><h2>3. Primary Contact</h2><div className="form-grid">
      <FormField label="ชื่อผู้ติดต่อ" name="contactName" required error={error("contactName")}><Input name="contactName" defaultValue={value.contactName} required /></FormField>
      <FormField label="ตำแหน่ง" name="jobTitle"><Input name="jobTitle" defaultValue={value.jobTitle ?? ""} /></FormField>
      <FormField label="ฝ่าย / แผนก" name="department"><Input name="department" defaultValue={value.department ?? ""} /></FormField>
      <FormField label="อีเมล" name="contactEmail" error={error("contactEmail")}><Input name="contactEmail" type="email" defaultValue={value.contactEmail ?? ""} /></FormField>
      <FormField label="โทรศัพท์" name="contactPhone" error={error("contactPhone")}><Input name="contactPhone" defaultValue={value.contactPhone ?? ""} /></FormField>
    </div></section>
    <section className="form-section"><h2>4. Business, Providers and Opportunity</h2><div className="form-grid">
      <FormField label="Telecom Provider" name="currentTelecomProvider"><Input name="currentTelecomProvider" defaultValue={value.currentTelecomProvider ?? ""} /></FormField>
      <FormField label="Internet Provider" name="currentInternetProvider"><Input name="currentInternetProvider" defaultValue={value.currentInternetProvider ?? ""} /></FormField>
      <FormField label="Cloud Provider" name="currentCloudProvider"><Input name="currentCloudProvider" defaultValue={value.currentCloudProvider ?? ""} /></FormField>
      <FormField label="Security Provider" name="currentSecurityProvider"><Input name="currentSecurityProvider" defaultValue={value.currentSecurityProvider ?? ""} /></FormField>
      <FormField label="Estimated Opportunity Value" name="estimatedBudget" error={error("estimatedBudget")}><Input name="estimatedBudget" type="number" min="0" step="0.0001" defaultValue={value.estimatedBudget ?? ""} /></FormField>
      <FormField label="Target Close Date" name="expectedPurchaseAt"><Input name="expectedPurchaseAt" type="date" defaultValue={value.expectedPurchaseAt ?? ""} /></FormField>
      <div className="field full"><FormField label="Business Pain Points / Requirement" name="requirementSummary"><Textarea name="requirementSummary" defaultValue={value.requirementSummary ?? ""} /></FormField></div>
      <div className="field full"><FormField label="Recommended Products" name="recommendedProducts" error={error("recommendedProducts")}><Textarea name="recommendedProducts" defaultValue={value.recommendedProducts ?? ""} /></FormField></div>
    </div></section>
    <section className="form-section"><h2>5. Source and Notes</h2><div className="form-grid">
      <FormField label="แหล่งที่มา" name="source" required><select className="control" name="source" defaultValue={value.source ?? "WEBSITE"}>{LEAD_SOURCES.map(([source, label]) => <option key={source} value={source}>{label}</option>)}</select></FormField>
      <div className="field full"><FormField label="บันทึก" name="notes" error={error("notes")}><Textarea name="notes" defaultValue={value.notes ?? ""} /></FormField></div>
    </div></section>
  </>;
}
