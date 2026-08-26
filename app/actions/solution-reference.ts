"use server";

import { revalidatePath } from "next/cache";

import type { FormState } from "@/app/action-types";
import { requireSession } from "@/lib/auth";
import { loadAuthorizationContext } from "@/lib/authorization/authorization-context";
import { createSolutionReferenceOption, SolutionReferenceError, updateSolutionReferenceOption } from "@/lib/solution-design/reference-option-service";

const text=(form:FormData,key:string)=>{const value=form.get(key);return typeof value==="string"?value.trim():"";};
async function actor(){const session=await requireSession();const authorization=await loadAuthorizationContext({actorId:session.id,legacyRole:session.role});return{...session,authorization};}
function input(form:FormData){return{groupCode:text(form,"groupCode"),code:text(form,"code").toUpperCase().replaceAll(/\s+/g,"_"),name:text(form,"name"),displayOrder:Number(text(form,"displayOrder")),active:form.get("active")==="on"};}
function failure(error:unknown):FormState{return error instanceof SolutionReferenceError?{message:error.message,errors:error.issues}:{message:"ไม่สามารถบันทึก Reference Data ได้"};}
export async function createSolutionReferenceAction(_:FormState,form:FormData):Promise<FormState>{try{await createSolutionReferenceOption(await actor(),input(form),crypto.randomUUID());revalidatePath("/admin/solution-reference-data");revalidatePath("/solution-designs");return{message:"เพิ่ม Reference Data เรียบร้อย",status:"success"};}catch(error){return failure(error);}}
export async function updateSolutionReferenceAction(id:string,_:FormState,form:FormData):Promise<FormState>{try{await updateSolutionReferenceOption(await actor(),id,{...input(form),expectedVersion:Number(text(form,"expectedVersion"))},crypto.randomUUID());revalidatePath("/admin/solution-reference-data");revalidatePath("/solution-designs");return{message:"แก้ไข Reference Data เรียบร้อย",status:"success"};}catch(error){return failure(error);}}
