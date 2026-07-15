import { NextResponse } from "next/server";
import { reviewSurveyResult } from "@/lib/solution-design/solution-design-service";
import { jsonBody,presalesActor,presalesApiError } from "../../../../presales-api";
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){const auth=await presalesActor(request);if("response"in auth)return auth.response;try{const body=await jsonBody(request) as {decision:"APPROVE"|"RETURN"|"REJECT";reason:string};return NextResponse.json({data:await reviewSurveyResult(auth.actor,(await params).id,body.decision,body.reason,auth.correlationId),meta:{correlationId:auth.correlationId}});}catch(error){return presalesApiError(error,auth.correlationId);}}
