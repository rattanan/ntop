import { LeadSource, LeadStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";

import type { AuditWriter } from "../../lib/audit/audit-writer";
import { LeadAccessError, LeadService, LeadDuplicateResolutionRequiredError, LeadValidationError, LeadVersionConflictError, type LeadRecord, type LeadRepository } from "../../lib/lead/lead-service";

type Tx = { id: string };
const tx: Tx = { id: "tx" };
const actor = { id: "sales-1", role: "SALES" as const, authorization: { actorId: "sales-1", assignments: [{ role: "KAM" as const, scope: "SELF" as const, organizationUnitId: null }] } };
const manager = { id: "manager-1", role: "SALES" as const, authorization: { actorId: "manager-1", assignments: [{ role: "TEAM_MANAGER" as const, scope: "ENTERPRISE" as const, organizationUnitId: null }] } };
const lead: LeadRecord = { id: "lead-1", version: 1, company: "Acme", contactName: "Ada", contactEmail: "ada@acme.test", source: LeadSource.WEBSITE, status: LeadStatus.QUALIFIED, score: 80, ownerId: actor.id, customerId: null };
const leadCommand = { company: lead.company, contactName: lead.contactName, contactEmail: lead.contactEmail, source: lead.source, status: LeadStatus.NURTURING, score: lead.score };
const opportunity = { opportunityName: "Acme Network", opportunityFlow: "DIRECT", estimatedValue: "100000.0000", expectedCloseAt: new Date("2026-12-01T00:00:00Z"), probability: 40 };

class FakeLeadRepository implements LeadRepository<Tx> {
  value: LeadRecord | null = { ...lead };
  receipts = new Map<string,{leadId:string;customerId:string|null;contactId:string|null;opportunityId:string|null;resultVersion:number}>();
  transaction<T>(work:(transaction:Tx)=>Promise<T>){return work(tx);}
  async findAccessible(){return this.value?{...this.value}:null;}
  async findReceipt(actorId:string,key:string,command:string){return this.receipts.get(`${actorId}:${key}:${command}`)??null;}
  async saveReceipt(input:Parameters<LeadRepository<Tx>["saveReceipt"]>[0]){this.receipts.set(`${input.actorId}:${input.idempotencyKey}:${input.command}`,{...input,contactId:input.contactId??null,opportunityId:input.opportunityId??null});}
  async create(input:Parameters<LeadRepository<Tx>["create"]>[0]){this.value={...input,id:"lead-created",version:1,customerId:input.customerId??null};return this.value;}
  async findPotentialDuplicates(){return [];}
  async hasGrantedPermission(){return true;}
  async updateVersioned(id:string,expectedVersion:number,input:Parameters<LeadRepository<Tx>["updateVersioned"]>[2]){if(!this.value||this.value.id!==id||this.value.version!==expectedVersion)return null;this.value={...this.value,...input,customerId:input.customerId??null,version:expectedVersion+1};return this.value;}
  async markConverted(id:string,expectedVersion:number,customerId:string){if(!this.value||this.value.id!==id||this.value.version!==expectedVersion)return null;this.value={...this.value,status:LeadStatus.CONVERTED,customerId,version:expectedVersion+1};return this.value;}
  async recordStatusTransition(){return undefined;}
  async completeConversion(input:Parameters<LeadRepository<Tx>["completeConversion"]>[0]){if(!this.value||this.value.version!==input.expectedVersion)return null;this.value={...this.value,status:LeadStatus.CONVERTED,customerId:input.customerId,contactId:"contact-1",version:this.value.version+1};return{lead:this.value,contactId:"contact-1",opportunityId:"opportunity-1"};}
  async isAssignableOwner(){return true;}
  async assignVersioned(input:Parameters<LeadRepository<Tx>["assignVersioned"]>[0]){if(!this.value||this.value.version!==input.expectedVersion)return null;this.value={...this.value,ownerId:input.toOwnerId,status:this.value.status===LeadStatus.NEW?LeadStatus.ASSIGNED:this.value.status,version:this.value.version+1};return this.value;}
}

function setup(duplicates:string[]=[]){
  const leads=new FakeLeadRepository();
  const events:Array<{action:string;targetId:string}>=[];
  const audit:AuditWriter<Tx>={append:async(event)=>{events.push({action:event.action,targetId:event.targetId});return{...event,id:`audit-${events.length}`,recordedAt:new Date()};}};
  const customers={
    findAccessible:async(id:string)=>id==="customer-existing"?{id,name:"Existing",taxId:"1234567890123",type:"B2B" as const,segment:"B1",province:"Bangkok",status:"PROSPECT" as const,ownerId:actor.id,organizationUnitId:null,version:1,mergedIntoCustomerId:null,externalIds:[]}:null,
    findDeterministicDuplicates:async()=>duplicates.map(id=>({id})),
    recordDuplicateCandidate:async()=>undefined,
    create:async(input:Record<string,unknown>)=>({...input,id:"customer-new",version:1,mergedIntoCustomerId:null}),
  };
  return {leads,events,service:new LeadService(leads,customers as never,audit)};
}

describe("LeadService",()=>{
  it("enforces minimum create contact and requirement data",async()=>{const {service}=setup();await expect(service.create(actor,{company:"Acme",contactName:"Ada",contactEmail:"",source:LeadSource.WEBSITE,status:LeadStatus.NEW,score:0},"corr","create-1")).rejects.toBeInstanceOf(LeadValidationError);});
  it("updates with optimistic concurrency and audit",async()=>{const {service,leads,events}=setup();const result=await service.update(actor,"lead-1",1,leadCommand,"corr","update-1");expect(result.version).toBe(2);expect(events).toEqual([{action:"lead.update",targetId:"lead-1"}]);await expect(service.update(actor,"lead-1",1,leadCommand,"corr","update-2")).rejects.toBeInstanceOf(LeadVersionConflictError);expect(leads.value?.version).toBe(2);});

  it("allows a manager to reassign with reason and audit",async()=>{const {service,leads,events}=setup();const result=await service.assign(manager,"lead-1",1,"sales-2","สมดุลภาระงาน","corr","assign-1");expect(result.ownerId).toBe("sales-2");expect(leads.value?.version).toBe(2);expect(events).toEqual([{action:"lead.assign",targetId:"lead-1"}]);});

  it("denies direct assignment by a sales representative",async()=>{const {service}=setup();await expect(service.assign(actor,"lead-1",1,"sales-2","ขอเปลี่ยนเจ้าของ","corr","assign-1")).rejects.toBeInstanceOf(LeadAccessError);});

  it("links an accessible existing customer exactly once",async()=>{const {service,leads,events}=setup();const input={expectedVersion:1,conversionMode:"LINK" as const,existingCustomerId:"customer-existing",...opportunity};const first=await service.convert(actor,"lead-1",input,"corr","convert-1");const second=await service.convert(actor,"lead-1",input,"corr","convert-1");expect(second).toEqual(first);expect(first.opportunityId).toBe("opportunity-1");expect(leads.value?.status).toBe(LeadStatus.CONVERTED);expect(events).toEqual([{action:"lead.convert",targetId:"lead-1"}]);});

  it("requires an explicit override before creating a duplicate customer",async()=>{const {service,leads}=setup(["duplicate-1"]);await expect(service.convert(actor,"lead-1",{expectedVersion:1,conversionMode:"CREATE",taxId:"1234567890123",type:"B2B",segment:"B1",province:"Bangkok",...opportunity},"corr","convert-1")).rejects.toBeInstanceOf(LeadDuplicateResolutionRequiredError);expect(leads.value?.status).toBe(LeadStatus.QUALIFIED);});

  it("creates customer, contact, opportunity and audit in one transaction",async()=>{const {service,leads,events}=setup(["duplicate-1"]);const result=await service.convert(actor,"lead-1",{expectedVersion:1,conversionMode:"CREATE",taxId:"1234567890123",type:"B2B",segment:"B1",province:"Bangkok",duplicateOverrideReason:"ได้รับการยืนยันว่าเป็นคนละนิติบุคคล",...opportunity},"corr","convert-1");expect(result).toMatchObject({customerId:"customer-new",contactId:"contact-1",opportunityId:"opportunity-1"});expect(leads.value?.customerId).toBe("customer-new");expect(events.map(event=>event.action)).toEqual(["customer.create","lead.convert"]);});
});
