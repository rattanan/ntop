import { createHash } from "node:crypto";
import { z } from "zod";

import { permissionPolicy, PERMISSIONS } from "@/lib/authorization/permission-policy";
import type { AuthorizationContext } from "@/lib/authorization/authorization-context";
import { createLeadAuditWriter } from "@/lib/lead/lead-runtime";
import { buildLeadScopeWhere } from "@/lib/lead/prisma-lead-repository";
import { LEAD_CORE_UPDATE_ROLES } from "@/lib/lead/lead-rules";
import { prisma } from "@/lib/prisma";
import { createProspectDocumentStorage, type ProspectDocumentStorage, type StoredDocument } from "@/lib/prospect/prospect-document-storage";
import type { Role } from "@prisma/client";

export const MAX_LEAD_DOCUMENT_BYTES = 10_000_000;
const allowedMimeTypes = new Set(["application/pdf","application/msword","application/vnd.openxmlformats-officedocument.wordprocessingml.document","application/vnd.ms-excel","application/vnd.openxmlformats-officedocument.spreadsheetml.sheet","application/vnd.ms-powerpoint","application/vnd.openxmlformats-officedocument.presentationml.presentation","text/csv","text/plain","image/jpeg","image/png"]);
const mimeByExtension:Record<string,string>={pdf:"application/pdf",doc:"application/msword",docx:"application/vnd.openxmlformats-officedocument.wordprocessingml.document",xls:"application/vnd.ms-excel",xlsx:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",ppt:"application/vnd.ms-powerpoint",pptx:"application/vnd.openxmlformats-officedocument.presentationml.presentation",csv:"text/csv",txt:"text/plain",jpg:"image/jpeg",jpeg:"image/jpeg",png:"image/png"};
const metadata=z.strictObject({fileName:z.string().trim().min(1).max(255),mimeType:z.string().trim().min(1).max(191),category:z.string().trim().min(2).max(100)});

export type LeadDocumentActor={id:string;role:Role;authorization:AuthorizationContext};
export class LeadDocumentAccessError extends Error { constructor(){super("Lead document is unavailable.");this.name="LeadDocumentAccessError";} }
export class LeadDocumentValidationError extends Error { constructor(readonly issues:Record<string,string[]>){super("ข้อมูลเอกสารไม่ถูกต้อง");this.name="LeadDocumentValidationError";} }

function safeFileName(value:string){return value.replace(/[\\/\u0000-\u001f]/g,"_");}
function mimeType(fileName:string,value:string){if(value&&value!=="application/octet-stream")return value;return mimeByExtension[fileName.split(".").pop()?.toLowerCase()??""]??value;}
function canUpdate(actor:LeadDocumentActor){return permissionPolicy.allows(actor,PERMISSIONS.recordUpdate)&&actor.authorization.assignments.some(item=>(LEAD_CORE_UPDATE_ROLES as readonly string[]).includes(item.role));}

export class LeadDocumentService {
  constructor(private storage:ProspectDocumentStorage=createProspectDocumentStorage()){}
  async upload(actor:LeadDocumentActor,leadId:string,input:{fileName:string;mimeType:string;category:string;bytes:Uint8Array},correlationId:string,idempotencyKey:string){
    if(!canUpdate(actor))throw new LeadDocumentAccessError();
    const parsed=metadata.safeParse({fileName:input.fileName,mimeType:mimeType(input.fileName,input.mimeType),category:input.category});if(!parsed.success)throw new LeadDocumentValidationError(parsed.error.flatten().fieldErrors as Record<string,string[]>);
    if(!allowedMimeTypes.has(parsed.data.mimeType))throw new LeadDocumentValidationError({file:["รองรับ PDF, Office, CSV, TXT, JPG และ PNG เท่านั้น"]});
    if(!input.bytes.length||input.bytes.length>MAX_LEAD_DOCUMENT_BYTES)throw new LeadDocumentValidationError({file:["ไฟล์ต้องมีขนาดไม่เกิน 10 MB"]});
    const lead=await prisma.lead.findFirst({where:{id:leadId,...buildLeadScopeWhere(actor.authorization),status:{notIn:["CONVERTED","ARCHIVED"]}},select:{id:true,version:true,customerId:true}});if(!lead)throw new LeadDocumentAccessError();
    const command="lead.document.upload";const receipt=await prisma.leadCommandReceipt.findUnique({where:{actorId_idempotencyKey_command:{actorId:actor.id,idempotencyKey,command}}});
    const contentHash=createHash("sha256").update(input.bytes).digest("hex"),objectKey=`leads/${leadId}/${contentHash}/${safeFileName(parsed.data.fileName)}`,objectKeyHash=createHash("sha256").update(objectKey).digest("hex");
    if(receipt){const existing=await prisma.salesDocument.findUnique({where:{objectKeyHash}});if(existing)return existing;}
    const stored:StoredDocument={objectKey,contentHash,fileName:safeFileName(parsed.data.fileName),mimeType:parsed.data.mimeType,sizeBytes:input.bytes.length};await this.storage.put(stored,input.bytes);
    try{await this.storage.assertClean(stored);return await prisma.$transaction(async tx=>{const scoped=await tx.lead.findFirst({where:{id:leadId,...buildLeadScopeWhere(actor.authorization)},select:{id:true,version:true,customerId:true}});if(!scoped)throw new LeadDocumentAccessError();const document=await tx.salesDocument.upsert({where:{objectKeyHash},update:{},create:{leadId,objectKey,objectKeyHash,contentHash,fileName:stored.fileName,mimeType:stored.mimeType,sizeBytes:stored.sizeBytes,category:parsed.data.category,uploadedById:actor.id}});if(!receipt)await tx.leadCommandReceipt.create({data:{actorId:actor.id,idempotencyKey,command,leadId,customerId:scoped.customerId,resultVersion:scoped.version}});await createLeadAuditWriter().append({actorId:actor.id,action:"lead.document.upload",targetType:"SalesDocument",targetId:document.id,outcome:"SUCCESS",correlationId,data:{leadId,contentHash,mimeType:stored.mimeType,sizeBytes:stored.sizeBytes,category:parsed.data.category}},{transaction:tx});return document;});}catch(error){await this.storage.remove(objectKey);throw error;}
  }
  async download(actor:LeadDocumentActor,leadId:string,documentId:string,correlationId:string){const document=await prisma.salesDocument.findFirst({where:{id:documentId,leadId,deletedAt:null,lead:{is:{...buildLeadScopeWhere(actor.authorization)}}},select:{id:true,objectKey:true,fileName:true,mimeType:true,sizeBytes:true,contentHash:true}});if(!document)throw new LeadDocumentAccessError();const bytes=await this.storage.read(document.objectKey);await prisma.$transaction(async tx=>createLeadAuditWriter().append({actorId:actor.id,action:"lead.document.download",targetType:"SalesDocument",targetId:document.id,outcome:"SUCCESS",correlationId,data:{leadId,contentHash:document.contentHash,sizeBytes:document.sizeBytes}},{transaction:tx}));return{bytes,fileName:document.fileName,mimeType:document.mimeType};}
  async remove(actor:LeadDocumentActor,leadId:string,documentId:string,correlationId:string,idempotencyKey:string){if(!canUpdate(actor))throw new LeadDocumentAccessError();const command=`lead.document.delete.${documentId}`;return prisma.$transaction(async tx=>{const lead=await tx.lead.findFirst({where:{id:leadId,...buildLeadScopeWhere(actor.authorization)},select:{id:true,version:true,customerId:true}});if(!lead)throw new LeadDocumentAccessError();const receipt=await tx.leadCommandReceipt.findUnique({where:{actorId_idempotencyKey_command:{actorId:actor.id,idempotencyKey,command}}});if(receipt)return{id:documentId,deleted:true};const document=await tx.salesDocument.findFirst({where:{id:documentId,leadId,deletedAt:null},select:{contentHash:true,sizeBytes:true}});if(!document)throw new LeadDocumentAccessError();const updated=await tx.salesDocument.updateMany({where:{id:documentId,leadId,deletedAt:null},data:{deletedAt:new Date(),deletedById:actor.id}});if(updated.count!==1)throw new LeadDocumentAccessError();await createLeadAuditWriter().append({actorId:actor.id,action:"lead.document.delete",targetType:"SalesDocument",targetId:documentId,outcome:"SUCCESS",correlationId,data:{leadId,contentHash:document.contentHash,sizeBytes:document.sizeBytes}},{transaction:tx});await tx.leadCommandReceipt.create({data:{actorId:actor.id,idempotencyKey,command,leadId,customerId:lead.customerId,resultVersion:lead.version}});return{id:documentId,deleted:true};});}
}
