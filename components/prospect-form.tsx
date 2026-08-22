"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ProspectSource, ProspectStatus } from "@prisma/client";
import { ExternalLink, LoaderCircle, Search, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { useRouter } from "next/navigation";

import { Notice } from "@/components/notice";
import { prospectCommandSchema, type ProspectCommand } from "@/lib/prospect/prospect-validation";

const sources = Object.values(ProspectSource);
const statuses = Object.values(ProspectStatus).filter(
  (value) => value !== "CONVERTED" && value !== "ARCHIVED",
);

type ResearchField =
  | "companyNameEnglish"
  | "taxId"
  | "branchNumber"
  | "customerType"
  | "organizationType"
  | "subIndustry"
  | "companySize"
  | "numberOfEmployees"
  | "website"
  | "address"
  | "subDistrict"
  | "district"
  | "province"
  | "postalCode"
  | "region"
  | "currentTelecomProvider"
  | "currentInternetProvider"
  | "currentCloudProvider"
  | "currentSecurityProvider";

type ResearchResult = {
  matchedCompanyName: string;
  matchConfidence: number;
  fields: Record<ResearchField, string | number | null>;
  warnings: string[];
  sources: Array<{ title: string; url: string }>;
};

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

function isEmpty(value: unknown) {
  return value === undefined || value === null || value === "";
}

function sourceReference(sources: Array<{ url: string }>) {
  const selected: string[] = [];
  for (const source of sources) {
    const next = [...selected, source.url].join("\n");
    if (next.length > 500) break;
    selected.push(source.url);
  }
  return selected.join("\n");
}

export function ProspectForm({
  prospect,
}: {
  prospect?: Partial<ProspectCommand> & { id: string; version: number };
}) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [duplicates, setDuplicates] = useState<
    Array<{ id: string; prospectCode: string; companyName: string }>
  >([]);
  const [isResearching, setIsResearching] = useState(false);
  const [researchMessage, setResearchMessage] = useState("");
  const [researchResult, setResearchResult] = useState<ResearchResult | null>(null);
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
    getValues,
    setValue,
    trigger,
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

  async function researchCompany() {
    setResearchMessage("");
    setResearchResult(null);
    if (!(await trigger("companyName"))) {
      setResearchMessage("กรุณาระบุชื่อบริษัท/หน่วยงานอย่างน้อย 2 ตัวอักษร");
      return;
    }
    const companyName = getValues("companyName").trim();
    setIsResearching(true);
    try {
      const response = await fetch("/api/v1/prospects/research", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ companyName }),
      });
      const result = await response.json();
      if (!response.ok) {
        setResearchMessage(
          result.error?.message ?? "ไม่สามารถค้นข้อมูลบริษัทได้ กรุณาลองใหม่",
        );
        return;
      }
      const research = result.data as ResearchResult;
      let populated = 0;
      for (const [name, value] of Object.entries(research.fields) as Array<
        [ResearchField, string | number | null]
      >) {
        if (value === null || !isEmpty(getValues(name))) continue;
        setValue(name, value as never, { shouldDirty: true, shouldValidate: true });
        populated += 1;
      }
      if (isEmpty(getValues("sourceReference"))) {
        const reference = sourceReference(research.sources);
        if (reference) {
          setValue("sourceReference", reference, { shouldDirty: true });
        }
      }
      setResearchResult(research);
      setResearchMessage(
        populated > 0
          ? `AI เติมข้อมูลให้ ${populated} ช่องแล้ว กรุณาตรวจสอบก่อนกด Save`
          : "ไม่พบช่องว่างที่เติมได้ ข้อมูลเดิมของคุณถูกเก็บไว้ทั้งหมด",
      );
    } catch {
      setResearchMessage("เชื่อมต่อ AI Search ไม่สำเร็จ กรุณาลองใหม่");
    } finally {
      setIsResearching(false);
    }
  }

  const submit = handleSubmit(
    async (values) => {
      setMessage("");
      setDuplicates([]);
      const response = await fetch(
        prospect ? `/api/v1/prospects/${prospect.id}` : "/api/v1/prospects",
        {
          method: prospect ? "PATCH" : "POST",
          headers: {
            "content-type": "application/json",
            "idempotency-key": crypto.randomUUID(),
          },
          body: JSON.stringify(
            prospect ? { ...values, expectedVersion: prospect.version } : values,
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

  const field = (name: keyof ProspectCommand, label: string, type = "text") => (
    <label className="field">
      <span>{label}</span>
      <input className="control" type={type} {...register(name as never)} />
      {errors[name] && (
        <small className="error">
          {String(errors[name]?.message ?? "ข้อมูลไม่ถูกต้อง")}
        </small>
      )}
    </label>
  );

  return (
    <form className="card form-card" onSubmit={submit}>
      <div className="card-body">
        <input type="hidden" {...register("sourceReference")} />
        <section className="form-section">
          <h2>1. Company Information</h2>
          <div className="form-grid">
            <label className="field">
              <span>ชื่อบริษัท/หน่วยงาน</span>
              <span className="prospect-search-control">
                <input
                  className="control"
                  aria-describedby={!prospect ? "company-research-feedback" : undefined}
                  {...register("companyName")}
                />
                {!prospect && (
                  <button
                    type="button"
                    className="secondary prospect-search-button"
                    onClick={researchCompany}
                    disabled={isResearching || isSubmitting}
                    aria-label="Search company information with AI"
                  >
                    {isResearching ? (
                      <LoaderCircle className="spin" aria-hidden="true" />
                    ) : (
                      <Search aria-hidden="true" />
                    )}
                    {isResearching ? "Searching…" : "Search"}
                  </button>
                )}
              </span>
              {errors.companyName && (
                <small className="error">{errors.companyName.message}</small>
              )}
            </label>
            {field("companyNameEnglish", "ชื่อภาษาอังกฤษ")}
            {field("taxId", "เลขผู้เสียภาษี 13 หลัก")}
            {field("branchNumber", "เลขสาขา")}
            {field("customerType", "ประเภทลูกค้า")}
            {field("organizationType", "ประเภทองค์กร")}
            {field("subIndustry", "อุตสาหกรรมย่อย")}
            {field("companySize", "ขนาดบริษัท")}
            <label className="field">
              <span>จำนวนพนักงาน</span>
              <input
                className="control"
                type="number"
                min="0"
                {...register("numberOfEmployees", {
                  setValueAs: (value) => (value === "" ? undefined : Number(value)),
                })}
              />
            </label>
            {field("website", "เว็บไซต์", "url")}
          </div>
          {!prospect && (researchMessage || researchResult) && (
            <div
              id="company-research-feedback"
              className={`prospect-research-result ${researchResult ? "" : "research-error"}`.trim()}
              role={researchResult ? "status" : "alert"}
              aria-live={researchResult ? "polite" : "assertive"}
            >
              <div className="prospect-research-heading">
                <Sparkles aria-hidden="true" />
                <div>
                  <strong>{researchMessage}</strong>
                  {researchResult && (
                    <small>
                      พบข้อมูลของ {researchResult.matchedCompanyName} · ความมั่นใจ{" "}
                      {researchResult.matchConfidence}%
                    </small>
                  )}
                </div>
              </div>
              {researchResult?.warnings.map((warning) => (
                <p key={warning}>{warning}</p>
              ))}
              {researchResult && (
                <div className="prospect-research-sources">
                  <span>แหล่งข้อมูล</span>
                  {researchResult.sources.map((source) => (
                    <a key={source.url} href={source.url} target="_blank" rel="noreferrer">
                      {source.title}
                      <ExternalLink aria-hidden="true" />
                    </a>
                  ))}
                </div>
              )}
            </div>
          )}
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
          <h2>3. Primary Contact</h2>
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
            {field("expectedBudget", "Expected Budget")}
            {field("estimatedOpportunityValue", "Estimated Opportunity Value")}
            {field("expectedPurchasePeriod", "Expected Purchase Period")}
            {field("currentContractEndDate", "Contract End Date", "date")}
            <label className="field full"><span>Business Pain Points</span><textarea className="control" {...register("businessPainPoints")} /></label>
            <label className="field full"><span>Recommended Products</span><textarea className="control" {...register("recommendedProducts")} /></label>
          </div>
        </section>
        <section className="form-section">
          <h2>7–9. Source, Ownership and Notes</h2>
          <div className="form-grid">
            <label className="field"><span>Source</span><select className="control" {...register("source")}>{sources.map((value) => <option key={value}>{value}</option>)}</select></label>
            <label className="field"><span>Status</span><select className="control" {...register("status")}>{statuses.map((value) => <option key={value}>{value}</option>)}</select></label>
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
          <button type="submit" className="primary" disabled={isSubmitting || isResearching}>
            {isSubmitting ? "กำลังบันทึก…" : prospect ? "บันทึกการแก้ไข" : "สร้าง Prospect"}
          </button>
        </div>
      </div>
    </form>
  );
}
