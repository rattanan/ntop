import { NextResponse } from "next/server";

import { prospectApiError } from "@/app/api/v1/prospects/prospect-api";
import { getSession } from "@/lib/auth";
import { loadAuthorizationContext } from "@/lib/authorization/authorization-context";
import { createDataRetentionRuntime } from "@/lib/data-retention/data-retention-runtime";
import { correlationId } from "../../api-response";

export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
  const requestCorrelationId=correlationId(request),session=await getSession();if(!session)return NextResponse.json({error:{code:"UNAUTHENTICATED",correlationId:requestCorrelationId}},{status:401});
  try{const authorization=await loadAuthorizationContext({actorId:session.id,legacyRole:session.role});const data=await createDataRetentionRuntime().changeCustomerLifecycle({id:session.id,authorization},(await params).id,await request.json(),requestCorrelationId);return NextResponse.json({data,meta:{correlationId:requestCorrelationId}});}catch(error){return prospectApiError(error,requestCorrelationId);}
}
