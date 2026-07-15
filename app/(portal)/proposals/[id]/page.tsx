import Link from "next/link";
import { notFound } from "next/navigation";

import { PrintProposalButton, ProposalAiGenerator, ProposalEditor, ProposalRestoreButton, ProposalStatusForm, ProposalVersionCompare } from "@/components/proposal-forms";
import { requireSession } from "@/lib/auth";
import { loadAuthorizationContext } from "@/lib/authorization/authorization-context";
import { PERMISSIONS, permissionPolicy } from "@/lib/authorization/permission-policy";
import { buildOpportunityScopeWhere } from "@/lib/opportunity/opportunity-query";
import { prisma } from "@/lib/prisma";

const dateTime=new Intl.DateTimeFormat("th-TH",{dateStyle:"medium",timeStyle:"short",timeZone:"Asia/Bangkok"});

export default async function ProposalDetailPage({params}:{params:Promise<{id:string}>}){
  const session=await requireSession();const context=await loadAuthorizationContext({actorId:session.id,legacyRole:session.role});const id=(await params).id;
  const [proposal,products,audit]=await Promise.all([
    prisma.proposal.findFirst({where:{id,deletedAt:null,OR:[{ownerId:session.id},{opportunity:buildOpportunityScopeWhere(context)}]},include:{status:true,customer:{select:{id:true,name:true,segment:true}},opportunity:{select:{id:true,name:true,stage:true}},owner:{select:{name:true}},quotes:{select:{id:true,quoteNo:true,status:true}},versions:{orderBy:{versionNumber:"desc"},include:{createdBy:{select:{name:true}},sections:{orderBy:{sortOrder:"asc"}}}}}}),
    prisma.product.findMany({where:{active:true},select:{id:true,code:true,name:true,category:true},orderBy:{code:"asc"},take:500}),
    prisma.auditEvent.findMany({where:{targetType:"Proposal",targetId:id},orderBy:{recordedAt:"desc"},take:100}),
  ]);
  if(!proposal||!proposal.versions[0])notFound();
  const canManage=permissionPolicy.allows(session,PERMISSIONS.proposalManage);const latest=proposal.versions[0];
  const allowed=Array.isArray(proposal.status.allowedTransitions)?proposal.status.allowedTransitions.filter((item):item is string=>typeof item==="string"):[];
  const policies=await prisma.proposalStatusTransition.findMany({where:{fromStatusCode:proposal.statusCode,toStatusCode:{in:allowed},active:true}});
  const requiredPermissions=policies.flatMap((policy)=>policy.requiredPermission?[policy.requiredPermission]:[]);const roleCodes=context.assignments.map((assignment)=>assignment.role);
  const grants=requiredPermissions.length&&roleCodes.length?await prisma.rolePermissionGrant.findMany({where:{roleCode:{in:roleCodes},permissionCode:{in:requiredPermissions}},select:{permissionCode:true}}):[];const granted=new Set(grants.map((grant)=>grant.permissionCode));
  const allowedByPolicy=policies.filter((policy)=>(!policy.makerChecker||proposal.ownerId!==session.id)&&(!policy.requiredPermission||session.role==="ADMIN"||granted.has(policy.requiredPermission))).map((policy)=>policy.toStatusCode);
  const transitions=await prisma.proposalStatusDefinition.findMany({where:{code:{in:allowedByPolicy},active:true},select:{code:true,label:true},orderBy:{sortOrder:"asc"}});
  const sectionInputs=latest.sections.map((section)=>({sectionCode:section.sectionCode,title:section.title,sortOrder:section.sortOrder,contentType:section.contentType as "RICH_TEXT"|"TABLE"|"IMAGE_REFERENCE",content:section.content,structuredData:section.structuredData&&typeof section.structuredData==="object"&&!Array.isArray(section.structuredData)?section.structuredData as Record<string,unknown>:null}));
  const versionCompare=proposal.versions.map((version)=>({versionNumber:version.versionNumber,createdAt:version.createdAt.toISOString(),sections:version.sections.map((section)=>({sectionCode:section.sectionCode,title:section.title,content:section.content}))}));
  return <><div className="page-head proposal-detail-head"><div><p className="eyebrow">{proposal.proposalNo} · {proposal.customer.name}</p><h1>{proposal.name}</h1><div className="proposal-meta"><span className="badge">{proposal.status.label}</span><span>v{proposal.version}</span><span>Owner: {proposal.owner.name}</span><span>Opportunity: <Link className="link" href={`/opportunities/${proposal.opportunity.id}`}>{proposal.opportunity.name}</Link></span></div></div><div className="proposal-head-actions"><PrintProposalButton/>{canManage&&<Link className="primary" href={`/quotes/new?proposalId=${proposal.id}`}>Create Quotation</Link>}</div></div>
    <div className="proposal-workspace"><main><ProposalEditor key={`editor-${proposal.version}`} proposalId={proposal.id} version={proposal.version} name={latest.name} description={latest.description} expireDate={latest.expireDate?.toISOString()??null} tags={Array.isArray(latest.tags)?latest.tags.filter((item):item is string=>typeof item==="string"):[]} sections={sectionInputs} terminal={proposal.status.terminal||!canManage}/><ProposalVersionCompare versions={versionCompare}/></main><aside>{canManage&&<ProposalAiGenerator key={`ai-${proposal.version}`} proposalId={proposal.id} version={proposal.version} products={products} disabled={proposal.status.terminal}/>}<ProposalStatusForm key={`status-${proposal.version}`} proposalId={proposal.id} version={proposal.version} transitions={canManage?transitions:[]}/><section className="card"><div className="card-header"><strong>Quotation</strong></div><div className="card-body">{proposal.quotes.map((quote)=><p key={quote.id}><Link className="link" href={`/quotes/${quote.id}`}>{quote.quoteNo}</Link> <span className="badge muted">{quote.status}</span></p>)}{!proposal.quotes.length&&<p className="help">ยังไม่มี Quotation ที่เชื่อมกับ Proposal นี้</p>}</div></section></aside></div>
    <section className="card proposal-history"><div className="card-header"><strong>Version &amp; Audit Timeline</strong></div><div className="card-body"><div className="timeline">{proposal.versions.map((version)=><article key={version.id}><span/><div><strong>Version {version.versionNumber} · {version.statusCode}</strong><p>{dateTime.format(version.createdAt)} · {version.createdBy.name}{version.aiProviderModel?` · AI ${version.aiProviderModel}`:""}</p>{version.versionNumber<proposal.version&&canManage&&<ProposalRestoreButton key={`restore-${proposal.version}-${version.versionNumber}`} proposalId={proposal.id} expectedVersion={proposal.version} sourceVersionNumber={version.versionNumber} disabled={proposal.status.terminal}/>}</div></article>)}{audit.map((event)=><article key={event.id}><span/><div><strong>{event.action}</strong><p>{dateTime.format(event.recordedAt)} · correlation {event.correlationId.slice(0,8)}</p></div></article>)}</div></div></section>
  </>;
}
