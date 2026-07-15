import { NextResponse } from "next/server";
import { scheduleSiteSurvey } from "@/lib/solution-design/solution-design-service";
import { jsonBody,presalesActor,presalesApiError } from "../../../presales-api";
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){const auth=await presalesActor(request);if("response"in auth)return auth.response;try{const body=await jsonBody(request) as {scheduledSurveyDate?:unknown};if(typeof body.scheduledSurveyDate!=="string")throw new Error("invalid");return NextResponse.json({data:await scheduleSiteSurvey(auth.actor,(await params).id,new Date(body.scheduledSurveyDate),auth.correlationId),meta:{correlationId:auth.correlationId}});}catch(error){return presalesApiError(error,auth.correlationId);}}
