import { NextResponse } from "next/server";
import { getSiteSurvey } from "@/lib/solution-design/solution-design-service";
import { presalesActor,presalesApiError } from "../../presales-api";
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){const auth=await presalesActor(request);if("response"in auth)return auth.response;try{return NextResponse.json({data:await getSiteSurvey(auth.actor,(await params).id),meta:{correlationId:auth.correlationId}});}catch(error){return presalesApiError(error,auth.correlationId);}}
