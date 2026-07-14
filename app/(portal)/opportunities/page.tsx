import Link from "next/link";

import { OpportunityList } from "@/components/record-list";
import { requireSession } from "@/lib/auth";
import { loadAuthorizationContext } from "@/lib/authorization/authorization-context";
import { listOpportunities } from "@/lib/opportunity/opportunity-query-service";

const stageLabels: Record<string,string> = { QUALIFY:"คัดกรอง",DISCOVER:"ค้นหาความต้องการ",SOLUTION:"ออกแบบโซลูชัน",PROPOSAL:"ยื่นข้อเสนอ",NEGOTIATION:"เจรจา",WON:"ชนะ",LOST:"ไม่ชนะ",CANCELLED:"ยกเลิก" };
const currency = new Intl.NumberFormat("th-TH", { style:"currency",currency:"THB",maximumFractionDigits:0 });

export default async function OpportunitiesPage() {
  const session = await requireSession();
  const context = await loadAuthorizationContext({ actorId:session.id,legacyRole:session.role });
  const { items } = await listOpportunities(context, { limit:200 });
  return <><div className="page-head"><div><p className="eyebrow">Pipeline · ข้อมูลตามขอบเขตสิทธิ์</p><h1>โอกาสขาย</h1><p>ติดตามมูลค่า Forecast และวันที่คาดว่าจะปิดในมุมมองเดียว</p></div>{session.role!=="VIEWER"&&<Link className="primary" href="/opportunities/new">สร้างโอกาสขาย</Link>}</div><OpportunityList rows={items.map((record)=>{const weighted=record.estimatedValue.mul(record.probability).div(100);return { id:record.id,number:record.opportunityNumber??"กำลังจัดเลข",name:record.name,customer:record.customer.name,flow:record.flow,stage:stageLabels[record.stage]??record.stage,value:currency.format(Number(record.estimatedValue)),weightedValue:currency.format(Number(weighted)),probability:record.probability,forecastCategory:record.forecastCategory,closeDate:record.expectedCloseAt?.toLocaleDateString("th-TH")??"ยังไม่กำหนด",owner:record.owner.name };})}/></>;
}
