import { NextResponse } from "next/server";
import { createSiteSurveyRequest,listSiteSurveys } from "@/lib/solution-design/solution-design-service";
import { jsonBody,presalesActor,presalesApiError } from "../presales-api";
export async function GET(request:Request){const auth=await presalesActor(request);if("response"in auth)return auth.response;try{return NextResponse.json({data:await listSiteSurveys(auth.actor),meta:{correlationId:auth.correlationId}});}catch(error){return presalesApiError(error,auth.correlationId);}}
export async function POST(request:Request){const auth=await presalesActor(request);if("response"in auth)return auth.response;try{return NextResponse.json({data:await createSiteSurveyRequest(auth.actor,await jsonBody(request),auth.correlationId),meta:{correlationId:auth.correlationId}},{status:201});}catch(error){return presalesApiError(error,auth.correlationId);}}
