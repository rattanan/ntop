import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { CustomerList } from "@/components/record-list";
export default async function CustomersPage() { const session=await requireSession(); const records=await prisma.customer.findMany({where:session.role === "ADMIN"?{}:{ownerId:session.id},include:{owner:true},orderBy:{updatedAt:"desc"}}); return <><div className="page-head"><div><p className="eyebrow">บัญชีลูกค้า</p><h1>ลูกค้าองค์กร</h1></div>{session.role !== "VIEWER"&&<Link className="primary" href="/customers/new">สร้างลูกค้า</Link>}</div><CustomerList rows={records.map(r=>({id:r.id,name:r.name,taxId:r.taxId,type:r.type,segment:r.segment,province:r.province,status:r.status,owner:r.owner.name}))}/></>; }
