import { describe,expect,it,vi } from "vitest";

import type { AuditWriter } from "../../lib/audit/audit-writer";
import { OpportunityAccessError } from "../../lib/opportunity/opportunity-service";
import { OpportunityRelatedService,type OpportunityRelatedRepository } from "../../lib/opportunity/opportunity-related-service";

type Tx={id:string};const tx={id:"tx"};
const actor={id:"sales-1",role:"SALES" as const,authorization:{actorId:"sales-1",assignments:[{role:"KAM" as const,scope:"SELF" as const,organizationUnitId:null}]}};
function setup(){
  const repository:OpportunityRelatedRepository<Tx>={transaction:vi.fn(async work=>work(tx)),findAccessibleOpportunity:vi.fn().mockResolvedValue({id:"opp-1"}),findReceipt:vi.fn().mockResolvedValue(null),createPainPoint:vi.fn().mockResolvedValue({id:"pain-1"}),createRequirement:vi.fn().mockResolvedValue({id:"req-1"}),createStakeholder:vi.fn().mockResolvedValue({id:"stake-1"}),createCompetitor:vi.fn().mockResolvedValue({id:"comp-1"}),saveReceipt:vi.fn().mockResolvedValue(undefined)};
  const audit:AuditWriter<Tx>={append:vi.fn(async event=>({...event,id:"audit",recordedAt:new Date()}))};
  return{repository,audit,service:new OpportunityRelatedService(repository,audit)};
}
const cases=[
  ["pain-points",{category:"BUSINESS",title:"High operating cost",businessProblem:"Manual operations are expensive",priority:"HIGH",status:"OPEN"},"createPainPoint"],
  ["requirements",{requirementNumber:"REQ-001",title:"Availability",description:"Service availability",requirementType:"SLA",priority:"HIGH",mandatoryFlag:true,status:"OPEN",feasibilityStatus:"NOT_ASSESSED",riskLevel:"MEDIUM"},"createRequirement"],
  ["stakeholders",{name:"Test Buyer",stakeholderRole:"DECISION_MAKER",influenceLevel:"HIGH",decisionPower:"HIGH",relationshipStrength:"MEDIUM",attitude:"NEUTRAL",supportLevel:"SUPPORTIVE",primaryContactFlag:true},"createStakeholder"],
  ["competitors",{competitorName:"Example Competitor",incumbentFlag:true,estimatedPrice:"1000000.0000",relationshipLevel:"HIGH",threatLevel:"HIGH"},"createCompetitor"],
] as const;

describe("OpportunityRelatedService",()=>{
  for(const [collection,input,method] of cases)it(`creates ${collection} with audit and receipt atomically`,async()=>{const{service,repository,audit}=setup();await expect(service.add(actor,"opp-1",collection,input,"corr",`idem-${collection}`)).resolves.toMatchObject({replayed:false});expect(repository[method]).toHaveBeenCalled();expect(audit.append).toHaveBeenCalledWith(expect.objectContaining({action:`opportunity.${collection}.create`,targetId:"opp-1"}),{transaction:tx});expect(repository.saveReceipt).toHaveBeenCalledWith(expect.objectContaining({command:`opportunity.${collection}.create`}),tx);});
  it("does not reveal or mutate an inaccessible opportunity",async()=>{const{service,repository}=setup();vi.mocked(repository.findAccessibleOpportunity).mockResolvedValue(null);await expect(service.add(actor,"opp-hidden","pain-points",cases[0][1],"corr","idem")).rejects.toBeInstanceOf(OpportunityAccessError);expect(repository.createPainPoint).not.toHaveBeenCalled();});
  it("replays an idempotent command without creating a duplicate",async()=>{const{service,repository,audit}=setup();vi.mocked(repository.findReceipt).mockResolvedValue({opportunityId:"opp-1",resultId:"req-existing"});await expect(service.add(actor,"opp-1","requirements",cases[1][1],"corr","idem")).resolves.toEqual({id:"req-existing",replayed:true});expect(repository.createRequirement).not.toHaveBeenCalled();expect(audit.append).not.toHaveBeenCalled();});
});
