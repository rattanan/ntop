import { ArrowRight, BadgeCheck, BrainCircuit, Pencil, ShieldAlert, TrendingUp } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ProspectActionForms, ProspectActivityManager, ProspectAiInsightActions, ProspectContactManager, ProspectDocumentList, ProspectDocumentUpload, type ProspectAiInsightDraft } from "@/components/prospect-action-forms";
import { ProspectSoftDeleteAction } from "@/components/data-retention-actions";
import { requireSession } from "@/lib/auth";
import { loadAssignableOwnerOptions, loadAuthorizationContext } from "@/lib/authorization/authorization-context";
import { PERMISSIONS } from "@/lib/authorization/permission-policy";
import { buildProspectScopeWhere, loadProspectPermissions } from "@/lib/prospect/prospect-authorization";
import { formatDocumentSize } from "@/lib/prospect/prospect-document-format";
import { prisma } from "@/lib/prisma";

function scoreLevel(score: number | null, inverse = false) {
  if (score === null) return "neutral";
  const normalized = inverse ? 100 - score : score;
  return normalized >= 70 ? "positive" : normalized >= 40 ? "caution" : "negative";
}

function AiScore({ label, score, description, inverse = false, icon }: { label: string; score: number | null; description: string; inverse?: boolean; icon: React.ReactNode }) {
  const value = score ?? 0;
  return (
    <div className={`ai-score ai-score-${scoreLevel(score, inverse)}`}>
      <div className="ai-score-ring" role="meter" aria-label={`${label} ${score === null ? "ยังไม่มีคะแนน" : `${score} จาก 100`}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={score ?? undefined} style={{ "--score": value } as React.CSSProperties}>
        <span aria-hidden="true">{score ?? "—"}</span>
        <small aria-hidden="true">/100</small>
      </div>
      <div className="ai-score-copy">
        <strong>{icon}{label}</strong>
        <span>{description}</span>
      </div>
    </div>
  );
}

function aiInsightDraft(value: unknown): ProspectAiInsightDraft | null {
  const output = value && typeof value === "object" && "output" in value ? (value as { output?: unknown }).output : null;
  if (!output || typeof output !== "object") return null;
  const data = output as Record<string, unknown>;
  if (typeof data.companySummary !== "string" || typeof data.opportunityScore !== "number" || typeof data.riskScore !== "number" || typeof data.confidenceScore !== "number") return null;
  return {
    companySummary: data.companySummary,
    opportunityScore: data.opportunityScore,
    riskScore: data.riskScore,
    confidenceScore: data.confidenceScore,
    recommendedProducts: Array.isArray(data.recommendedProducts) ? data.recommendedProducts.filter((item): item is string => typeof item === "string") : [],
    suggestedNextAction: typeof data.suggestedNextAction === "string" ? data.suggestedNextAction : "",
  };
}

function bangkokDateTimeInput(value: Date | null) {
  if (!value) return "";
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(value);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find(part => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

export default async function ProspectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const context = await loadAuthorizationContext({ actorId: session.id, legacyRole: session.role });
  const permissions = await loadProspectPermissions(context);
  const { id } = await params;
  const [prospect, owners] = await Promise.all([
    prisma.prospect.findFirst({
      where: { id, ...buildProspectScopeWhere(context, permissions) },
      include: {
        owner: { select: { id: true, name: true } }, industry: true, salesTerritory: true,
        contacts: { where: { deletedAt: null }, orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] },
        activities: { where: { deletedAt: null }, include: { owner: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 200 },
        documents: { where: { deletedAt: null }, orderBy: { createdAt: "desc" } },
        statusHistory: { orderBy: { transitionedAt: "desc" } }, assignmentHistory: { orderBy: { assignedAt: "desc" } },
        convertedLead: { select: { id: true, leadNumber: true } },
      },
    }),
    permissions.has(PERMISSIONS.prospectAssign) ? loadAssignableOwnerOptions(context) : Promise.resolve([]),
  ]);
  if (!prospect) notFound();
  const canUpdate = permissions.has(PERMISSIONS.prospectUpdate);
  const canConvert = permissions.has(PERMISSIONS.prospectConvert);
  const primaryContact = prospect.contacts.find((contact) => contact.isPrimary) ?? prospect.contacts[0];
  const insightDraft = prospect.enrichmentStatus === "READY" ? aiInsightDraft(prospect.enrichmentData) : null;
  const activities = prospect.activities.map(activity => ({
    id: activity.id,
    version: activity.version,
    type: activity.type,
    subject: activity.subject,
    description: activity.notes ?? activity.description ?? "",
    nextFollowUpAt: bangkokDateTimeInput(activity.nextFollowUpAt ?? activity.dueAt),
    ownerName: activity.owner.name,
    createdAt: activity.createdAt.toISOString(),
  }));
  const documents = prospect.documents.map(document => ({
    id: document.id,
    fileName: document.fileName,
    category: document.category,
    mimeType: document.mimeType,
    formattedSize: formatDocumentSize(document.sizeBytes),
  }));

  return <>
    <div className="customer-hero">
      <div>
        <p className="eyebrow">{prospect.prospectCode}</p><h1>{prospect.companyName}</h1>
        <div className="customer-meta"><span className="badge">{prospect.status}</span><span className={`badge prospect-${prospect.heatLevel.toLowerCase()}`}>{prospect.heatLevel} · {prospect.calculatedScore}</span><span>Owner: {prospect.owner.name}</span></div>
      </div>
      <div className="actions record-head-actions">{prospect.convertedLead && <Link className="primary" href={`/leads/${prospect.convertedLead.id}`}>เปิด Lead {prospect.convertedLead.leadNumber}<ArrowRight aria-hidden="true" /></Link>}{canConvert && prospect.status === "QUALIFIED" && <Link className="primary" href="#prospect-conversion">สร้าง Lead จากข้อมูลนี้<ArrowRight aria-hidden="true" /></Link>}{permissions.has(PERMISSIONS.prospectSoftDelete)&&!prospect.convertedLead&&<ProspectSoftDeleteAction id={id} version={prospect.version}/>} {canUpdate && <Link className="secondary" href={`/prospects/${id}/edit`}><Pencil aria-hidden="true" />แก้ไข</Link>}</div>
    </div>

    <div className="detail-columns prospect-overview-row">
      <section className="card"><div className="card-header">Overview</div><div className="card-body detail-grid">
        <div><p className="detail-label">Industry</p><p>{prospect.industry?.name ?? prospect.subIndustry ?? "—"}</p></div>
        <div><p className="detail-label">Province / Region</p><p>{prospect.province ?? "—"} / {prospect.region ?? "—"}</p></div>
        <div><p className="detail-label">Estimated Value</p><p>{prospect.estimatedOpportunityValue?.toString() ?? "—"} {prospect.currency}</p></div>
        <div><p className="detail-label">Pain Points</p><p>{prospect.businessPainPoints ?? "—"}</p></div>
        <div><p className="detail-label">Recommended Products</p><p>{prospect.recommendedProducts ?? "—"}</p></div>
        <div><p className="detail-label">Next Follow-up</p><p>{prospect.nextFollowUpAt?.toLocaleString("th-TH", { timeZone: "Asia/Bangkok" }) ?? "—"}</p></div>
      </div></section>

      <section className="card ai-insight-card" aria-labelledby="ai-insight-heading">
        <div className="card-header ai-insight-header"><div><span className="ai-insight-icon"><BrainCircuit aria-hidden="true" /></span><div><span id="ai-insight-heading">AI Insight</span><small>ข้อมูลช่วยตัดสินใจจาก AI enrichment</small></div></div><span className="badge muted">{prospect.enrichmentStatus}</span></div>
        <div className="card-body">
          <ProspectAiInsightActions id={id} status={prospect.enrichmentStatus} canUpdate={canUpdate} initialDraft={insightDraft} />
          <div className="ai-summary"><strong>Executive summary</strong><p>{prospect.aiSummary ?? "ยังไม่มี AI enrichment — ใช้คำสั่ง Enrich เพื่อสร้างข้อมูลวิเคราะห์"}</p></div>
          <div className="ai-score-grid">
            <AiScore label="Opportunity" score={prospect.aiOpportunityScore} description="ศักยภาพในการเปลี่ยนเป็นโอกาสขาย" icon={<TrendingUp aria-hidden="true" />} />
            <AiScore label="Risk" score={prospect.aiRiskScore} description="คะแนนต่ำหมายถึงความเสี่ยงน้อย" inverse icon={<ShieldAlert aria-hidden="true" />} />
            <AiScore label="Confidence" score={prospect.aiConfidenceScore} description="ความมั่นใจจากข้อมูลที่มีอยู่" icon={<BadgeCheck aria-hidden="true" />} />
          </div>
          {prospect.enrichmentUpdatedAt && <p className="ai-provenance">AI generated · {prospect.enrichmentUpdatedAt.toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })}</p>}
        </div>
      </section>
    </div>

    <div className="detail-columns"><section className="card"><div className="card-header">Contacts</div><div className="card-body"><ProspectContactManager id={id} version={prospect.version} contacts={prospect.contacts} canUpdate={canUpdate} /></div></section>
      <section className="card"><div className="card-header">Activities & Timeline</div><div className="card-body"><ProspectActivityManager id={id} activities={activities} canUpdate={canUpdate} /><div className="prospect-timeline-list">{prospect.statusHistory.map((history) => <div className="timeline" key={history.id}><strong>Status {history.fromStatus} → {history.toStatus}</strong><p>{history.reason}</p><small>{history.transitionedAt.toLocaleString("th-TH")}</small></div>)}{!prospect.activities.length && !prospect.statusHistory.length && <div className="compact-empty">ยังไม่มีกิจกรรม</div>}</div></div></section>
    </div>

    <section className="card prospect-documents"><div className="card-header"><div><span>Documents</span><small>เอกสารทั้งหมดถูกเก็บแบบ Private และตรวจ Malware ก่อนบันทึก</small></div><span className="badge muted">{prospect.documents.length} files</span></div><div className="card-body document-layout"><ProspectDocumentList id={id} documents={documents} canUpdate={canUpdate} />{canUpdate && <ProspectDocumentUpload id={id} />}</div></section>

    <ProspectActionForms id={id} version={prospect.version} status={prospect.status} owners={owners} canAssign={permissions.has(PERMISSIONS.prospectAssign)} canConvert={canConvert} transferSummary={{ company: prospect.companyName, contact: primaryContact?.name ?? "—", score: prospect.calculatedScore, requirement: prospect.businessPainPoints, products: prospect.recommendedProducts, estimatedValue: prospect.estimatedOpportunityValue?.toString() ?? prospect.expectedBudget?.toString() ?? null }} />
  </>;
}
