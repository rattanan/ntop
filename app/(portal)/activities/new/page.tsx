import { ActivityForm } from "@/components/forms";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { loadAuthorizationContext } from "@/lib/authorization/authorization-context";
import { buildCustomerScopeWhere } from "@/lib/customer/customer-query-service";
import { buildOpportunityScopeWhere } from "@/lib/opportunity/opportunity-query";
export default async function NewActivity(){const session=await requireSession();const authorization=await loadAuthorizationContext({actorId:session.id,legacyRole:session.role});const [customers,opportunities]=await Promise.all([prisma.customer.findMany({where:buildCustomerScopeWhere(authorization),select:{id:true,name:true,taxId:true},orderBy:{name:"asc"}}),prisma.opportunity.findMany({where:buildOpportunityScopeWhere(authorization),select:{id:true,name:true},orderBy:{name:"asc"}})]);return <><div className="page-head"><div><p className="eyebrow">Activity & Meeting</p><h1>บันทึกกิจกรรม</h1></div></div><ActivityForm customers={customers} opportunities={opportunities}/></>}
