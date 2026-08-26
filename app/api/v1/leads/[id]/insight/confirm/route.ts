import { NextResponse } from "next/server";
import { LeadInsightService } from "@/lib/lead/lead-insight-service";
import { leadActor,leadApiError } from "../../../lead-api";
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){const auth=await leadActor(request);if("response"in auth)return auth.response;try{const{id}=await params,data=await new LeadInsightService().confirm(auth.actor,id,auth.correlationId);return NextResponse.json({data,meta:{correlationId:auth.correlationId}});}catch(error){return leadApiError(error,auth.correlationId);}}
