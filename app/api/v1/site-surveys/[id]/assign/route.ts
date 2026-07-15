import { NextResponse } from "next/server";
import { assignSiteSurvey } from "@/lib/solution-design/solution-design-service";
import { jsonBody,presalesActor,presalesApiError } from "../../../presales-api";
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){const auth=await presalesActor(request);if("response"in auth)return auth.response;try{return NextResponse.json({data:await assignSiteSurvey(auth.actor,(await params).id,await jsonBody(request) as never,auth.correlationId),meta:{correlationId:auth.correlationId}});}catch(error){return presalesApiError(error,auth.correlationId);}}
