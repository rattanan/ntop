import { CustomerForm } from "@/components/forms";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { buildAuthorizedUserWhere, loadAuthorizationContext } from "@/lib/authorization/authorization-context";
export default async function NewCustomerPage() { const session=await requireSession(); const authorization=await loadAuthorizationContext({actorId:session.id,legacyRole:session.role}); const users=session.role === "ADMIN"?await prisma.user.findMany({where:buildAuthorizedUserWhere(authorization),select:{id:true,name:true,email:true},orderBy:{name:"asc"}}):[]; return <><div className="page-head"><div><p className="eyebrow">บัญชี Customer</p><h1>สร้าง Customer ใหม่</h1></div></div><CustomerForm users={users} role={session.role}/></>; }
