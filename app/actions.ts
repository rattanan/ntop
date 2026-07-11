"use server";

import { compare } from "bcryptjs";
import { ActivityType, LeadSource, LeadStatus, OpportunityStage, Prisma, SalesApproach } from "@prisma/client";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { clearSession, createSession, isAdmin, requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ACTIVITY_TYPES, APPROACHES, FLOWS, LEAD_SOURCES, LEAD_STATUSES, SEGMENTS, STAGES } from "@/lib/constants";

export type FormState = { message?: string; errors?: Record<string, string[]> };
const text = (value: FormDataEntryValue | null) => typeof value === "string" ? value.trim() : "";

export async function login(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = z.object({ email: z.string().email("ระบุอีเมลที่ถูกต้อง"), password: z.string().min(1, "ระบุรหัสผ่าน") }).safeParse({ email: text(formData.get("email")), password: text(formData.get("password")) });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };
  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (!user || !(await compare(parsed.data.password, user.passwordHash))) return { message: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" };
  await createSession({ id: user.id, email: user.email, name: user.name, role: user.role });
  redirect("/dashboard");
}

export async function logout() { await clearSession(); redirect("/login"); }

const customerSchema = z.object({ name: z.string().min(2, "ระบุชื่อลูกค้าอย่างน้อย 2 ตัวอักษร"), taxId: z.string().regex(/^\d{13}$/, "เลขนิติบุคคลต้องมี 13 หลัก"), type: z.enum(["B2G", "B2B"]), segment: z.enum(SEGMENTS as [string, ...string[]]), province: z.string().min(1, "ระบุจังหวัด"), status: z.enum(["PROSPECT", "ACTIVE", "INACTIVE"]), address: z.string().optional(), ownerId: z.string().optional(), contactId: z.string().optional(), contactName: z.string().optional(), contactTitle: z.string().optional(), contactPhone: z.string().optional(), contactEmail: z.union([z.string().email("ระบุอีเมลผู้ติดต่อที่ถูกต้อง"), z.literal("")]).optional(), contactRelationship: z.string().optional() });
function customerValues(formData: FormData) { return { name: text(formData.get("name")), taxId: text(formData.get("taxId")), type: text(formData.get("type")), segment: text(formData.get("segment")), province: text(formData.get("province")), status: text(formData.get("status")), address: text(formData.get("address")), ownerId: text(formData.get("ownerId")) || undefined, contactId: text(formData.get("contactId")) || undefined, contactName: text(formData.get("contactName")), contactTitle: text(formData.get("contactTitle")), contactPhone: text(formData.get("contactPhone")), contactEmail: text(formData.get("contactEmail")), contactRelationship: text(formData.get("contactRelationship")) }; }
function errors(error: z.ZodError): FormState { return { errors: error.flatten().fieldErrors }; }

export async function createCustomer(_: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession(); if (session.role === "VIEWER") return { message: "บัญชีนี้ไม่มีสิทธิ์สร้างข้อมูล" };
  const parsed = customerSchema.safeParse(customerValues(formData)); if (!parsed.success) return errors(parsed.error);
  const ownerId = isAdmin(session.role) && parsed.data.ownerId ? parsed.data.ownerId : session.id;
  const { contactId, contactName, contactTitle, contactPhone, contactEmail, contactRelationship, ...customer } = parsed.data;
  void contactId;
  try { await prisma.customer.create({ data: { ...customer, ownerId, address: customer.address || null, contacts: contactName ? { create: { name: contactName, title: contactTitle || null, phone: contactPhone || null, email: contactEmail || null, relationship: contactRelationship || null } } : undefined } }); } catch (error) { if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return { errors: { taxId: ["เลขนิติบุคคลนี้มีอยู่แล้ว"] } }; throw error; }
  revalidatePath("/customers"); redirect("/customers");
}

export async function updateCustomer(id: string, _: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession(); const record = await prisma.customer.findUnique({ where: { id } });
  if (!record || (record.ownerId !== session.id && !isAdmin(session.role))) return { message: "ไม่มีสิทธิ์แก้ไขรายการนี้" };
  const parsed = customerSchema.safeParse(customerValues(formData)); if (!parsed.success) return errors(parsed.error);
  const ownerId = isAdmin(session.role) && parsed.data.ownerId ? parsed.data.ownerId : record.ownerId;
  const { contactId, contactName, contactTitle, contactPhone, contactEmail, contactRelationship, ...customer } = parsed.data;
  const contacts = contactName ? (contactId ? { update: { where: { id: contactId }, data: { name: contactName, title: contactTitle || null, phone: contactPhone || null, email: contactEmail || null, relationship: contactRelationship || null } } } : { create: { name: contactName, title: contactTitle || null, phone: contactPhone || null, email: contactEmail || null, relationship: contactRelationship || null } }) : undefined;
  try { await prisma.customer.update({ where: { id }, data: { ...customer, ownerId, address: customer.address || null, contacts } }); } catch (error) { if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return { errors: { taxId: ["เลขนิติบุคคลนี้มีอยู่แล้ว"] } }; throw error; }
  revalidatePath("/customers"); revalidatePath(`/customers/${id}`); redirect(`/customers/${id}`);
}

const opportunitySchema = z.object({ name: z.string().min(2, "ระบุชื่อโอกาสขาย"), customerId: z.string().min(1, "เลือกลูกค้า"), flow: z.enum(FLOWS as [string, ...string[]]), stage: z.enum(STAGES.map(([key]) => key) as [string, ...string[]]), estimatedValue: z.coerce.number().positive("มูลค่าต้องมากกว่า 0"), probability: z.coerce.number().int().min(0).max(100), expectedCloseAt: z.string().optional(), nextAction: z.string().optional(), requirements: z.string().optional(), incumbentVendor: z.string().optional(), competitors: z.string().optional(), approach: z.enum(APPROACHES.map(([key]) => key) as [string, ...string[]]), confidence: z.coerce.number().int().min(0).max(100), rationale: z.string().optional(), ownerId: z.string().optional() });
function opportunityValues(formData: FormData) { return { name: text(formData.get("name")), customerId: text(formData.get("customerId")), flow: text(formData.get("flow")), stage: text(formData.get("stage")), estimatedValue: text(formData.get("estimatedValue")), probability: text(formData.get("probability")), expectedCloseAt: text(formData.get("expectedCloseAt")), nextAction: text(formData.get("nextAction")), requirements: text(formData.get("requirements")), incumbentVendor: text(formData.get("incumbentVendor")), competitors: text(formData.get("competitors")), approach: text(formData.get("approach")), confidence: text(formData.get("confidence")), rationale: text(formData.get("rationale")), ownerId: text(formData.get("ownerId")) || undefined }; }
async function saveOpportunity(id: string | null, _: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession(); if (session.role === "VIEWER") return { message: "บัญชีนี้ไม่มีสิทธิ์บันทึกข้อมูล" };
  const parsed = opportunitySchema.safeParse(opportunityValues(formData)); if (!parsed.success) return errors(parsed.error);
  const current = id ? await prisma.opportunity.findUnique({ where: { id } }) : null;
  if (id && (!current || (current.ownerId !== session.id && !isAdmin(session.role)))) return { message: "ไม่มีสิทธิ์แก้ไขรายการนี้" };
  const ownerId = isAdmin(session.role) && parsed.data.ownerId ? parsed.data.ownerId : current?.ownerId ?? session.id;
  const data = { name: parsed.data.name, customerId: parsed.data.customerId, flow: parsed.data.flow, stage: parsed.data.stage as OpportunityStage, estimatedValue: parsed.data.estimatedValue, probability: parsed.data.probability, expectedCloseAt: parsed.data.expectedCloseAt ? new Date(parsed.data.expectedCloseAt) : null, nextAction: parsed.data.nextAction || null, requirements: parsed.data.requirements || null, ownerId };
  const assessment = { incumbentVendor: parsed.data.incumbentVendor || null, competitors: parsed.data.competitors || null, approach: parsed.data.approach as SalesApproach, confidence: parsed.data.confidence, rationale: parsed.data.rationale || null };
  const result = id ? await prisma.opportunity.update({ where: { id }, data: { ...data, vendorAssessment: { upsert: { create: assessment, update: assessment } } } }) : await prisma.opportunity.create({ data: { ...data, vendorAssessment: { create: assessment } } });
  revalidatePath("/opportunities"); revalidatePath(`/opportunities/${result.id}`); redirect(`/opportunities/${result.id}`);
}
export async function createOpportunity(state: FormState, formData: FormData) { return saveOpportunity(null, state, formData); }
export async function updateOpportunity(id: string, state: FormState, formData: FormData) { return saveOpportunity(id, state, formData); }

const leadSchema = z.object({ company: z.string().min(2, "ระบุชื่อบริษัท"), contactName: z.string().min(2, "ระบุชื่อผู้ติดต่อ"), contactEmail: z.union([z.string().email("ระบุอีเมลที่ถูกต้อง"), z.literal("")]), contactPhone: z.string().optional(), source: z.enum(LEAD_SOURCES.map(([key]) => key) as [string, ...string[]]), status: z.enum(LEAD_STATUSES.map(([key]) => key) as [string, ...string[]]), score: z.coerce.number().int().min(0).max(100), recommendedProducts: z.string().optional(), notes: z.string().optional(), customerId: z.string().optional() });
function leadValues(f: FormData) { return { company:text(f.get("company")),contactName:text(f.get("contactName")),contactEmail:text(f.get("contactEmail")),contactPhone:text(f.get("contactPhone")),source:text(f.get("source")),status:text(f.get("status")),score:text(f.get("score")),recommendedProducts:text(f.get("recommendedProducts")),notes:text(f.get("notes")),customerId:text(f.get("customerId")) }; }
export async function createLead(_: FormState, formData: FormData): Promise<FormState> { const session=await requireSession(); if(session.role==="VIEWER")return {message:"บัญชีนี้ไม่มีสิทธิ์สร้างข้อมูล"}; const parsed=leadSchema.safeParse(leadValues(formData)); if(!parsed.success)return errors(parsed.error); await prisma.lead.create({data:{...parsed.data,source:parsed.data.source as LeadSource,status:parsed.data.status as LeadStatus,contactEmail:parsed.data.contactEmail||null,contactPhone:parsed.data.contactPhone||null,recommendedProducts:parsed.data.recommendedProducts||null,notes:parsed.data.notes||null,customerId:parsed.data.customerId||null,ownerId:session.id}}); revalidatePath("/leads");revalidatePath("/dashboard");redirect("/leads"); }

const activitySchema = z.object({ subject:z.string().min(2,"ระบุหัวข้อกิจกรรม"),type:z.enum(ACTIVITY_TYPES.map(([key])=>key) as [string,...string[]]),dueAt:z.string().optional(),notes:z.string().optional(),customerId:z.string().optional(),opportunityId:z.string().optional() });
function summarize(notes:string) { const sentences=notes.split(/(?<=[.!?\n])\s+/).filter(Boolean); return sentences.slice(0,2).join(" ") || "รอรายละเอียดการประชุม"; }
function actionItems(notes:string) { const items=notes.split("\n").map(v=>v.trim()).filter(v=>/^(todo|action|ติดตาม|ดำเนินการ|ส่ง)/i.test(v)); return items.join("\n") || "ยังไม่มี Action Item ที่ระบุ"; }
export async function createActivity(_: FormState, formData: FormData): Promise<FormState> { const session=await requireSession(); if(session.role==="VIEWER")return {message:"บัญชีนี้ไม่มีสิทธิ์สร้างข้อมูล"}; const parsed=activitySchema.safeParse({subject:text(formData.get("subject")),type:text(formData.get("type")),dueAt:text(formData.get("dueAt")),notes:text(formData.get("notes")),customerId:text(formData.get("customerId")),opportunityId:text(formData.get("opportunityId"))}); if(!parsed.success)return errors(parsed.error); const notes=parsed.data.notes||""; await prisma.activity.create({data:{subject:parsed.data.subject,type:parsed.data.type as ActivityType,dueAt:parsed.data.dueAt?new Date(parsed.data.dueAt):null,notes:notes||null,aiSummary:parsed.data.type==="MEETING"?summarize(notes):null,actionItems:parsed.data.type==="MEETING"?actionItems(notes):null,customerId:parsed.data.customerId||null,opportunityId:parsed.data.opportunityId||null,ownerId:session.id}});revalidatePath("/activities");revalidatePath("/dashboard");redirect("/activities"); }

const productSchema=z.object({code:z.string().min(2,"ระบุรหัสสินค้า"),name:z.string().min(2,"ระบุชื่อบริการ"),category:z.string().min(2,"ระบุหมวดหมู่"),listPrice:z.coerce.number().min(0,"ราคาไม่ถูกต้อง"),description:z.string().optional()});
export async function createProduct(_:FormState,f:FormData):Promise<FormState>{const s=await requireSession();if(s.role!=="ADMIN")return {message:"เฉพาะผู้ดูแลระบบเท่านั้นที่จัดการ Product Catalog ได้"};const p=productSchema.safeParse({code:text(f.get("code")),name:text(f.get("name")),category:text(f.get("category")),listPrice:text(f.get("listPrice")),description:text(f.get("description"))});if(!p.success)return errors(p.error);try{await prisma.product.create({data:{...p.data,description:p.data.description||null}})}catch(e){if(e instanceof Prisma.PrismaClientKnownRequestError&&e.code==="P2002")return {errors:{code:["รหัสสินค้านี้มีอยู่แล้ว"]}};throw e}revalidatePath("/products");redirect("/products")}

const quoteSchema=z.object({customerId:z.string().min(1,"เลือกลูกค้า"),opportunityId:z.string().optional(),productId:z.string().min(1,"เลือกบริการ"),quantity:z.coerce.number().int().min(1),discountPct:z.coerce.number().int().min(0).max(100),validUntil:z.string().optional(),notes:z.string().optional()});
export async function createQuote(_:FormState,f:FormData):Promise<FormState>{const s=await requireSession();if(s.role==="VIEWER")return{message:"บัญชีนี้ไม่มีสิทธิ์สร้างใบเสนอราคา"};const q=quoteSchema.safeParse({customerId:text(f.get("customerId")),opportunityId:text(f.get("opportunityId")),productId:text(f.get("productId")),quantity:text(f.get("quantity")),discountPct:text(f.get("discountPct")),validUntil:text(f.get("validUntil")),notes:text(f.get("notes"))});if(!q.success)return errors(q.error);const product=await prisma.product.findUnique({where:{id:q.data.productId}});if(!product||!product.active)return{message:"ไม่พบบริการที่เลือกหรือบริการไม่พร้อมขาย"};const subtotal=Number(product.listPrice)*q.data.quantity,discountValue=subtotal*q.data.discountPct/100,total=subtotal-discountValue,quoteNo=`QT-${new Date().toISOString().slice(0,10).replaceAll("-","")}-${Math.random().toString(36).slice(2,7).toUpperCase()}`;await prisma.quote.create({data:{quoteNo,customerId:q.data.customerId,opportunityId:q.data.opportunityId||null,status:q.data.discountPct>0?"PENDING_APPROVAL":"APPROVED",discountPct:q.data.discountPct,subtotal,discountValue,total,validUntil:q.data.validUntil?new Date(q.data.validUntil):null,notes:q.data.notes||null,items:{create:{productId:product.id,quantity:q.data.quantity,unitPrice:product.listPrice}},approvals:{create:{level:1,status:q.data.discountPct>0?"PENDING":"APPROVED",comment:q.data.discountPct>0?"รออนุมัติส่วนลด":"อนุมัติอัตโนมัติ (ไม่มีส่วนลด)"}}}});revalidatePath("/quotes");redirect("/quotes")}

const coverageSchema=z.object({opportunityId:z.string().min(1,"เลือก Opportunity"),siteAddress:z.string().min(5,"ระบุที่ตั้ง"),circuitCount:z.coerce.number().int().min(1),status:z.enum(["DRAFT","REQUESTED"])});
export async function createCoverageCheck(_:FormState,f:FormData):Promise<FormState>{const s=await requireSession();if(s.role==="VIEWER")return{message:"บัญชีนี้ไม่มีสิทธิ์สร้างคำขอ"};const c=coverageSchema.safeParse({opportunityId:text(f.get("opportunityId")),siteAddress:text(f.get("siteAddress")),circuitCount:text(f.get("circuitCount")),status:text(f.get("status"))});if(!c.success)return errors(c.error);const o=await prisma.opportunity.findUnique({where:{id:c.data.opportunityId}});if(!o||(o.ownerId!==s.id&&!isAdmin(s.role)))return{message:"ไม่มีสิทธิ์ใช้ Opportunity นี้"};await prisma.coverageCheck.create({data:{...c.data,status:c.data.status as "DRAFT"|"REQUESTED"}});revalidatePath("/coverage");redirect("/coverage")}
