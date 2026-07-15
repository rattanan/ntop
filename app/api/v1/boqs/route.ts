import { NextResponse } from "next/server";
import { listBoqs } from "@/lib/solution-design/solution-design-service";
import { presalesActor,presalesApiError } from "../presales-api";
export async function GET(request:Request){const auth=await presalesActor(request);if("response"in auth)return auth.response;try{return NextResponse.json({data:await listBoqs(auth.actor),meta:{correlationId:auth.correlationId}});}catch(error){return presalesApiError(error,auth.correlationId);}}
