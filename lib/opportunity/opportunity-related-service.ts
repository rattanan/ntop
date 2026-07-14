import type { Role } from "@prisma/client";
import { z } from "zod";

import type { AuditWriter } from "../audit/audit-writer";
import type { AuthorizationContext } from "../authorization/authorization-context";
import { assertPermission, PERMISSIONS, type PermissionPolicy, permissionPolicy } from "../authorization/permission-policy";
import { OpportunityAccessError, OpportunityIdempotencyConflictError, OpportunityValidationError } from "./opportunity-service";

const optionalText = (max = 10_000) => z.string().trim().max(max).nullable().optional();
const painPointSchema = z.strictObject({ category:z.string().trim().min(1).max(100),title:z.string().trim().min(2).max(255),currentSituation:optionalText(),businessProblem:z.string().trim().min(2).max(10_000),impact:optionalText(),expectedOutcome:optionalText(),priority:z.string().trim().min(1).max(32).default("MEDIUM"),status:z.string().trim().min(1).max(32).default("OPEN"),source:z.string().trim().max(100).nullable().optional() });
const requirementSchema = z.strictObject({ requirementNumber:z.string().trim().min(1).max(64),title:z.string().trim().min(2).max(255),description:z.string().trim().min(2).max(10_000),requirementType:z.string().trim().min(1).max(100),priority:z.string().trim().min(1).max(32).default("MEDIUM"),mandatoryFlag:z.boolean().default(false),acceptanceCriteria:optionalText(),sourceDocument:z.string().trim().max(500).nullable().optional(),status:z.string().trim().min(1).max(32).default("OPEN"),assignedTeam:z.string().trim().max(100).nullable().optional(),feasibilityStatus:z.string().trim().min(1).max(32).default("NOT_ASSESSED"),solutionResponse:optionalText(),riskLevel:z.string().trim().min(1).max(32).default("MEDIUM") });
const stakeholderSchema = z.strictObject({ contactId:z.string().trim().max(191).nullable().optional(),name:z.string().trim().min(2).max(255),organization:z.string().trim().max(255).nullable().optional(),department:z.string().trim().max(191).nullable().optional(),jobTitle:z.string().trim().max(191).nullable().optional(),email:z.string().trim().email().max(255).nullable().optional(),phone:z.string().trim().max(100).nullable().optional(),stakeholderRole:z.string().trim().min(1).max(100),influenceLevel:z.string().trim().min(1).max(32).default("MEDIUM"),decisionPower:z.string().trim().min(1).max(32).default("MEDIUM"),relationshipStrength:z.string().trim().min(1).max(32).default("MEDIUM"),attitude:z.string().trim().min(1).max(32).default("NEUTRAL"),supportLevel:z.string().trim().min(1).max(32).default("NEUTRAL"),preferredCommunication:z.string().trim().max(100).nullable().optional(),notes:optionalText(),primaryContactFlag:z.boolean().default(false) });
const competitorSchema = z.strictObject({ competitorName:z.string().trim().min(2).max(255),incumbentFlag:z.boolean().default(false),estimatedPrice:z.string().regex(/^\d+(\.\d{1,4})?$/).nullable().optional(),strengths:optionalText(),weaknesses:optionalText(),relationshipLevel:z.string().trim().min(1).max(32).default("UNKNOWN"),threatLevel:z.string().trim().min(1).max(32).default("MEDIUM"),likelySolution:optionalText(),winStrategy:optionalText(),differentiation:optionalText(),notes:optionalText() });

export const opportunityRelatedSchemas = { "pain-points":painPointSchema,requirements:requirementSchema,stakeholders:stakeholderSchema,competitors:competitorSchema } as const;
export type OpportunityRelatedCollection = keyof typeof opportunityRelatedSchemas;
type RelatedInputs = { [K in OpportunityRelatedCollection]: z.infer<(typeof opportunityRelatedSchemas)[K]> };

export interface OpportunityRelatedRepository<TTransaction> {
  transaction<T>(work:(transaction:TTransaction)=>Promise<T>):Promise<T>;
  findAccessibleOpportunity(id:string,context:AuthorizationContext,transaction:TTransaction):Promise<{id:string}|null>;
  findReceipt(actorId:string,key:string,command:string,transaction:TTransaction):Promise<{opportunityId:string;resultId:string}|null>;
  createPainPoint(opportunityId:string,ownerId:string,input:RelatedInputs["pain-points"],transaction:TTransaction):Promise<{id:string}>;
  createRequirement(opportunityId:string,input:RelatedInputs["requirements"],transaction:TTransaction):Promise<{id:string}>;
  createStakeholder(opportunityId:string,input:RelatedInputs["stakeholders"],transaction:TTransaction):Promise<{id:string}>;
  createCompetitor(opportunityId:string,input:RelatedInputs["competitors"],transaction:TTransaction):Promise<{id:string}>;
  saveReceipt(input:{actorId:string;idempotencyKey:string;command:string;opportunityId:string;resultId:string},transaction:TTransaction):Promise<void>;
}

type Actor={id:string;role:Role;authorization:AuthorizationContext};

export class OpportunityRelatedService<TTransaction> {
  constructor(private readonly repository:OpportunityRelatedRepository<TTransaction>,private readonly audit:AuditWriter<TTransaction>,private readonly permissions:PermissionPolicy=permissionPolicy){}
  async add<K extends OpportunityRelatedCollection>(actor:Actor,opportunityId:string,collection:K,input:unknown,correlationId:string,idempotencyKey:string){
    assertPermission(actor,PERMISSIONS.recordUpdate,this.permissions);
    if(!idempotencyKey.trim()||idempotencyKey.length>191)throw new OpportunityValidationError({idempotencyKey:["Required"]});
    const parsed=opportunityRelatedSchemas[collection].safeParse(input);
    if(!parsed.success)throw new OpportunityValidationError(parsed.error.flatten().fieldErrors);
    const command=`opportunity.${collection}.create`;
    return this.repository.transaction(async transaction=>{
      const receipt=await this.repository.findReceipt(actor.id,idempotencyKey,command,transaction);
      if(receipt){if(receipt.opportunityId!==opportunityId)throw new OpportunityIdempotencyConflictError();return{id:receipt.resultId,replayed:true};}
      if(!await this.repository.findAccessibleOpportunity(opportunityId,actor.authorization,transaction))throw new OpportunityAccessError();
      let created:{id:string};
      if(collection==="pain-points")created=await this.repository.createPainPoint(opportunityId,actor.id,parsed.data as RelatedInputs["pain-points"],transaction);
      else if(collection==="requirements")created=await this.repository.createRequirement(opportunityId,parsed.data as RelatedInputs["requirements"],transaction);
      else if(collection==="stakeholders")created=await this.repository.createStakeholder(opportunityId,parsed.data as RelatedInputs["stakeholders"],transaction);
      else created=await this.repository.createCompetitor(opportunityId,parsed.data as RelatedInputs["competitors"],transaction);
      await this.audit.append({actorId:actor.id,action:command,targetType:"Opportunity",targetId:opportunityId,outcome:"SUCCESS",correlationId,data:{relatedId:created.id,collection}},{transaction});
      await this.repository.saveReceipt({actorId:actor.id,idempotencyKey,command,opportunityId,resultId:created.id},transaction);
      return{...created,replayed:false};
    });
  }
}
