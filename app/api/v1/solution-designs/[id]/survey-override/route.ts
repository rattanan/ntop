import { NextResponse } from "next/server";
import { overrideSurveyRequirement } from "@/lib/solution-design/solution-design-service";
import { jsonBody,presalesActor,presalesApiError } from "../../../presales-api";
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){const auth=await presalesActor(request);if("response"in auth)return auth.response;try{const body=await jsonBody(request) as {value?:unknown;reason?:unknown};if(typeof body.value!=="boolean"||typeof body.reason!=="string")throw new Error("invalid");return NextResponse.json({data:await overrideSurveyRequirement(auth.actor,(await params).id,body.value,body.reason,auth.correlationId),meta:{correlationId:auth.correlationId}});}catch(error){return presalesApiError(error,auth.correlationId);}}
