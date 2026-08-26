"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ProspectSource, ProspectStatus } from "@prisma/client";
import { useEffect, useState } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { useRouter } from "next/navigation";

import { Notice } from "@/components/notice";
import { FormField, Input, Textarea } from "@/components/form-field";
import { COMPANY_SIZE_OPTIONS, omitBlankLegacySubIndustry, type CustomerClassificationOption } from "@/lib/customer/customer-classification-options";
import { prospectCommandSchema, type ProspectCommand } from "@/lib/prospect/prospect-validation";

const sources = Object.values(ProspectSource);
const statuses = Object.values(ProspectStatus).filter(
  (value) => value !== "CONVERTED" && value !== "ARCHIVED",
);

function firstFormError(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (typeof record.message === "string") return record.message;
  for (const nested of Object.values(record)) {
    const message = firstFormError(nested);
    if (message) return message;
  }
  return null;
}

export function ProspectForm({
  prospect,
  classifications,
  preserveLegacySubIndustry = false,
}: {
  prospect?: Partial<ProspectCommand> & { id: string; version: number };
  classifications: CustomerClassificationOption[];
  preserveLegacySubIndustry?: boolean;
}) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [duplicates, setDuplicates] = useState<
    Array<{ id: string; prospectCode: string; companyName: string }>
  >([]);
  const defaultValues = prospect
    ? (Object.fromEntries(
        Object.entries(prospect).filter(([key]) => key !== "id" && key !== "version"),
      ) as Partial<ProspectCommand>)
    : {
        source: "MANUAL" as const,
        status: "NEW" as const,
        contact: { name: "", email: "", isPrimary: true },
      };
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<ProspectCommand>({
    resolver: zodResolver(prospectCommandSchema) as Resolver<ProspectCommand>,
    defaultValues,
  });

  useEffect(() => {
    if (!prospect) {
      const subscription = watch((value) =>
        localStorage.setItem("ntop-prospect-draft", JSON.stringify(value)),
      );
      return () => subscription.unsubscribe();
    }
  }, [prospect, watch]);

  useEffect(() => {
    const warning = (event: BeforeUnloadEvent) => {
      if (isDirty) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warning);
    return () => window.removeEventListener("beforeunload", warning);
  }, [isDirty]);

  const submit = handleSubmit(
    async (values) => {
      setMessage("");
      setDuplicates([]);
      const submitValues = omitBlankLegacySubIndustry(values, preserveLegacySubIndustry);
      const response = await fetch(
        prospect ? `/api/v1/prospects/${prospect.id}` : "/api/v1/prospects",
        {
          method: prospect ? "PATCH" : "POST",
          headers: {
            "content-type": "application/json",
            "idempotency-key": crypto.randomUUID(),
          },
          body: JSON.stringify(
            prospect ? { ...submitValues, expectedVersion: prospect.version } : submitValues,
          ),
        },
      );
      const result = await response.json();
      if (
        response.status === 409 &&
        result.error?.code === "DUPLICATE_RESOLUTION_REQUIRED"
      ) {
        setDuplicates(result.error.data ?? []);
        setMessage("พบ Prospect ที่อาจซ้ำ กรุณาเปิดรายการเดิมหรือระบุเหตุผลเพื่อสร้างต่อ");
        return;
      }
      if (!response.ok) {
        setMessage(result.error?.message ?? "บันทึกไม่สำเร็จ");
        return;
      }
      localStorage.removeItem("ntop-prospect-draft");
      router.push(`/prospects/${result.data.id}`);
      router.refresh();
    },
    (invalid) => {
      setDuplicates([]);
      setMessage(firstFormError(invalid) ?? "กรุณาตรวจสอบข้อมูลที่กรอก");
    },
  );

  const selectedSegment = watch("organizationType") ?? "";
  const subIndustries = classifications.find((item) => item.code === selectedSegment)?.subIndustries ?? [];

  const field = (
    name: keyof ProspectCommand,
    label: string,
    type = "text",
    required = false,
  ) => (
    <FormField label={label} name={String(name)} required={required} error={errors[name]?.message ? [String(errors[name]?.message)] : undefined}>
      <Input type={type} required={required} error={Boolean(errors[name])} {...register(name as never)} />
    </FormField>
  );

  return (
    <form className="card form-card" onSubmit={submit}>
      <div className="card-body">
        <section className="form-section">
          <h2>1. Company Information</h2>
          <div className="form-grid">
            {field("companyName", "ชื่อบริษัท/หน่วยงาน", "text", true)}
            {field("companyNameEnglish", "ชื่อภาษาอังกฤษ")}
            {field("taxId", "เลขผู้เสียภาษี 13 หลัก")}
            {field("branchNumber", "เลขสาขา")}
            <FormField label="ประเภท Customer" name="customerType"><select className="control" {...register("customerType")}><option value="">ไม่ระบุ</option><option value="B2G">B2G — ภาครัฐ</option><option value="B2B">B2B — ภาคเอกชน</option></select></FormField>
            <FormField label="Segment" name="organizationType"><select className="control" {...register("organizationType", { onChange: () => setValue("subIndustry", "", { shouldDirty: true }) })}><option value="">เลือก Segment</option>{classifications.map(item => <option key={item.code} value={item.code}>{item.code} — {item.name}</option>)}</select></FormField>
            <FormField label="อุตสาหกรรมย่อย" name="subIndustry" help={preserveLegacySubIndustry ? "ค่าเดิมไม่อยู่ในรายการอ้างอิง ระบบจะเก็บค่าเดิมไว้จนกว่าจะเลือกรายการใหม่" : undefined}><select className="control" disabled={!selectedSegment} {...register("subIndustry")}><option value="">ไม่ระบุ</option>{subIndustries.map(item => <option key={item.code} value={item.code}>{item.code} — {item.name}</option>)}</select></FormField>
            <FormField label="ขนาดบริษัท" name="companySize"><select className="control" {...register("companySize")}><option value="">ไม่ระบุ</option>{COMPANY_SIZE_OPTIONS.map(item => <option key={item.code} value={item.code}>{item.code} — {item.name}</option>)}</select></FormField>
            <FormField label="จำนวนพนักงาน" name="numberOfEmployees">
              <Input
                type="number"
                min="0"
                {...register("numberOfEmployees", {
                  setValueAs: (value) => (value === "" ? undefined : Number(value)),
                })}
              />
            </FormField>
            {field("website", "เว็บไซต์", "url")}
          </div>
        </section>
        <section className="form-section">
          <h2>2. Address and Territory</h2>
          <div className="form-grid">
            {field("address", "ที่อยู่")}
            {field("subDistrict", "ตำบล/แขวง")}
            {field("district", "อำเภอ/เขต")}
            {field("province", "จังหวัด")}
            {field("postalCode", "รหัสไปรษณีย์")}
            {field("region", "ภูมิภาค")}
          </div>
        </section>
        <section className="form-section">
          <h2>3. Primary Contact (ไม่บังคับ)</h2>
          <div className="form-grid">
            <label className="field"><span>ชื่อผู้ติดต่อ</span><input className="control" {...register("contact.name")} /></label>
            <label className="field"><span>ตำแหน่ง</span><input className="control" {...register("contact.position")} /></label>
            <label className="field"><span>อีเมล</span><input className="control" type="email" {...register("contact.email")} /></label>
            <label className="field"><span>โทรศัพท์</span><input className="control" {...register("contact.phone")} /></label>
            <label className="field"><span>มือถือ</span><input className="control" {...register("contact.mobile")} /></label>
            <label className="field"><span>LINE ID</span><input className="control" {...register("contact.lineId")} /></label>
          </div>
        </section>
        <section className="form-section">
          <h2>4–6. Business, Providers and Opportunity</h2>
          <div className="form-grid">
            {field("currentTelecomProvider", "Telecom Provider")}
            {field("currentInternetProvider", "Internet Provider")}
            {field("currentCloudProvider", "Cloud Provider")}
            {field("currentSecurityProvider", "Security Provider")}
            <FormField label="Expected Budget" name="expectedBudget"><Input type="number" min="0" step="0.01" {...register("expectedBudget")} /></FormField>
            <FormField label="Estimated Opportunity Value" name="estimatedOpportunityValue"><Input type="number" min="0" step="0.01" {...register("estimatedOpportunityValue")} /></FormField>
            {field("expectedPurchasePeriod", "Expected Purchase Period")}
            {field("currentContractEndDate", "Target Close Date", "date")}
            <div className="field full"><FormField label="Business Pain Points" name="businessPainPoints"><Textarea {...register("businessPainPoints")} /></FormField></div>
            <div className="field full"><FormField label="Recommended Products" name="recommendedProducts"><Textarea {...register("recommendedProducts")} /></FormField></div>
          </div>
        </section>
        <section className="form-section">
          <h2>7–9. Source, Ownership and Notes</h2>
          <div className="form-grid">
            <label className="field"><span>Source</span><select className="control" required {...register("source")}>{sources.map((value) => <option key={value}>{value}</option>)}</select></label>
            <label className="field"><span>Status</span><select className="control" required {...register("status")}>{statuses.map((value) => <option key={value}>{value}</option>)}</select></label>
            {field("sourceName", "ชื่อแหล่งที่มา")}
            {field("referralName", "ผู้แนะนำ")}
            <label className="field full"><span>Notes</span><textarea className="control" {...register("notes")} /></label>
            <label className="field full"><span>เหตุผลสร้างต่อเมื่อพบข้อมูลซ้ำ</span><textarea className="control" {...register("duplicateOverrideReason")} /></label>
          </div>
        </section>
        {duplicates.length > 0 && (
          <Notice variant="warning">
            {duplicates.map((item) => (
              <p key={item.id}><a className="link" href={`/prospects/${item.id}`}>{item.prospectCode} · {item.companyName}</a></p>
            ))}
          </Notice>
        )}
        {message && (
          <Notice variant={duplicates.length > 0 ? "warning" : "error"}>{message}</Notice>
        )}
        <div className="actions">
          <button type="button" className="secondary" onClick={() => router.back()}>ยกเลิก</button>
          <button type="submit" className="primary" disabled={isSubmitting}>
            {isSubmitting ? "กำลังบันทึก…" : prospect ? "บันทึกการแก้ไข" : "สร้าง Prospect"}
          </button>
        </div>
      </div>
    </form>
  );
}
