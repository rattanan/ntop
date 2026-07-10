import { CustomerForm } from "@/components/forms";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
export default async function NewCustomerPage() { const session=await requireSession(); const users=session.role === "ADMIN"?await prisma.user.findMany({select:{id:true,name:true,email:true},orderBy:{name:"asc"}}):[]; return <><div className="page-head"><div><p className="eyebrow">บัญชีลูกค้า</p><h1>สร้างลูกค้าใหม่</h1></div></div><CustomerForm users={users} role={session.role}/></>; }
