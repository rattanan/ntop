import { ProposalCreateForm } from "@/components/proposal-forms";
import { requireSession } from "@/lib/auth";
import { loadAuthorizationContext } from "@/lib/authorization/authorization-context";
import { assertPermission, PERMISSIONS } from "@/lib/authorization/permission-policy";
import { buildOpportunityScopeWhere } from "@/lib/opportunity/opportunity-query";
import { prisma } from "@/lib/prisma";

export default async function NewProposalPage({searchParams}:{searchParams:Promise<{opportunityId?:string}>}) {
  const session=await requireSession(); assertPermission(session,PERMISSIONS.proposalManage); const context=await loadAuthorizationContext({actorId:session.id,legacyRole:session.role});
  const [opportunities,templates]=await Promise.all([
    prisma.opportunity.findMany({where:{...buildOpportunityScopeWhere(context),stage:{notIn:["WON","LOST","CANCELLED"]}},select:{id:true,name:true,customer:{select:{name:true}}},orderBy:{updatedAt:"desc"},take:200}),
    prisma.proposalTemplate.findMany({where:{active:true,activeVersionId:{not:null}},select:{id:true,name:true,category:true},orderBy:[{category:"asc"},{name:"asc"}],take:100}),
  ]);
  const requested=(await searchParams).opportunityId;const initialOpportunityId=opportunities.some((item)=>item.id===requested)?requested:undefined;
  return <><div className="page-head"><div><p className="eyebrow">Proposal Management</p><h1>Create Proposal</h1><p>Customer และ Owner จะสืบทอดจาก Opportunity ตาม authorization scope</p></div></div><ProposalCreateForm initialOpportunityId={initialOpportunityId} opportunities={opportunities.map((item)=>({id:item.id,name:item.name,customerName:item.customer.name}))} templates={templates}/></>;
}
