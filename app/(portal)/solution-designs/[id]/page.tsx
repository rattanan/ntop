import Link from "next/link";
import { notFound } from "next/navigation";

import {
  AddComponentForm,
  AddRiskForm,
  AddServiceForm,
  AddSiteForm,
  CreateSurveyForm,
  MapRequirementForm,
  SolutionWorkflowForm,
} from "@/components/presales-forms";
import { requireSession } from "@/lib/auth";
import { loadAuthorizationContext } from "@/lib/authorization/authorization-context";
import { prisma } from "@/lib/prisma";
import { getSolutionDesign, PresalesAccessError } from "@/lib/solution-design/solution-design-service";

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

  const [categories, products, requirements] = await Promise.all([
    prisma.serviceCategoryConfig.findMany({ where: { active: true }, orderBy: { displayOrder: "asc" } }),
    prisma.product.findMany({
      where: { active: true },
      select: { id: true, name: true, code: true },
      orderBy: { name: "asc" },
    }),
    prisma.opportunityRequirement.findMany({
      where: { opportunityId: design.opportunityId },
      select: { id: true, requirementNumber: true, title: true },
      orderBy: { requirementNumber: "asc" },
    }),
  ]);
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
        <span className="badge">{design.statusCode}</span>
      </div>
      <section className="presales-kpis">
        <article className="card"><span>Overall readiness</span><strong>{design.overallReadiness}%</strong></article>
        <article className="card"><span>Technical feasibility</span><strong>{design.technicalFeasibility}</strong></article>
        <article className="card"><span>Survey</span><strong>{design.surveyRequired ? "Required" : "Not required"}</strong></article>
      </section>
      <SolutionWorkflowForm designId={id} status={design.statusCode} />
      <nav className="opportunity-tabs">
        <a href="#services">Services</a><a href="#sites">Sites</a><a href="#components">Components</a>
        <a href="#surveys">Surveys</a><a href="#boqs">BOQ</a><a href="#traceability">Traceability</a>
        <a href="#versions">Versions</a>
      </nav>

      <section className="card" id="services">
        <div className="card-header"><strong>Products &amp; Services</strong><span>{design.services.length}</span></div>
        <div className="card-body related-list">
          {design.services.map((service, index) => (
            <article key={service.id}>
              <strong>Service {index + 1} · {service.requestedBandwidth ?? "ไม่ระบุ bandwidth"}</strong>
              <p>{service.accessTechnology ?? "Any access technology"}</p>
              <small>{service.surveyRequired ? "Survey required" : "No survey"} · {service.boqRequired ? "BOQ required" : "No BOQ"}</small>
            </article>
          ))}
        </div>
      </section>
      <AddServiceForm designId={id} categories={categories} products={products} />

      <section className="card" id="sites">
        <div className="card-header"><strong>Installation Sites</strong><span>{design.sites.length}</span></div>
        <div className="card-body related-list">
          {design.sites.map((site) => (
            <article key={site.id}>
              <strong>{site.siteCode ? `${site.siteCode} · ` : ""}{site.siteName}</strong>
              <p>{site.addressLine1}, {site.district}, {site.province}</p>
              <small>{site.latitude.toString()}, {site.longitude.toString()}</small>
            </article>
          ))}
        </div>
      </section>
      <AddSiteForm designId={id} />

      <section className="card" id="components">
        <div className="card-header">
          <strong>Solution Components &amp; Network</strong>
          <span>{design.components.length} components · {design.networkConnections.length} links</span>
        </div>
        <div className="card-body related-list">
          {design.components.map((component) => (
            <article key={component.id}>
              <strong>{component.componentNumber} · {component.componentName}</strong>
              <p>{component.componentType} · {component.bandwidth ?? "—"}</p>
            </article>
          ))}
        </div>
      </section>
      <AddComponentForm designId={id} sites={siteOptions} />

      <section className="card" id="traceability">
        <div className="card-header"><strong>Requirement Traceability &amp; Risks</strong></div>
        <div className="card-body"><p>{design.mappings.length} mappings · {design.risks.length} assumptions/constraints/risks</p></div>
      </section>
      {requirements.length > 0 && (
        <MapRequirementForm designId={id} requirements={requirements} components={componentOptions} />
      )}
      <AddRiskForm designId={id} />
      {serviceOptions.length > 0 && siteOptions.length > 0 && (
        <CreateSurveyForm designId={id} sites={siteOptions} services={serviceOptions} />
      )}

      <section className="card" id="surveys">
        <div className="card-header"><strong>Site Surveys</strong><span>{design.surveys.length}</span></div>
        <div className="card-body related-list">
          {design.surveys.map((survey) => (
            <article key={survey.id}>
              <Link className="link" href={`/site-surveys/${survey.id}`}>{survey.surveyRequestNumber}</Link>
              <p>{survey.statusCode} · Integration Mode: {survey.integrationMode}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="card" id="boqs">
        <div className="card-header"><strong>BOQ</strong><span>{design.boqs.length}</span></div>
        <div className="card-body related-list">
          {design.boqs.map((boq) => (
            <article key={boq.id}>
              <Link className="link" href={`/boqs/${boq.id}`}>{boq.boqNumber}</Link>
              <p>{boq.statusCode} · {boq.currency} {boq.totalContractValue.toString()}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="card" id="versions">
        <div className="card-header"><strong>Version &amp; Review History</strong></div>
        <div className="card-body timeline-list">
          {design.versions.map((version) => (
            <div className="timeline" key={version.id}>
              <strong>Version {version.version}.{version.revisionNumber}</strong>
              <p>{version.statusCode}</p><small>{version.createdAt.toLocaleString("th-TH")}</small>
            </div>
          ))}
          {design.reviews.map((review) => (
            <div className="timeline" key={review.id}>
              <strong>{review.reviewType} · {review.decision}</strong>
              <p>{review.reason}</p><small>{review.createdAt.toLocaleString("th-TH")}</small>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
