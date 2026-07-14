"use server";

import { Prisma } from "@prisma/client";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { clearSession, createSession, isAdmin, requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { FormState } from "@/app/action-types";
import { createActivity as createActivityAction } from "@/app/actions/ai-activity";
import { createGovernedQuote } from "@/app/actions/quote";
import { createOpportunity as createOpportunityAction, updateOpportunity as updateOpportunityAction } from "@/app/actions/opportunity";
import { createLead as createLeadAction } from "@/app/actions/lead";
import { createLoginRuntime } from "@/lib/identity/login-runtime";

export type { FormState } from "@/app/action-types";
const text = (value: FormDataEntryValue | null) => typeof value === "string" ? value.trim() : "";

export async function login(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = z.object({ email: z.string().email("ระบุอีเมลที่ถูกต้อง"), password: z.string().min(1, "ระบุรหัสผ่าน") }).safeParse({ email: text(formData.get("email")), password: text(formData.get("password")) });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };
  const requestHeaders = await headers();
  const user = await createLoginRuntime().authenticate(parsed.data.email, parsed.data.password, {
    ipAddress: requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ?? requestHeaders.get("x-real-ip"),
    userAgent: requestHeaders.get("user-agent"),
    correlationId: crypto.randomUUID(),
  });
  if (!user) return { message: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" };
  await createSession({ id: user.id, email: user.email, name: user.name, role: user.role });
  redirect("/dashboard");
}

export async function logout() { await clearSession(); redirect("/login"); }

function errors(error: z.ZodError): FormState { return { errors: error.flatten().fieldErrors }; }

export async function createOpportunity(state: FormState, formData: FormData) { return createOpportunityAction(state, formData); }
export async function updateOpportunity(id: string, expectedVersion: number, state: FormState, formData: FormData) { return updateOpportunityAction(id, expectedVersion, state, formData); }

export async function createLead(state: FormState, formData: FormData) { return createLeadAction(state, formData); }

export async function createActivity(state: FormState, formData: FormData): Promise<FormState> {
  return createActivityAction(state, formData);
}

const productSchema=z.object({code:z.string().min(2,"ระบุรหัสสินค้า"),name:z.string().min(2,"ระบุชื่อบริการ"),category:z.string().min(2,"ระบุหมวดหมู่"),listPrice:z.string().regex(/^\d+(\.\d{1,4})?$/,"ราคาไม่ถูกต้อง"),floorPrice:z.union([z.string().regex(/^\d+(\.\d{1,4})?$/,"Floor Price ไม่ถูกต้อง"),z.literal("")]),description:z.string().optional()});
export async function createProduct(_:FormState,f:FormData):Promise<FormState>{const s=await requireSession();if(s.role!=="ADMIN")return {message:"เฉพาะผู้ดูแลระบบเท่านั้นที่จัดการ Product Catalog ได้"};const p=productSchema.safeParse({code:text(f.get("code")),name:text(f.get("name")),category:text(f.get("category")),listPrice:text(f.get("listPrice")),floorPrice:text(f.get("floorPrice")),description:text(f.get("description"))});if(!p.success)return errors(p.error);try{await prisma.product.create({data:{code:p.data.code,name:p.data.name,category:p.data.category,listPrice:p.data.listPrice,floorPrice:p.data.floorPrice||null,description:p.data.description||null}})}catch(e){if(e instanceof Prisma.PrismaClientKnownRequestError&&e.code==="P2002")return {errors:{code:["รหัสสินค้านี้มีอยู่แล้ว"]}};throw e}revalidatePath("/products");redirect("/products")}

export async function createQuote(state: FormState, formData: FormData): Promise<FormState> {
  return createGovernedQuote(state, formData);
}

const coverageSchema=z.object({opportunityId:z.string().min(1,"เลือก Opportunity"),siteAddress:z.string().min(5,"ระบุที่ตั้ง"),circuitCount:z.coerce.number().int().min(1),status:z.enum(["DRAFT","REQUESTED"])});
export async function createCoverageCheck(_:FormState,f:FormData):Promise<FormState>{const s=await requireSession();if(s.role==="VIEWER")return{message:"บัญชีนี้ไม่มีสิทธิ์สร้างคำขอ"};const c=coverageSchema.safeParse({opportunityId:text(f.get("opportunityId")),siteAddress:text(f.get("siteAddress")),circuitCount:text(f.get("circuitCount")),status:text(f.get("status"))});if(!c.success)return errors(c.error);const o=await prisma.opportunity.findUnique({where:{id:c.data.opportunityId}});if(!o||(o.ownerId!==s.id&&!isAdmin(s.role)))return{message:"ไม่มีสิทธิ์ใช้ Opportunity นี้"};await prisma.coverageCheck.create({data:{...c.data,status:c.data.status as "DRAFT"|"REQUESTED"}});revalidatePath("/coverage");redirect("/coverage")}
