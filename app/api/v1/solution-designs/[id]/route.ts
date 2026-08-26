import { NextResponse } from "next/server";
import { getSolutionDesign, updateSolutionDesign } from "@/lib/solution-design/solution-design-service";
import { jsonBody,presalesActor,presalesApiError } from "../../presales-api";
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){const auth=await presalesActor(request);if("response"in auth)return auth.response;try{return NextResponse.json({data:await getSolutionDesign(auth.actor,(await params).id),meta:{correlationId:auth.correlationId}});}catch(error){return presalesApiError(error,auth.correlationId);}}
export async function PATCH(request:Request,{params}:{params:Promise<{id:string}>}){const auth=await presalesActor(request);if("response"in auth)return auth.response;try{return NextResponse.json({data:await updateSolutionDesign(auth.actor,(await params).id,await jsonBody(request),auth.correlationId),meta:{correlationId:auth.correlationId}});}catch(error){return presalesApiError(error,auth.correlationId);}}
