import { LeadCreateForm } from "@/components/lead-create-form";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { loadAuthorizationContext } from "@/lib/authorization/authorization-context";
import { buildCustomerScopeWhere } from "@/lib/customer/customer-query-service";
export default async function NewLead(){const session=await requireSession();const context=await loadAuthorizationContext({actorId:session.id,legacyRole:session.role});const customers=await prisma.customer.findMany({where:{AND:[{mergedIntoCustomerId:null},buildCustomerScopeWhere(context)]},select:{id:true,name:true,taxId:true},orderBy:{name:"asc"},take:200});return <><div className="page-head"><div><p className="eyebrow">Lead Management</p><h1>สร้าง Lead ใหม่</h1></div></div><LeadCreateForm customers={customers}/></>}
