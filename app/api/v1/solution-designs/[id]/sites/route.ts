import { NextResponse } from "next/server";
import { addInstallationSite } from "@/lib/solution-design/solution-design-service";
import { jsonBody,presalesActor,presalesApiError } from "../../../presales-api";
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){const auth=await presalesActor(request);if("response"in auth)return auth.response;try{return NextResponse.json({data:await addInstallationSite(auth.actor,(await params).id,await jsonBody(request),auth.correlationId),meta:{correlationId:auth.correlationId}},{status:201});}catch(error){return presalesApiError(error,auth.correlationId);}}
