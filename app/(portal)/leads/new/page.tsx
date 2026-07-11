import { LeadForm } from "@/components/forms";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
export default async function NewLead(){const session=await requireSession();const customers=await prisma.customer.findMany({where:session.role==="ADMIN"?{}:{ownerId:session.id},select:{id:true,name:true,taxId:true},orderBy:{name:"asc"}});return <><div className="page-head"><div><p className="eyebrow">Lead Management</p><h1>สร้าง Lead ใหม่</h1></div></div><LeadForm customers={customers}/></>}
