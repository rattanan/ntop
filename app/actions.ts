"use server";

import { compare } from "bcryptjs";
import { Prisma, type Role } from "@prisma/client";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { clearSession, createSession, isAdmin, requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { APPROACHES, FLOWS, SEGMENTS, STAGES } from "@/lib/constants";

export type FormState = { message?: string; errors?: Record<string, string[]> };
const text = (value: FormDataEntryValue | null) => typeof value === "string" ? value.trim() : "";
const nullable = (value: FormDataEntryValue | null) => text(value) || null;

export async function login(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = z.object({ email: z.string().email("ระบุอีเมลที่ถูกต้อง"), password: z.string().min(1, "ระบุรหัสผ่าน") }).safeParse({ email: text(formData.get("email")), password: text(formData.get("password")) });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };
  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (!user || !(await compare(parsed.data.password, user.passwordHash))) return { message: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" };
  await createSession({ id: user.id, email: user.email, name: user.name, role: user.role });
  redirect("/dashboard");
}

export async function logout() { await clearSession(); redirect("/login"); }

const customerSchema = z.object({ name: z.string().min(2, "ระบุชื่อลูกค้าอย่างน้อย 2 ตัวอักษร"), taxId: z.string().regex(/^\d{13}$/, "เลขนิติบุคคลต้องมี 13 หลัก"), type: z.enum(["B2G", "B2B"]), segment: z.enum(SEGMENTS as [string, ...string[]]), province: z.string().min(1, "ระบุจังหวัด"), status: z.enum(["PROSPECT", "ACTIVE", "INACTIVE"]), address: z.string().optional(), ownerId: z.string().optional() });
function customerValues(formData: FormData) { return { name: text(formData.get("name")), taxId: text(formData.get("taxId")), type: text(formData.get("type")), segment: text(formData.get("segment")), province: text(formData.get("province")), status: text(formData.get("status")), address: text(formData.get("address")), ownerId: text(formData.get("ownerId")) || undefined }; }
function errors(error: z.ZodError): FormState { return { errors: error.flatten().fieldErrors }; }

export async function createCustomer(_: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession(); if (session.role === "VIEWER") return { message: "บัญชีนี้ไม่มีสิทธิ์สร้างข้อมูล" };
  const parsed = customerSchema.safeParse(customerValues(formData)); if (!parsed.success) return errors(parsed.error);
  const ownerId = isAdmin(session.role) && parsed.data.ownerId ? parsed.data.ownerId : session.id;
  try { await prisma.customer.create({ data: { ...parsed.data, ownerId, address: parsed.data.address || null } }); } catch (error) { if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return { errors: { taxId: ["เลขนิติบุคคลนี้มีอยู่แล้ว"] } }; throw error; }
  revalidatePath("/customers"); redirect("/customers");
}

export async function updateCustomer(id: string, _: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession(); const record = await prisma.customer.findUnique({ where: { id } });
  if (!record || (record.ownerId !== session.id && !isAdmin(session.role))) return { message: "ไม่มีสิทธิ์แก้ไขรายการนี้" };
  const parsed = customerSchema.safeParse(customerValues(formData)); if (!parsed.success) return errors(parsed.error);
  const ownerId = isAdmin(session.role) && parsed.data.ownerId ? parsed.data.ownerId : record.ownerId;
  try { await prisma.customer.update({ where: { id }, data: { ...parsed.data, ownerId, address: parsed.data.address || null } }); } catch (error) { if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return { errors: { taxId: ["เลขนิติบุคคลนี้มีอยู่แล้ว"] } }; throw error; }
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
  const data = { name: parsed.data.name, customerId: parsed.data.customerId, flow: parsed.data.flow, stage: parsed.data.stage, estimatedValue: parsed.data.estimatedValue, probability: parsed.data.probability, expectedCloseAt: parsed.data.expectedCloseAt ? new Date(parsed.data.expectedCloseAt) : null, nextAction: parsed.data.nextAction || null, requirements: parsed.data.requirements || null, ownerId };
  const assessment = { incumbentVendor: parsed.data.incumbentVendor || null, competitors: parsed.data.competitors || null, approach: parsed.data.approach, confidence: parsed.data.confidence, rationale: parsed.data.rationale || null };
  const result = id ? await prisma.opportunity.update({ where: { id }, data: { ...data, vendorAssessment: { upsert: { create: assessment, update: assessment } } } }) : await prisma.opportunity.create({ data: { ...data, vendorAssessment: { create: assessment } } });
  revalidatePath("/opportunities"); revalidatePath(`/opportunities/${result.id}`); redirect(`/opportunities/${result.id}`);
}
export async function createOpportunity(state: FormState, formData: FormData) { return saveOpportunity(null, state, formData); }
export async function updateOpportunity(id: string, state: FormState, formData: FormData) { return saveOpportunity(id, state, formData); }
