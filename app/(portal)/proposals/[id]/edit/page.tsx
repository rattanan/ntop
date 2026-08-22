import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ProposalAiGenerator, ProposalEditor } from "@/components/proposal-forms";
import { requireSession } from "@/lib/auth";
import { loadAuthorizationContext } from "@/lib/authorization/authorization-context";
import { PERMISSIONS, permissionPolicy } from "@/lib/authorization/permission-policy";
import { buildOpportunityScopeWhere } from "@/lib/opportunity/opportunity-query";
import { prisma } from "@/lib/prisma";

export default async function EditProposalPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  if (!permissionPolicy.allows(session, PERMISSIONS.proposalManage)) notFound();
  const context = await loadAuthorizationContext({ actorId: session.id, legacyRole: session.role });
  const { id } = await params;
  const [proposal, products] = await Promise.all([
    prisma.proposal.findFirst({
      where: { id, deletedAt: null, opportunity: buildOpportunityScopeWhere(context) },
      include: {
        status: true,
        customer: { select: { name: true } },
        versions: { orderBy: { versionNumber: "desc" }, take: 1, include: { sections: { orderBy: { sortOrder: "asc" } } } },
      },
    }),
    prisma.product.findMany({
      where: { active: true },
      select: { id: true, code: true, name: true, category: true },
      orderBy: { code: "asc" },
      take: 500,
    }),
  ]);
  if (!proposal || proposal.status.terminal || !proposal.versions[0]) notFound();

  const latest = proposal.versions[0];
  const sections = latest.sections.map((section) => ({
    sectionCode: section.sectionCode,
    title: section.title,
    sortOrder: section.sortOrder,
    contentType: section.contentType as "RICH_TEXT" | "TABLE" | "IMAGE_REFERENCE",
    content: section.content,
    structuredData: section.structuredData && typeof section.structuredData === "object" && !Array.isArray(section.structuredData)
      ? section.structuredData as Record<string, unknown>
      : null,
  }));
  const tags = Array.isArray(latest.tags)
    ? latest.tags.filter((item): item is string => typeof item === "string")
    : [];

  return <>
    <div className="page-head"><div>
      <Link className="back-link" href={`/proposals/${id}`}><ArrowLeft aria-hidden="true"/>กลับหน้ารายละเอียด</Link>
      <p className="eyebrow">{proposal.proposalNo} · {proposal.customer.name}</p>
      <h1>แก้ไข {proposal.name}</h1>
    </div></div>
    <div className="proposal-workspace">
      <main><ProposalEditor key={`editor-${proposal.version}`} proposalId={proposal.id} version={proposal.version} name={latest.name} description={latest.description} expireDate={latest.expireDate?.toISOString()??null} tags={tags} sections={sections} terminal={false}/></main>
      <aside><ProposalAiGenerator key={`ai-${proposal.version}`} proposalId={proposal.id} version={proposal.version} products={products} disabled={false}/></aside>
    </div>
  </>;
}
