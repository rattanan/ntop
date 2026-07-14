import { LeadStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { loadAuthorizationContext } from "@/lib/authorization/authorization-context";
import { createLeadAuditWriter } from "@/lib/lead/lead-runtime";
import { buildLeadScopeWhere } from "@/lib/lead/prisma-lead-repository";
import { LEAD_ASSIGNER_ROLES } from "@/lib/lead/lead-rules";
import { LeadIdempotencyConflictError,LeadMergeDeniedError,LeadVersionConflictError } from "@/lib/lead/lead-service";
import { prisma } from "@/lib/prisma";
import { requireIdempotencyKey,workflowApiError,workflowCorrelationId,workflowUnauthenticated } from "../../../workflow-api-response";

export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
  const correlationId=workflowCorrelationId(request),session=await getSession();if(!session)return workflowUnauthenticated(correlationId);
  const key=requireIdempotencyKey(request,correlationId);if(key instanceof NextResponse)return key;
  try{
    const authorization=await loadAuthorizationContext({actorId:session.id,legacyRole:session.role});
    if(!authorization.assignments.some(item=>(LEAD_ASSIGNER_ROLES as readonly string[]).includes(item.role)))return NextResponse.json({error:{code:"FORBIDDEN",message:"ไม่มีสิทธิ์ Merge Lead",retryable:false,correlationId}},{status:403});
    const {id}=await params,body=await request.json(),targetLeadId=String(body.targetLeadId??""),reason=String(body.reason??"").trim(),expectedVersion=Number(body.expectedVersion);
    if(!targetLeadId||targetLeadId===id||reason.length<5)return NextResponse.json({error:{code:"VALIDATION_FAILED",message:"เลือก Lead ปลายทางและระบุเหตุผลอย่างน้อย 5 ตัวอักษร",retryable:false,correlationId}},{status:400});
    const result=await prisma.$transaction(async transaction=>{
      const receipt=await transaction.leadCommandReceipt.findUnique({where:{actorId_idempotencyKey_command:{actorId:session.id,idempotencyKey:key,command:"lead.merge"}},select:{leadId:true,resultLeadId:true}});
      if(receipt){if(receipt.leadId!==id||!receipt.resultLeadId)throw new LeadIdempotencyConflictError();return{sourceLeadId:id,targetLeadId:receipt.resultLeadId};}
      const rows=await transaction.lead.findMany({where:{AND:[buildLeadScopeWhere(authorization),{id:{in:[id,targetLeadId]}}]},select:{id:true,version:true,status:true,organizationUnitId:true}});const source=rows.find(item=>item.id===id),target=rows.find(item=>item.id===targetLeadId);
      if(!source||!target||source.status===LeadStatus.CONVERTED||source.status===LeadStatus.ARCHIVED||target.status===LeadStatus.ARCHIVED||source.organizationUnitId!==target.organizationUnitId)throw new LeadMergeDeniedError();
      if(source.version!==expectedVersion)throw new LeadVersionConflictError();
      await transaction.activity.updateMany({where:{leadId:id},data:{leadId:targetLeadId}});
      const updated=await transaction.lead.updateMany({where:{id,version:expectedVersion},data:{status:LeadStatus.ARCHIVED,archivedAt:new Date(),mergedIntoLeadId:targetLeadId,version:{increment:1}}});if(updated.count!==1)throw new LeadVersionConflictError();
      await transaction.leadStatusHistory.create({data:{leadId:id,fromStatus:source.status,toStatus:LeadStatus.ARCHIVED,reason,actorId:session.id,correlationId}});
      await createLeadAuditWriter().append({actorId:session.id,action:"lead.merge",targetType:"Lead",targetId:id,targetVersion:String(expectedVersion+1),outcome:"SUCCESS",correlationId,reason,data:{targetLeadId}},{transaction});
      await transaction.leadCommandReceipt.create({data:{actorId:session.id,idempotencyKey:key,command:"lead.merge",leadId:id,resultLeadId:targetLeadId,customerId:null,resultVersion:expectedVersion+1}});return{sourceLeadId:id,targetLeadId};
    });
    return NextResponse.json({data:result,meta:{correlationId}});
  }catch(error){return workflowApiError(error,correlationId);}
}
