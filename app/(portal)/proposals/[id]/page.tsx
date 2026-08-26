import { Pencil } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PrintProposalButton, ProposalRestoreButton, ProposalVersionCompare } from "@/components/proposal-forms";
import { ProposalRichContent } from "@/components/proposal-rich-content";
import { requireSession } from "@/lib/auth";
import { loadAuthorizationContext } from "@/lib/authorization/authorization-context";
import { PERMISSIONS, permissionPolicy } from "@/lib/authorization/permission-policy";
import { buildOpportunityScopeWhere } from "@/lib/opportunity/opportunity-query";
import { prisma } from "@/lib/prisma";
import { sanitizeProposalHtml } from "@/lib/proposal/proposal-html";

const dateTime = new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Bangkok" });
const proposalTabs = ["proposal", "compare", "history"] as const;
type ProposalTab = (typeof proposalTabs)[number];

export default async function ProposalDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const session = await requireSession();
  const context = await loadAuthorizationContext({ actorId: session.id, legacyRole: session.role });
  const id = (await params).id;
  const requestedTab = (await searchParams).tab;
  const activeTab: ProposalTab = proposalTabs.includes(requestedTab as ProposalTab) ? requestedTab as ProposalTab : "proposal";
  const versionLimit = activeTab === "proposal" ? 1 : 100;
  const [proposal, audit] = await Promise.all([
    prisma.proposal.findFirst({
      where: { id, deletedAt: null, opportunity: buildOpportunityScopeWhere(context) },
      include: {
        status: true,
        customer: { select: { id: true, name: true, segment: true } },
        opportunity: { select: { id: true, name: true, stage: true } },
        owner: { select: { name: true } },
        quotes: { select: { id: true, quoteNo: true, status: true } },
        versions: {
          orderBy: { versionNumber: "desc" },
          take: versionLimit,
          include: { createdBy: { select: { name: true } }, sections: { orderBy: { sortOrder: "asc" } } },
        },
      },
    }),
    activeTab === "history"
      ? prisma.auditEvent.findMany({ where: { targetType: "Proposal", targetId: id }, orderBy: { recordedAt: "desc" }, take: 100 })
      : Promise.resolve([]),
  ]);
  if (!proposal || !proposal.versions[0]) notFound();

  const canManage = permissionPolicy.allows(session, PERMISSIONS.proposalManage);
  const latest = proposal.versions[0];
  const versionCompare = activeTab === "compare"
    ? proposal.versions.map((version) => ({
      versionNumber: version.versionNumber,
      createdAt: version.createdAt.toISOString(),
      sections: version.sections.map((section) => ({
        sectionCode: section.sectionCode,
        title: section.title,
        contentHtml: sanitizeProposalHtml(section.content),
      })),
    }))
    : [];
  const tags = Array.isArray(latest.tags) ? latest.tags.filter((item): item is string => typeof item === "string") : [];
  const tabHref = (tab: ProposalTab) => `/proposals/${proposal.id}?tab=${tab}`;

  return <>
    <div className="page-head proposal-detail-head">
      <div>
        <p className="eyebrow">{proposal.proposalNo} · {proposal.customer.name}</p>
        <h1>{proposal.name}</h1>
        <div className="proposal-meta">
          <span className="badge">{proposal.status.label}</span>
          <span>v{proposal.version}</span>
          <span>Owner: {proposal.owner.name}</span>
          <span>Opportunity: <Link className="link" href={`/opportunities/${proposal.opportunity.id}`}>{proposal.opportunity.name}</Link></span>
        </div>
      </div>
      <div className="proposal-head-actions">
        {activeTab === "proposal" && <PrintProposalButton />}
        {canManage && <Link className="secondary" href={`/proposals/${proposal.id}/edit`}><Pencil aria-hidden="true" />แก้ไข</Link>}
        {canManage && <Link className="primary" href={`/quotes/new?proposalId=${proposal.id}`}>Create Quotation</Link>}
      </div>
    </div>

    <nav className="module-tabs proposal-detail-tabs" aria-label="Proposal detail sections">
      <Link className={activeTab === "proposal" ? "active" : ""} aria-current={activeTab === "proposal" ? "page" : undefined} href={tabHref("proposal")}>Proposal</Link>
      <Link className={activeTab === "compare" ? "active" : ""} aria-current={activeTab === "compare" ? "page" : undefined} href={tabHref("compare")}>Compare Versions</Link>
      <Link className={activeTab === "history" ? "active" : ""} aria-current={activeTab === "history" ? "page" : undefined} href={tabHref("history")}>Version &amp; Audit Timeline</Link>
    </nav>

    {activeTab === "proposal" && <div className="proposal-workspace">
      <main>
        <section className="card">
          <div className="card-header"><div><strong>Proposal Overview</strong><small>ข้อมูลจาก version {latest.versionNumber}</small></div></div>
          <div className="card-body detail-grid">
            <div><p className="detail-label">Expire Date</p><p className="detail-value">{latest.expireDate?.toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok" }) ?? "—"}</p></div>
            <div><p className="detail-label">Tags</p><p className="detail-value">{tags.join(", ") || "—"}</p></div>
            <div className="field full"><p className="detail-label">Description</p><p>{latest.description || "—"}</p></div>
          </div>
        </section>
        <div className="proposal-sections">
          {latest.sections.map((section) => <section className="card proposal-section" key={section.sectionCode}>
            <div className="card-header"><div><span className="proposal-section-index">{String(section.sortOrder + 1).padStart(2, "0")}</span><strong>{section.title}</strong></div><span className="badge muted">{section.sectionCode}</span></div>
            <div className="card-body"><ProposalRichContent content={section.content} /></div>
          </section>)}
        </div>
      </main>
      <aside>
        <section className="card">
          <div className="card-header"><strong>Quotation</strong></div>
          <div className="card-body">
            {proposal.quotes.map((quote) => <p key={quote.id}><Link className="link" href={`/quotes/${quote.id}`}>{quote.quoteNo}</Link> <span className="badge muted">{quote.status}</span></p>)}
            {!proposal.quotes.length && <p className="help">ยังไม่มี Quotation ที่เชื่อมกับ Proposal นี้</p>}
          </div>
        </section>
      </aside>
    </div>}

    {activeTab === "compare" && <div className="proposal-tab-panel"><ProposalVersionCompare versions={versionCompare} /></div>}

    {activeTab === "history" && <div className="proposal-tab-panel">
      <section className="card proposal-history">
        <div className="card-header"><strong>Version &amp; Audit Timeline</strong></div>
        <div className="card-body"><div className="timeline">
          {proposal.versions.map((version) => <article key={version.id}><span /><div><strong>Version {version.versionNumber} · {version.statusCode}</strong><p>{dateTime.format(version.createdAt)} · {version.createdBy.name}{version.aiProviderModel ? ` · AI ${version.aiProviderModel}` : ""}</p>{version.versionNumber < proposal.version && canManage && <ProposalRestoreButton key={`restore-${proposal.version}-${version.versionNumber}`} proposalId={proposal.id} expectedVersion={proposal.version} sourceVersionNumber={version.versionNumber} disabled={proposal.status.terminal} />}</div></article>)}
          {audit.map((event) => <article key={event.id}><span /><div><strong>{event.action}</strong><p>{dateTime.format(event.recordedAt)} · correlation {event.correlationId.slice(0, 8)}</p></div></article>)}
        </div></div>
      </section>
    </div>}
  </>;
}
