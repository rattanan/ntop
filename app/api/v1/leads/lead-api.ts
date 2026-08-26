import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getSession } from "@/lib/auth";
import { loadAuthorizationContext } from "@/lib/authorization/authorization-context";
import { LeadDocumentAccessError,LeadDocumentValidationError } from "@/lib/lead/lead-document-service";
import { DocumentStorageConfigurationError,DocumentStorageOperationError,UnsafeDocumentError } from "@/lib/prospect/prospect-document-storage";
import { AiConfigurationRuntimeError } from "@/lib/ai/provider-configuration-runtime";
import { OpenAiCompatibleProviderError } from "@/lib/ai/openai-compatible-client";
import { workflowCorrelationId,workflowUnauthenticated } from "../workflow-api-response";

export async function leadActor(request:Request){const correlationId=workflowCorrelationId(request),session=await getSession();if(!session)return{response:workflowUnauthenticated(correlationId),correlationId}as const;return{actor:{...session,authorization:await loadAuthorizationContext({actorId:session.id,legacyRole:session.role})},correlationId}as const;}
export function leadIdempotencyKey(request:Request,correlationId:string){const key=request.headers.get("idempotency-key")?.trim();return key&&key.length<=191?key:NextResponse.json({error:{code:"IDEMPOTENCY_KEY_REQUIRED",message:"Idempotency-Key is required",retryable:false,correlationId}},{status:400});}
export function leadApiError(error:unknown,correlationId:string){let status=500,code="INTERNAL_ERROR",message="ไม่สามารถดำเนินการได้",data:unknown;if(error instanceof LeadDocumentValidationError||error instanceof SyntaxError){status=400;code="VALIDATION_FAILED";data=error instanceof LeadDocumentValidationError?error.issues:undefined;}else if(error instanceof LeadDocumentAccessError){status=404;code="RESOURCE_NOT_FOUND";}else if(error instanceof UnsafeDocumentError){status=422;code="DOCUMENT_UNSAFE";message=error.message;}else if(error instanceof DocumentStorageConfigurationError||error instanceof DocumentStorageOperationError){status=503;code="DOCUMENT_SERVICE_UNAVAILABLE";message=error.message;}else if(error instanceof AiConfigurationRuntimeError||error instanceof OpenAiCompatibleProviderError||error instanceof ZodError){status=503;code="AI_INSIGHT_UNAVAILABLE";message="AI Insight ไม่พร้อมใช้งาน กรุณาตรวจสอบ provider หรือลองใหม่ภายหลัง";}return NextResponse.json({error:{code,message,...(data?{data}:{}),retryable:status===503,correlationId}},{status});}
