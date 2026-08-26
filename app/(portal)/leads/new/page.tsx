import { LeadCreateForm } from "@/components/lead-create-form";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { loadAuthorizationContext } from "@/lib/authorization/authorization-context";
import { buildCustomerScopeWhere } from "@/lib/customer/customer-query-service";
import { loadCustomerClassifications } from "@/lib/customer/customer-classification";
import { loadProvinceOptions } from "@/lib/customer/province-reference";
export default async function NewLead(){const session=await requireSession();const context=await loadAuthorizationContext({actorId:session.id,legacyRole:session.role});const [customers,classifications,provinces]=await Promise.all([prisma.customer.findMany({where:{AND:[{mergedIntoCustomerId:null},buildCustomerScopeWhere(context)]},select:{id:true,name:true,taxId:true},orderBy:{name:"asc"},take:200}),loadCustomerClassifications(),loadProvinceOptions()]);return <><div className="page-head"><div><p className="eyebrow">Lead Management</p><h1>สร้าง Lead ใหม่</h1></div></div><LeadCreateForm customers={customers} classifications={classifications} provinces={provinces}/></>}
