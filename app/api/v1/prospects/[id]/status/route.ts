import { NextResponse } from "next/server";
import { PERMISSIONS } from "@/lib/authorization/permission-policy";
import { requireProspectPermission } from "@/lib/prospect/prospect-authorization";
import { createProspectRuntime } from "@/lib/prospect/prospect-runtime";
import { prospectActor, prospectApiError, prospectIdempotencyKey } from "../../prospect-api";
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){const auth=await prospectActor(request);if("response"in auth)return auth.response;const key=prospectIdempotencyKey(request,auth.correlationId);if(key instanceof NextResponse)return key;try{const {id}=await params,body=await request.json();if(body.status==="ARCHIVED")requireProspectPermission(auth.actor.permissions,PERMISSIONS.prospectArchive);const data=await createProspectRuntime().changeStatus(auth.actor,id,body,auth.correlationId,key);return NextResponse.json({data,meta:{correlationId:auth.correlationId}});}catch(error){return prospectApiError(error,auth.correlationId);}}
