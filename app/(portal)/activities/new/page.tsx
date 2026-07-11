import { ActivityForm } from "@/components/forms";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
export default async function NewActivity(){const session=await requireSession();const where=session.role==="ADMIN"?{}:{ownerId:session.id};const [customers,opportunities]=await Promise.all([prisma.customer.findMany({where,select:{id:true,name:true,taxId:true},orderBy:{name:"asc"}}),prisma.opportunity.findMany({where,select:{id:true,name:true},orderBy:{name:"asc"}})]);return <><div className="page-head"><div><p className="eyebrow">Activity & Meeting</p><h1>บันทึกกิจกรรม</h1></div></div><ActivityForm customers={customers} opportunities={opportunities}/></>}
