import { describe, expect, it } from "vitest";

import type { AuditWriter } from "../../lib/audit/audit-writer";
import { DataRetentionAccessError, DataRetentionService, DataRetentionValidationError } from "../../lib/data-retention/data-retention-service";

const actor={id:"manager-1",authorization:{actorId:"manager-1",assignments:[{role:"TEAM_MANAGER" as const,scope:"ENTERPRISE" as const,organizationUnitId:null}]}};
const systemActor={id:"system-1",authorization:{actorId:"system-1",assignments:[{role:"SYSTEM_ADMIN" as const,scope:"ENTERPRISE" as const,organizationUnitId:null}]}};

function setup({auditReferences=0,permissions=["prospect.soft_delete","prospect.restore","prospect.permanent_delete"]}:{auditReferences?:number;permissions?:string[]}={}){
  const record={id:"prospect-1",prospectCode:"PR-1",version:1,status:"NEW",deletedAt:null as Date|null,deleteReason:null as string|null};
  const events:Array<{action:string;reason?:string}>=[];
  const tx={
    rolePermissionGrant:{findMany:async()=>permissions.map(permissionCode=>({permissionCode}))},
    prospect:{
      findFirst:async({where}:{where:{deletedAt?:unknown}})=>where.deletedAt&&record.deletedAt===null?null:{...record},
      updateMany:async({data}:{data:Record<string,unknown>})=>{if("deletedAt"in data)record.deletedAt=data.deletedAt as Date|null;if("deleteReason"in data)record.deleteReason=data.deleteReason as string|null;record.version+=1;return{count:1};},
      findUniqueOrThrow:async()=>({...record}),delete:async()=>record,
    },
    activity:{count:async()=>0},salesDocument:{count:async()=>0},lead:{count:async()=>0},prospectStatusHistory:{count:async()=>0},prospectAssignmentHistory:{count:async()=>0},prospectCommandReceipt:{count:async()=>0},prospectMergeHistory:{count:async()=>0},auditEvent:{count:async()=>auditReferences},prospectImportRow:{updateMany:async()=>({count:0})},prospectContact:{deleteMany:async()=>({count:0})},
  };
  const prisma={$transaction:async(work:(transaction:typeof tx)=>Promise<unknown>)=>work(tx)};
  const audit:AuditWriter<typeof tx>={append:async(event)=>{events.push({action:event.action,reason:event.reason});return{...event,id:`audit-${events.length}`,recordedAt:new Date()};}};
  return{record,events,service:new DataRetentionService(prisma as never,audit as never)};
}

describe("DataRetentionService",()=>{
  it("soft deletes a prospect with an approved reason and append-only audit",async()=>{const{service,record,events}=setup();const result=await service.softDeleteProspect(actor,"prospect-1",{expectedVersion:1,reason:"DUPLICATE"},"corr-1");expect(result.deleteReason).toBe("DUPLICATE");expect(record.deletedAt).toBeInstanceOf(Date);expect(events).toEqual([{action:"prospect.soft-delete",reason:"DUPLICATE"}]);});
  it("rejects free-text delete reasons outside the approved policy",async()=>{const{service}=setup();await expect(service.softDeleteProspect(actor,"prospect-1",{expectedVersion:1,reason:"SOME_REASON"},"corr-1")).rejects.toBeInstanceOf(DataRetentionValidationError);});
  it("enforces soft-delete authorization on the server",async()=>{const{service}=setup({permissions:[]});await expect(service.softDeleteProspect(actor,"prospect-1",{expectedVersion:1,reason:"DUPLICATE"},"corr-1")).rejects.toBeInstanceOf(DataRetentionAccessError);});
  it("blocks permanent deletion when an audit reference exists",async()=>{const{service,record}=setup({auditReferences:1});record.deletedAt=new Date();await expect(service.permanentlyDeleteProspect(actor,"prospect-1",{expectedVersion:1},"corr-1")).rejects.toMatchObject({references:["AUDIT_REFERENCE"]});});
  it("allows the dedicated permission to purge an isolated deleted test record",async()=>{const{service,record,events}=setup();record.deletedAt=new Date();const result=await service.permanentlyDeleteProspect(systemActor,"prospect-1",{expectedVersion:1},"corr-1");expect(result).toEqual({id:"prospect-1",permanentlyDeleted:true});expect(events.at(-1)?.action).toBe("prospect.permanent-delete");});
});
