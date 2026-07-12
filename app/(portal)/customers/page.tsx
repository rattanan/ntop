import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { CustomerTable } from "@/components/customer-table";
import { SEGMENTS } from "@/lib/constants";
import { loadAuthorizationContext } from "@/lib/authorization/authorization-context";
import { listCustomers } from "@/lib/customer/customer-query-service";

export default async function CustomersPage({ searchParams }: { searchParams: Promise<{q?:string;segment?:string;cursor?:string}> }) {
  const session=await requireSession();
  const parameters=await searchParams;
  const context=await loadAuthorizationContext({actorId:session.id,legacyRole:session.role});
  const result=await listCustomers(context,{query:parameters.q,segment:parameters.segment,cursor:parameters.cursor});
  const next=new URLSearchParams();
  if(parameters.q)next.set("q",parameters.q);
  if(parameters.segment)next.set("segment",parameters.segment);
  if(result.nextCursor)next.set("cursor",result.nextCursor);
  return <><div className="page-head"><div><p className="eyebrow">บัญชีลูกค้า</p><h1>ลูกค้าองค์กร</h1></div>{session.role !== "VIEWER"&&<Link className="primary" href="/customers/new">สร้างลูกค้า</Link>}</div><section className="card"><form method="get" className="table-tools"><input className="control search" name="q" maxLength={100} placeholder="ชื่อขึ้นต้น เลขนิติบุคคล หรือจังหวัด" defaultValue={parameters.q}/><select className="control" name="segment" style={{width:180}} defaultValue={parameters.segment??""}><option value="">ทุก Segment</option>{SEGMENTS.map((segment)=><option key={segment}>{segment}</option>)}</select><button className="secondary">ค้นหา</button></form><CustomerTable rows={result.items}/>{result.nextCursor&&<div className="actions" style={{padding:16,margin:0}}><Link className="secondary" href={`/customers?${next.toString()}`}>หน้าถัดไป</Link></div>}</section></>;
}
