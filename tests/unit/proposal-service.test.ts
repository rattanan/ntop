import { describe, expect, it, vi } from "vitest";

import type { AuditWriter } from "../../lib/audit/audit-writer";
import { defaultProposalSections } from "../../lib/proposal/contracts";
import { ProposalService, ProposalTransitionError, ProposalVersionConflictError, type ProposalRecord, type ProposalRepository } from "../../lib/proposal/proposal-service";

type Tx={id:string};const tx={id:"tx"};
const authorization={actorId:"sales",assignments:[{role:"KAM" as const,scope:"SELF" as const,organizationUnitId:null}]};
const actor={id:"sales",role:"SALES" as const,authorization};
const base:ProposalRecord={id:"proposal",proposalNo:"PR-2026-000001",opportunityId:"opp",customerId:"customer",ownerId:"sales",version:1,statusCode:"DRAFT",terminal:false,name:"Enterprise Proposal",description:null,expireDate:null,tags:[],templateVersionId:null,latestVersionId:"pv1",sections:defaultProposalSections()};

function setup(){
  const repository:ProposalRepository<Tx>={
    transaction:vi.fn(async(work)=>work(tx)),findReceipt:vi.fn().mockResolvedValue(null),saveReceipt:vi.fn().mockResolvedValue(undefined),
    findOpportunity:vi.fn().mockResolvedValue({id:"opp",customerId:"customer"}),findInitialStatus:vi.fn().mockResolvedValue({code:"DRAFT",terminal:false,allowedTransitions:["PENDING_REVIEW"]}),findStatus:vi.fn(async(code)=>code==="DRAFT"?{code,terminal:false,allowedTransitions:["PENDING_REVIEW"]}:{code,terminal:false,allowedTransitions:[]}),
    findTransition:vi.fn(async(from,to)=>from==="DRAFT"&&to==="PENDING_REVIEW"?{requiredPermission:null,makerChecker:false}:null),actorHasPermission:vi.fn().mockResolvedValue(false),
    findTemplate:vi.fn().mockResolvedValue(null),nextProposalNumber:vi.fn().mockResolvedValue("PR-2026-000001"),create:vi.fn().mockResolvedValue(base),find:vi.fn().mockResolvedValue(base),findVersion:vi.fn().mockResolvedValue(base),
    createVersion:vi.fn(async(input)=>({...base,version:input.expectedVersion+1,statusCode:input.statusCode,name:input.name,latestVersionId:`pv${input.expectedVersion+1}`,sections:input.sections})),softDelete:vi.fn().mockResolvedValue(undefined),
  };
  const audit:AuditWriter<Tx>={append:vi.fn(async(event)=>({...event,id:"audit",recordedAt:new Date()}))};
  return{repository,audit,service:new ProposalService(repository,audit)};
}

describe("ProposalService",()=>{
  it("creates from an authorized Opportunity and writes audit plus receipt in one transaction",async()=>{const{service,repository,audit}=setup();const result=await service.create(actor,{opportunityId:"opp",name:"Enterprise Proposal",tags:[]},"corr","idem");expect(result.proposalNo).toBe("PR-2026-000001");expect(repository.transaction).toHaveBeenCalledOnce();expect(audit.append).toHaveBeenCalledWith(expect.objectContaining({action:"proposal.create",targetVersion:"1"}),{transaction:tx});expect(repository.saveReceipt).toHaveBeenCalled();});
  it("rejects stale edits before creating a version",async()=>{const{service,repository}=setup();await expect(service.edit(actor,"proposal",{expectedVersion:2,name:"Changed",tags:[],sections:defaultProposalSections()},"corr","edit")).rejects.toBeInstanceOf(ProposalVersionConflictError);expect(repository.createVersion).not.toHaveBeenCalled();});
  it("uses configured transitions and appends a version instead of overwriting history",async()=>{const{service,repository}=setup();const result=await service.transition(actor,"proposal",{expectedVersion:1,toStatusCode:"PENDING_REVIEW",comment:"Ready"},"corr","transition");expect(result.version).toBe(2);expect(repository.createVersion).toHaveBeenCalledWith(expect.objectContaining({statusCode:"PENDING_REVIEW",expectedVersion:1}),tx);});
  it("denies a transition absent from status configuration",async()=>{const{service,repository}=setup();await expect(service.transition(actor,"proposal",{expectedVersion:1,toStatusCode:"ACCEPTED",comment:"skip"},"corr","invalid")).rejects.toBeInstanceOf(ProposalTransitionError);expect(repository.createVersion).not.toHaveBeenCalled();});
  it("enforces configured Manager review permission and maker-checker",async()=>{const{service,repository}=setup();const pending={...base,statusCode:"PENDING_REVIEW"};vi.mocked(repository.find).mockResolvedValue(pending);vi.mocked(repository.findStatus).mockImplementation(async(code)=>code==="PENDING_REVIEW"?{code,terminal:false,allowedTransitions:["PENDING_DIRECTOR"]}:{code,terminal:false,allowedTransitions:["APPROVED"]});vi.mocked(repository.findTransition).mockResolvedValue({requiredPermission:"proposal.review.manager",makerChecker:true});vi.mocked(repository.actorHasPermission).mockResolvedValue(true);await expect(service.transition(actor,"proposal",{expectedVersion:1,toStatusCode:"PENDING_DIRECTOR",comment:"Reviewed"},"corr","owner-review")).rejects.toBeInstanceOf(ProposalTransitionError);const manager={id:"manager",role:"SALES" as const,authorization:{actorId:"manager",assignments:[{role:"TEAM_MANAGER" as const,scope:"TEAM" as const,organizationUnitId:"unit"}]}};await expect(service.transition(manager,"proposal",{expectedVersion:1,toStatusCode:"PENDING_DIRECTOR",comment:"Reviewed"},"corr","manager-review")).resolves.toMatchObject({version:2,statusCode:"PENDING_DIRECTOR"});expect(repository.actorHasPermission).toHaveBeenCalledWith(manager,"proposal.review.manager",tx);});
});
