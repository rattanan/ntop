import { Pencil } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  AddComponentForm,
  AddRiskForm,
  AddServiceForm,
  AddSiteForm,
  CreateBoqDraftForm,
  CreateSurveyForm,
  MapRequirementForm,
  SolutionReviewForm,
} from "@/components/presales-forms";
import { SolutionDesignTabs } from "@/components/solution-design-tabs";
import { requireSession } from "@/lib/auth";
import { loadAuthorizationContext } from "@/lib/authorization/authorization-context";
import { PERMISSIONS, permissionPolicy } from "@/lib/authorization/permission-policy";
import { loadProvinceOptions } from "@/lib/customer/province-reference";
import { formatMoney } from "@/lib/number-format";
import { prisma } from "@/lib/prisma";
import { getSolutionDesign, PresalesAccessError } from "@/lib/solution-design/solution-design-service";
import { isApprovalWorkflowEnforced } from "@/lib/approval/approval-control";

export default async function SolutionDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireSession();
  const authorization = await loadAuthorizationContext({ actorId: session.id, legacyRole: session.role });
  let design;
  try {
    design = await getSolutionDesign({ ...session, authorization }, id);
  } catch (error) {
    if (error instanceof PresalesAccessError) notFound();
    throw error;
  }

  const roleCodes = [...new Set(authorization.assignments.map((assignment) => assignment.role))];
  const [categories, products, requirements, referenceOptions, provinces, configuredBoqManage, configuredSolutionManage, technicalApprovalEnabled, commercialApprovalEnabled] = await Promise.all([
    prisma.serviceCategoryConfig.findMany({
      where: { active: true, deletedAt: null },
      select: { id: true, code: true, name: true },
      orderBy: { displayOrder: "asc" },
    }),
    prisma.product.findMany({
      where: { active: true, deletedAt: null },
      select: { id: true, name: true, code: true, category: true, serviceCategoryCode: true },
      orderBy: { name: "asc" },
    }),
    prisma.opportunityRequirement.findMany({
      where: { opportunityId: design.opportunityId },
      select: { id: true, requirementNumber: true, title: true },
      orderBy: { requirementNumber: "asc" },
    }),
    prisma.solutionReferenceOption.findMany({where:{active:true,groupCode:{in:["COMPONENT_TYPE","RISK_CATEGORY","RISK_PROBABILITY","RISK_IMPACT","RISK_SEVERITY"]}},select:{groupCode:true,code:true,name:true},orderBy:[{groupCode:"asc"},{displayOrder:"asc"},{name:"asc"}],take:500}),
    loadProvinceOptions(),
    roleCodes.length ? prisma.rolePermissionGrant.count({ where: { roleCode: { in: roleCodes }, permissionCode: PERMISSIONS.boqManage } }) : Promise.resolve(0),
    roleCodes.length ? prisma.rolePermissionGrant.count({ where: { roleCode: { in: roleCodes }, permissionCode: PERMISSIONS.solutionDesignManage } }) : Promise.resolve(0),
    isApprovalWorkflowEnforced("SOLUTION_TECHNICAL_REVIEW"),
    isApprovalWorkflowEnforced("SOLUTION_COMMERCIAL_APPROVAL"),
  ]);
  const canManageBoq = permissionPolicy.allows(session, PERMISSIONS.boqManage) || configuredBoqManage > 0;
  const canManageSolution = permissionPolicy.allows(session, PERMISSIONS.solutionDesignManage) || configuredSolutionManage > 0;
  const siteOptions = design.sites.map((site) => ({ id: site.id, siteName: site.siteName }));
  const serviceOptions = design.services.map((service) => ({
    id: service.id,
    requestedBandwidth: service.requestedBandwidth,
  }));
  const componentOptions = design.components.map((component) => ({
    id: component.id,
    componentNumber: component.componentNumber,
    componentName: component.componentName,
  }));
  const referenceGroup=(groupCode:string)=>referenceOptions.filter(item=>item.groupCode===groupCode).map(({code,name})=>({code,name}));
  const riskOptions={RISK_CATEGORY:referenceGroup("RISK_CATEGORY"),RISK_PROBABILITY:referenceGroup("RISK_PROBABILITY"),RISK_IMPACT:referenceGroup("RISK_IMPACT"),RISK_SEVERITY:referenceGroup("RISK_SEVERITY")};

  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">{design.solutionDesignNumber}</p>
          <h1>{design.solutionDesignName}</h1>
          <p>
            Opportunity <Link href={`/opportunities/${design.opportunityId}`}>เปิดรายการ</Link> · Version{" "}
            {design.version}.{design.revisionNumber}
          </p>
        </div>
        <div className="actions">{canManageSolution&&<Link className="secondary" href={`/solution-designs/${id}/edit`}><Pencil aria-hidden="true" />แก้ไข</Link>}<span className="badge">{design.statusCode}</span></div>
      </div>
      <section className="presales-kpis">
        <article className="card"><span>Overall readiness</span><strong>{design.overallReadiness}%</strong></article>
        <article className="card"><span>Technical feasibility</span><strong>{design.technicalFeasibility}</strong></article>
        <article className="card"><span>Survey</span><strong>{design.surveyRequired ? "Required" : "Not required"}</strong></article>
      </section>
      {(!technicalApprovalEnabled||!commercialApprovalEnabled)&&<p className="notice">Solution Approval ถูกพักไว้ คุณยังจัดทำข้อมูล Design, Survey และ BOQ Draft ได้ตามปกติ</p>}
      <SolutionReviewForm designId={id} status={design.statusCode} technicalApprovalEnabled={technicalApprovalEnabled} commercialApprovalEnabled={commercialApprovalEnabled} />
      <SolutionDesignTabs panels={{
        services: <><section className="card"><div className="card-header"><div><strong>Products &amp; Services</strong><small>บริการที่เลือกจะกำหนดกฎ Survey และ BOQ จาก Service Category</small></div><span>{design.services.length}</span></div><div className="card-body related-list">{design.services.map((service, index) => <article key={service.id}><strong>Service {index + 1} · {service.requestedBandwidth ?? "ไม่ระบุ bandwidth"}</strong><p>{service.accessTechnology ?? "Any access technology"}</p><small>{service.surveyRequired ? "Survey required" : "No survey"} · {service.boqRequired ? "BOQ required" : "No BOQ"}</small></article>)}{!design.services.length&&<div className="compact-empty">ยังไม่มี Product หรือ Service ใน Solution นี้</div>}</div></section><AddServiceForm designId={id} categories={categories} products={products}/></>,
        sites: <><section className="card"><div className="card-header"><div><strong>Installation Sites</strong><small>สถานที่ติดตั้งและพิกัดสำหรับ Coverage / Site Survey</small></div><span>{design.sites.length}</span></div><div className="card-body related-list">{design.sites.map(site=><article key={site.id}><strong>{site.siteCode?`${site.siteCode} · `:""}{site.siteName}</strong><p>{site.addressLine1}, {site.district}, {site.province}</p><small>{site.latitude.toString()}, {site.longitude.toString()}</small></article>)}{!design.sites.length&&<div className="compact-empty">ยังไม่มี Installation Site</div>}</div></section><AddSiteForm designId={id} provinces={provinces}/></>,
        components: <><section className="card"><div className="card-header"><div><strong>Solution Components &amp; Network</strong><small>อุปกรณ์ ลิงก์ และส่วนประกอบของแบบทางเทคนิค</small></div><span>{design.components.length} components · {design.networkConnections.length} links</span></div><div className="card-body related-list">{design.components.map(component=><article key={component.id}><strong>{component.componentNumber} · {component.componentName}</strong><p>{component.componentType} · {component.bandwidth??"—"}</p></article>)}{!design.components.length&&<div className="compact-empty">ยังไม่มี Solution Component</div>}</div></section><AddComponentForm designId={id} sites={siteOptions} componentTypes={referenceGroup("COMPONENT_TYPE")}/></>,
        surveys: <>{serviceOptions.length>0&&siteOptions.length>0?<CreateSurveyForm designId={id} sites={siteOptions} services={serviceOptions}/>:<section className="card"><div className="card-body compact-empty">เพิ่ม Service และ Site ก่อนสร้าง Site Survey Request</div></section>}<section className="card"><div className="card-header"><div><strong>Site Surveys</strong><small>ติดตามคำขอสำรวจและผลยืนยันความเป็นไปได้หน้างาน</small></div><span>{design.surveys.length}</span></div><div className="card-body related-list">{design.surveys.map(survey=><article key={survey.id}><Link className="link" href={`/site-surveys/${survey.id}`}>{survey.surveyRequestNumber}</Link><p>{survey.statusCode} · Integration Mode: {survey.integrationMode}</p></article>)}{!design.surveys.length&&<div className="compact-empty">ยังไม่มี Site Survey</div>}</div></section></>,
        boqs: <>{canManageBoq&&!design.boqs.some(boq=>["DRAFT","IN_PREPARATION","REVISION_REQUIRED"].includes(boq.statusCode))&&<CreateBoqDraftForm designId={id}/>}<section className="card"><div className="card-header"><div><strong>BOQ</strong><small>รายการต้นทุน ราคาขาย และประวัติการอนุมัติ</small></div><span>{design.boqs.length}</span></div><div className="card-body related-list">{design.boqs.map(boq=><article key={boq.id}><Link className="link" href={`/boqs/${boq.id}`}>{boq.boqNumber}</Link><p>{boq.statusCode} · {formatMoney(boq.totalContractValue,boq.currency)}</p></article>)}{!design.boqs.length&&<div className="compact-empty">ยังไม่มี BOQ — ผู้มีสิทธิ์สามารถสร้าง Draft ได้จากปุ่มด้านบน</div>}</div></section></>,
        traceability: <><section className="card"><div className="card-header"><div><strong>Requirement Traceability &amp; Risks</strong><small>ตรวจว่าความต้องการลูกค้าแต่ละข้อถูกตอบด้วย Solution ส่วนใด</small></div></div><div className="card-body"><p>{design.mappings.length} mappings · {design.risks.length} assumptions/constraints/risks</p></div></section>{requirements.length>0&&<MapRequirementForm designId={id} requirements={requirements} components={componentOptions}/>}<AddRiskForm designId={id} options={riskOptions}/></>,
        versions: <section className="card"><div className="card-header"><div><strong>Version &amp; Review History</strong><small>หลักฐานการเปลี่ยนแปลงและผล Technical / Commercial Review</small></div></div><div className="card-body timeline-list">{design.versions.map(version=><div className="timeline" key={version.id}><strong>Version {version.version}.{version.revisionNumber}</strong><p>{version.statusCode}</p><small>{version.createdAt.toLocaleString("th-TH")}</small></div>)}{design.reviews.map(review=><div className="timeline" key={review.id}><strong>{review.reviewType} · {review.decision}</strong><p>{review.reason}</p><small>{review.createdAt.toLocaleString("th-TH")}</small></div>)}{!design.versions.length&&!design.reviews.length&&<div className="compact-empty">ยังไม่มีประวัติ Version หรือ Review</div>}</div></section>,
      }}/>
    </>
  );
}
