import Link from "next/link";
import { notFound } from "next/navigation";

import { DeletedProspectActions } from "@/components/data-retention-actions";
import { requireSession } from "@/lib/auth";
import { loadAuthorizationContext } from "@/lib/authorization/authorization-context";
import { PERMISSIONS } from "@/lib/authorization/permission-policy";
import { loadProspectPermissions } from "@/lib/prospect/prospect-authorization";
import { prisma } from "@/lib/prisma";

export default async function DeletedRecordsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const session=await requireSession();const context=await loadAuthorizationContext({actorId:session.id,legacyRole:session.role});const permissions=await loadProspectPermissions(context);
  if(!permissions.has(PERMISSIONS.prospectViewDeleted)&&!permissions.has(PERMISSIONS.prospectRestore))notFound();
  const query=(await searchParams).q?.trim();
  const rows=await prisma.prospect.findMany({where:{deletedAt:{not:null},...(query?{OR:[{prospectCode:{contains:query}},{companyName:{contains:query}},{taxId:{contains:query}}]}:{})},select:{id:true,prospectCode:true,companyName:true,status:true,version:true,deleteReason:true,deletedAt:true,deletedById:true},orderBy:{deletedAt:"desc"},take:200});
  const actorIds=[...new Set(rows.flatMap(row=>row.deletedById?[row.deletedById]:[]))];const actors=actorIds.length?await prisma.user.findMany({where:{id:{in:actorIds}},select:{id:true,name:true}}):[];const actorMap=new Map(actors.map(actor=>[actor.id,actor.name]));
  return <><div className="page-head"><div><p className="eyebrow">Data Governance</p><h1>Deleted Records</h1><p>Prospect ที่ถูก Soft Delete ยังคงอยู่เพื่อ Audit และสามารถกู้คืนได้</p></div><Link className="secondary" href="/admin/audit">Audit Log</Link></div>
    <section className="card"><form className="card-body actions"><label className="field"><span>ค้นหา</span><input className="control" name="q" defaultValue={query} placeholder="Prospect code, บริษัท หรือ Tax ID"/></label><button className="primary">ค้นหา</button></form><div className="table-wrap"><table className="table"><thead><tr><th>Prospect</th><th>สถานะเดิม</th><th>เหตุผล</th><th>ลบโดย / เวลา</th><th>การทำงาน</th></tr></thead><tbody>{rows.map(row=><tr key={row.id}><td><strong>{row.prospectCode}</strong><br/><small>{row.companyName}</small></td><td><span className="badge muted">{row.status}</span></td><td>{row.deleteReason??"—"}</td><td>{row.deletedById?actorMap.get(row.deletedById)??row.deletedById:"—"}<br/><small>{row.deletedAt?.toLocaleString("th-TH",{timeZone:"Asia/Bangkok"})}</small></td><td><DeletedProspectActions id={row.id} version={row.version} canPermanentlyDelete={permissions.has(PERMISSIONS.prospectPermanentDelete)}/></td></tr>)}</tbody></table>{!rows.length&&<div className="empty">ไม่พบ Prospect ที่ถูกลบ</div>}</div></section>
  </>;
}
