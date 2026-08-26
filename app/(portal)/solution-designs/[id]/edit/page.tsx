import { notFound } from "next/navigation";

import { SolutionDesignEditForm } from "@/components/solution-design-edit-form";
import { requireSession } from "@/lib/auth";
import { loadAuthorizationContext } from "@/lib/authorization/authorization-context";
import { PERMISSIONS, permissionPolicy } from "@/lib/authorization/permission-policy";
import { prisma } from "@/lib/prisma";
import { getSolutionDesign, PresalesAccessError } from "@/lib/solution-design/solution-design-service";

export default async function EditSolutionDesignPage({params}:{params:Promise<{id:string}>}){
  const{id}=await params;const session=await requireSession();const authorization=await loadAuthorizationContext({actorId:session.id,legacyRole:session.role});const roles=[...new Set(authorization.assignments.map(item=>item.role))];const configured=roles.length?await prisma.rolePermissionGrant.count({where:{roleCode:{in:roles},permissionCode:PERMISSIONS.solutionDesignManage}}):0;if(!permissionPolicy.allows(session,PERMISSIONS.solutionDesignManage)&&!configured)notFound();
  let design;try{design=await getSolutionDesign({...session,authorization},id);}catch(error){if(error instanceof PresalesAccessError)notFound();throw error;}
  if(["APPROVED","REJECTED","CANCELLED","SUPERSEDED"].includes(design.statusCode))notFound();
  const categories=await prisma.solutionReferenceOption.findMany({where:{groupCode:"SOLUTION_CATEGORY",active:true},select:{code:true,name:true},orderBy:[{displayOrder:"asc"},{name:"asc"}],take:200});
  return <><div className="page-head"><div><p className="eyebrow">{design.solutionDesignNumber}</p><h1>แก้ไข Solution Design</h1><p>แก้ไขข้อมูลหลักโดยไม่ข้าม workflow status หรือ approval gate</p></div></div><SolutionDesignEditForm design={{id:design.id,version:design.version,solutionDesignName:design.solutionDesignName,solutionCategory:design.solutionCategory,description:design.description,objective:design.objective,targetDesignDate:design.targetDesignDate?.toISOString().slice(0,10)??null}} categories={categories}/></>;
}
