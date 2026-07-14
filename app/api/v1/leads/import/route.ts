import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { loadAuthorizationContext } from "@/lib/authorization/authorization-context";
import { parseLeadCsv } from "@/lib/lead/csv";
import { createLeadRuntime } from "@/lib/lead/lead-runtime";
import { LEAD_IMPORT_ROLES } from "@/lib/lead/lead-rules";
import { requireIdempotencyKey, workflowApiError, workflowCorrelationId, workflowUnauthenticated } from "../../workflow-api-response";

export async function POST(request:Request){
  const correlationId=workflowCorrelationId(request);const session=await getSession();
  if(!session)return workflowUnauthenticated(correlationId);
  if(Number(request.headers.get("content-length")??0)>2_000_000)return NextResponse.json({error:{code:"IMPORT_FILE_TOO_LARGE",message:"ไฟล์ต้องไม่เกิน 2 MB",retryable:false,correlationId}},{status:413});
  const batchKey=requireIdempotencyKey(request,correlationId);if(batchKey instanceof NextResponse)return batchKey;
  try{
    const authorization=await loadAuthorizationContext({actorId:session.id,legacyRole:session.role});
    if(!authorization.assignments.some(item=>(LEAD_IMPORT_ROLES as readonly string[]).includes(item.role)))return NextResponse.json({error:{code:"FORBIDDEN",message:"ไม่มีสิทธิ์นำเข้า Lead",retryable:false,correlationId}},{status:403});
    const body=await request.text();if(body.length>2_000_000)return NextResponse.json({error:{code:"IMPORT_FILE_TOO_LARGE",message:"ไฟล์ต้องไม่เกิน 2 MB",retryable:false,correlationId}},{status:413});
    const records=parseLeadCsv(body);if(records.length>1000)return NextResponse.json({error:{code:"IMPORT_LIMIT_EXCEEDED",message:"นำเข้าได้ไม่เกิน 1,000 แถวต่อครั้ง",retryable:false,correlationId}},{status:413});
    const created:string[]=[];const failed:Array<{row:number;message:string}>=[];
    for(const [index,row] of records.entries())try{const lead=await createLeadRuntime().create({...session,authorization},{company:row.company,contactName:row.contactName,contactEmail:row.contactEmail??"",contactPhone:row.contactPhone||undefined,source:row.source,status:"NEW",score:0,recommendedProducts:row.recommendedProducts||undefined,notes:row.requirementSummary||undefined,duplicateOverrideReason:row.duplicateOverrideReason||undefined},correlationId,`${batchKey}:${index+2}`);created.push(lead.id);}catch(error){failed.push({row:index+2,message:error instanceof Error?error.name:"IMPORT_FAILED"});}
    return NextResponse.json({data:{created:created.length,failed:failed.length,skipped:0,createdIds:created,errors:failed},meta:{correlationId}},{status:failed.length?207:201});
  }catch(error){return workflowApiError(error,correlationId);}
}
