import Link from "next/link";

export function CustomerTable({ rows }: { rows: Array<{ id:string; name:string; taxId:string; type:string; segment:string; province:string; status:string; owner:{name:string} }> }) {
  return <div className="table-wrap"><table className="table"><thead><tr><th>ชื่อลูกค้า</th><th>Segment</th><th>ประเภท</th><th>จังหวัด</th><th>สถานะ</th><th>เจ้าของบัญชี</th></tr></thead><tbody>{rows.map((row)=><tr key={row.id}><td><Link className="link" href={`/customers/${row.id}`}>{row.name}</Link><br/><small>{row.taxId}</small></td><td><span className="badge">{row.segment}</span></td><td>{row.type}</td><td>{row.province}</td><td><span className={`badge ${row.status === "ACTIVE" ? "success" : "muted"}`}>{row.status === "ACTIVE" ? "ใช้งานอยู่" : row.status === "PROSPECT" ? "ผู้มุ่งหวัง" : "ไม่ใช้งาน"}</span></td><td>{row.owner.name}</td></tr>)}</tbody></table>{rows.length===0&&<div className="empty">ไม่พบข้อมูลลูกค้าที่ตรงกับเงื่อนไข</div>}</div>;
}
