import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth";
import { loadAuthorizationContext } from "@/lib/authorization/authorization-context";
import { createOpportunityRelatedRuntime } from "@/lib/opportunity/opportunity-related-runtime";
import { opportunityRelatedSchemas,type OpportunityRelatedCollection } from "@/lib/opportunity/opportunity-related-service";
import { requireIdempotencyKey,workflowApiError,workflowCorrelationId,workflowUnauthenticated } from "../../../workflow-api-response";

export async function POST(request:Request,{params}:{params:Promise<{id:string;collection:string}>}){
  const correlationId=workflowCorrelationId(request),session=await getSession();if(!session)return workflowUnauthenticated(correlationId);
  const key=requireIdempotencyKey(request,correlationId);if(typeof key!=="string")return key;
  try{const {id,collection}=await params;if(!(collection in opportunityRelatedSchemas))return NextResponse.json({error:{code:"RESOURCE_NOT_FOUND",message:"ไม่พบ collection",retryable:false,correlationId}},{status:404});const authorization=await loadAuthorizationContext({actorId:session.id,legacyRole:session.role});const data=await createOpportunityRelatedRuntime().add({...session,authorization},id,collection as OpportunityRelatedCollection,await request.json(),correlationId,key);return NextResponse.json({data,meta:{correlationId}},{status:201});}catch(error){return workflowApiError(error,correlationId);}
}
