import { CustomerForm } from "@/components/forms";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { buildAuthorizedUserWhere, loadAuthorizationContext } from "@/lib/authorization/authorization-context";
import { loadCustomerClassifications } from "@/lib/customer/customer-classification";
export default async function NewCustomerPage() { const session=await requireSession(); const authorization=await loadAuthorizationContext({actorId:session.id,legacyRole:session.role}); const [users,classifications]=await Promise.all([session.role === "ADMIN"?prisma.user.findMany({where:buildAuthorizedUserWhere(authorization),select:{id:true,name:true,email:true},orderBy:{name:"asc"}}):Promise.resolve([]),loadCustomerClassifications()]); return <><div className="page-head"><div><p className="eyebrow">บัญชี Customer</p><h1>สร้าง Customer ใหม่</h1></div></div><CustomerForm users={users} role={session.role} classifications={classifications}/></>; }
