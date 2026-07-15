import { NextResponse } from "next/server";
import { startSiteSurvey } from "@/lib/solution-design/solution-design-service";
import { presalesActor,presalesApiError } from "../../../presales-api";
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){const auth=await presalesActor(request);if("response"in auth)return auth.response;try{return NextResponse.json({data:await startSiteSurvey(auth.actor,(await params).id,auth.correlationId),meta:{correlationId:auth.correlationId}});}catch(error){return presalesApiError(error,auth.correlationId);}}
