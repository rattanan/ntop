import { Prisma, PrismaClient } from "@prisma/client";

import type { AuthorizationContext } from "../authorization/authorization-context";
import { buildOpportunityScopeWhere } from "./opportunity-query";
import type { OpportunityRelatedRepository } from "./opportunity-related-service";

type Transaction=Prisma.TransactionClient;
export class PrismaOpportunityRelatedRepository implements OpportunityRelatedRepository<Transaction>{
  constructor(private readonly client:PrismaClient){}
  transaction<T>(work:(transaction:Transaction)=>Promise<T>){return this.client.$transaction(work);}
  findAccessibleOpportunity(id:string,context:AuthorizationContext,transaction:Transaction){return transaction.opportunity.findFirst({where:{id,...buildOpportunityScopeWhere(context)},select:{id:true}});}
  findReceipt(actorId:string,key:string,command:string,transaction:Transaction){return transaction.opportunityRelatedCommandReceipt.findUnique({where:{actorId_idempotencyKey_command:{actorId,idempotencyKey:key,command}},select:{opportunityId:true,resultId:true}});}
  createPainPoint(opportunityId:string,ownerId:string,input:Parameters<OpportunityRelatedRepository<Transaction>["createPainPoint"]>[2],transaction:Transaction){return transaction.opportunityPainPoint.create({data:{...input,opportunityId,ownerId},select:{id:true}});}
  createRequirement(opportunityId:string,input:Parameters<OpportunityRelatedRepository<Transaction>["createRequirement"]>[1],transaction:Transaction){return transaction.opportunityRequirement.create({data:{...input,opportunityId},select:{id:true}});}
  createStakeholder(opportunityId:string,input:Parameters<OpportunityRelatedRepository<Transaction>["createStakeholder"]>[1],transaction:Transaction){return transaction.opportunityStakeholder.create({data:{...input,opportunityId},select:{id:true}});}
  createCompetitor(opportunityId:string,input:Parameters<OpportunityRelatedRepository<Transaction>["createCompetitor"]>[1],transaction:Transaction){return transaction.opportunityCompetitor.create({data:{...input,opportunityId},select:{id:true}});}
  async saveReceipt(input:Parameters<OpportunityRelatedRepository<Transaction>["saveReceipt"]>[0],transaction:Transaction){await transaction.opportunityRelatedCommandReceipt.create({data:input});}
}
