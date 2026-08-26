import { NextResponse } from "next/server";
import { LeadInsightService } from "@/lib/lead/lead-insight-service";
import { leadActor,leadApiError,leadIdempotencyKey } from "../../lead-api";
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){const auth=await leadActor(request);if("response"in auth)return auth.response;const key=leadIdempotencyKey(request,auth.correlationId);if(key instanceof NextResponse)return key;try{const{id}=await params,data=await new LeadInsightService().generate(auth.actor,id,auth.correlationId,key);return NextResponse.json({data:{...data,aiGenerated:true,requiresConfirmation:true},meta:{correlationId:auth.correlationId}});}catch(error){return leadApiError(error,auth.correlationId);}}
