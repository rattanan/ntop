import { Pencil, Plus } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { CustomerGovernanceActions } from "@/components/customer-governance-actions";
import { CustomerLifecycleActions } from "@/components/data-retention-actions";
import { requireSession } from "@/lib/auth";
import { loadAuthorizationContext } from "@/lib/authorization/authorization-context";
import {
  PERMISSIONS,
  permissionPolicy,
} from "@/lib/authorization/permission-policy";
import { buildCustomerScopeWhere } from "@/lib/customer/customer-query-service";
import {
  getCustomer360,
  hasConfiguredCustomerPermission,
} from "@/lib/customer/prisma-customer-repository";
import { LEAD_CREATE_ROLES } from "@/lib/lead/lead-rules";
import { prisma } from "@/lib/prisma";
import { formatMoney } from "@/lib/number-format";

const stage: Record<string, string> = {
  QUALIFY: "คัดกรอง",
  DISCOVER: "วิเคราะห์ความต้องการ",
  SOLUTION: "ออกแบบโซลูชัน",
  PROPOSAL: "เสนอราคา",
  NEGOTIATION: "เจรจา",
  WON: "ชนะ",
  LOST: "ไม่ชนะ",
  CANCELLED: "ยกเลิก",
  EXPIRED: "หมดอายุ",
};

const customerTabs = ["overview", "sales", "contacts", "governance"] as const;
type CustomerTab = (typeof customerTabs)[number];

const customerStatusLabels: Record<string, string> = {
  PROSPECT: "Prospect Customer",
  ACTIVE: "Active Customer",
  INACTIVE: "Inactive Customer",
  BLACKLISTED: "Watchlist Customer",
  CLOSED: "Closed Customer",
};
const companySizeLabels: Record<string, string> = { SMALL: "เล็ก", MEDIUM: "กลาง", LARGE: "ใหญ่" };

export default async function CustomerDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const requestedTab = (await searchParams).tab;
  const activeTab: CustomerTab = customerTabs.includes(requestedTab as CustomerTab)
    ? (requestedTab as CustomerTab)
    : "overview";
  const session = await requireSession();
  const context = await loadAuthorizationContext({
    actorId: session.id,
    legacyRole: session.role,
  });
  const customer = await getCustomer360(prisma, context, id);
  if (!customer) notFound();
  const editable = permissionPolicy.allows(session, PERMISSIONS.recordUpdate) && !customer.mergedIntoCustomerId;
  const canCreateRelated =
    permissionPolicy.allows(session, PERMISSIONS.recordCreate) &&
    !customer.mergedIntoCustomerId;
  const canCreateLead =
    canCreateRelated &&
    context.assignments.some((assignment) =>
      (LEAD_CREATE_ROLES as readonly string[]).includes(assignment.role),
    );
  const canMerge =
    permissionPolicy.allows(session, PERMISSIONS.customerMerge) ||
    (await hasConfiguredCustomerPermission(
      prisma,
      context,
      PERMISSIONS.customerMerge,
    ));
  const canManageLifecycle = await hasConfiguredCustomerPermission(
    prisma,
    context,
    PERMISSIONS.customerLifecycleManage,
  );
  const customerOptions = await prisma.customer.findMany({
    where: {
      AND: [
        { id: { not: customer.id }, mergedIntoCustomerId: null },
        buildCustomerScopeWhere(context),
      ],
    },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
    take: 200,
  });
  const duplicateCandidates = [
    ...customer.duplicateCandidatesA.map((item) => ({ ...item.customerB, score: Number(item.matchScore) })),
    ...customer.duplicateCandidatesB.map((item) => ({ ...item.customerA, score: Number(item.matchScore) })),
  ];
  // Sales records must remain scoped to this exact Customer. Alias records are
  // intentionally not mixed into the primary account because a historical
  // merge candidate can otherwise surface an unrelated company's pipeline.
  const opportunities = customer.opportunities;
  const leads = customer.leads;
  const activities = customer.activities
    .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
    .slice(0, 8);
  const openLeads = leads.filter((lead) => !["CONVERTED", "DISQUALIFIED", "INVALID", "DUPLICATE", "ARCHIVED"].includes(lead.status)).length;
  const salesJourney = opportunities.length ? stage[opportunities[0].stage] ?? opportunities[0].stage : leads.length ? "Lead" : "ยังไม่เริ่มกระบวนการขาย";
  const profileValues = [customer.taxId, customer.segment, customer.subIndustry, customer.companySize, customer.province, customer.address, customer.contacts.length ? "contact" : null];
  const profileCompleteness = Math.round(profileValues.filter(Boolean).length / profileValues.length * 100);
  const tabHref = (tab: CustomerTab) => `/customers/${customer.id}?tab=${tab}`;
  return <>
    <div className="customer-hero">
      <div><p className="eyebrow">Customer 360 · {customer.taxId} · v{customer.version}</p><h1>{customer.name}</h1><div className="customer-meta"><span className="badge">{customer.type}</span><span className={`badge ${customer.status === "ACTIVE" ? "success" : "muted"}`}>Customer · {customerStatusLabels[customer.status] ?? customer.status}</span><span className="badge muted">Sales · {salesJourney}</span><span>{customer.segment}</span><span>{customer.province}</span></div></div>
      <div className="actions customer-hero-actions">{canManageLifecycle&&!customer.mergedIntoCustomerId&&<CustomerLifecycleActions id={customer.id} version={customer.version}/>} {editable && <Link className="secondary" href={`/customers/${customer.id}/edit`}><Pencil aria-hidden="true" />แก้ไข</Link>}</div>
    </div>
    {customer.mergedIntoCustomer && <p className="notice">บัญชีนี้ถูก merge แล้ว โปรดใช้ <Link className="link" href={`/customers/${customer.mergedIntoCustomer.id}`}>{customer.mergedIntoCustomer.name}</Link></p>}
    <nav className="customer-tabs" aria-label="Customer detail sections">
      <Link className={activeTab === "overview" ? "active" : ""} href={tabHref("overview")}>ภาพรวม</Link>
      <Link className={activeTab === "sales" ? "active" : ""} href={tabHref("sales")}><span>การขายและกิจกรรม</span><small>{opportunities.length + leads.length + activities.length}</small></Link>
      <Link className={activeTab === "contacts" ? "active" : ""} href={tabHref("contacts")}><span>Contacts</span><small>{customer.contacts.length}</small></Link>
      <Link className={activeTab === "governance" ? "active" : ""} href={tabHref("governance")}><span>Hierarchy & Duplicate</span><small>{customer.parentRelationships.length + customer.childRelationships.length + duplicateCandidates.length}</small></Link>
    </nav>

    {activeTab === "overview" && <div className="customer-tab-panel">
      <section className="customer-overview-kpis" aria-label="Customer summary dashboard"><article><span>สถานะบัญชี</span><strong>{customerStatusLabels[customer.status] ?? customer.status}</strong><small>Customer lifecycle</small></article><article><span>สถานะการขาย</span><strong>{salesJourney}</strong><small>{openLeads} Lead ที่กำลังติดตาม</small></article><article><span>Opportunity</span><strong>{opportunities.length}</strong><small>ผูกกับ Customer นี้โดยตรง</small></article><article><span>ความครบถ้วนโปรไฟล์</span><strong>{profileCompleteness}%</strong><div className="customer-profile-meter" aria-label={`ข้อมูลโปรไฟล์ครบ ${profileCompleteness}%`}><span style={{width:`${profileCompleteness}%`}}/></div></article></section>
      <section className="card compact-card"><div className="card-header">รายละเอียด Customer</div><div className="card-body detail-grid"><div><p className="detail-label">รหัสผู้เสียภาษี</p><p className="detail-value">{customer.taxId}</p></div><div><p className="detail-label">ประเภท Customer</p><p className="detail-value">{customer.type}</p></div><div><p className="detail-label">Segment</p><p className="detail-value">{customer.segment}</p></div><div><p className="detail-label">อุตสาหกรรมย่อย</p><p className="detail-value">{customer.subIndustry || "—"}</p></div><div><p className="detail-label">ขนาดบริษัท</p><p className="detail-value">{customer.companySize ? companySizeLabels[customer.companySize] ?? customer.companySize : "—"}</p></div><div><p className="detail-label">จังหวัด</p><p className="detail-value">{customer.province}</p></div><div><p className="detail-label">เจ้าของบัญชี</p><p className="detail-value">{customer.owner.name}</p></div><div><p className="detail-label">Organization</p><p className="detail-value">{customer.organizationUnit?.name ?? "—"}</p></div><div><p className="detail-label">ที่อยู่</p><p className="detail-value">{customer.address || "—"}</p></div></div></section>
      <div className="detail-columns compact-columns"><section className="card compact-card"><div className="card-header">Identifiers และ aliases</div><div className="card-body">{customer.externalIds.map(item=><div className="timeline" key={item.id}><strong>{item.sourceSystem}</strong><p>{item.externalId}</p></div>)}{customer.mergeAliases.map(alias=><div className="timeline" key={alias.id}><strong>Alias · {alias.name}</strong><p>{alias.taxId}</p></div>)}{!customer.externalIds.length&&!customer.mergeAliases.length&&<div className="compact-empty">ยังไม่มี External ID หรือ alias</div>}</div></section><section className="card compact-card"><div className="card-header">Ownership history</div><div className="card-body">{customer.ownershipHistory.map(item=><div className="timeline" key={item.id}><strong>{item.owner.name}</strong><p>{item.organizationUnit?.name ?? "ไม่ระบุหน่วยงาน"}</p><small>{item.validFrom.toLocaleString("th-TH",{timeZone:"Asia/Bangkok"})}{item.validTo?` – ${item.validTo.toLocaleString("th-TH",{timeZone:"Asia/Bangkok"})}`:" – ปัจจุบัน"}</small></div>)}{!customer.ownershipHistory.length&&<div className="compact-empty">ยังไม่มีประวัติเจ้าของบัญชี</div>}</div></section></div>
    </div>}

    {activeTab === "contacts" && <div className="customer-tab-panel"><section className="card compact-card" id="contacts"><div className="card-header"><div><strong>ผู้ติดต่อทั้งหมด</strong><small>{customer.contacts.length} รายการ</small></div></div><div className="card-body">{customer.contacts.length?customer.contacts.map(contact=><div className="contact-record" key={contact.id}><div className="relationship"><div><strong>{contact.name}</strong><p>{contact.title||"ไม่ระบุตำแหน่ง"}{contact.relationship?` · ${contact.relationship}`:""}</p></div><span className={`badge ${contact.isPrimary?"success":"muted"}`}>{contact.isPrimary?"Primary":contact.purpose||"Contact"}</span><small>{contact.email||"ไม่มีอีเมล"} · {contact.phone||"ไม่มีโทรศัพท์"}</small></div></div>):<div className="compact-empty">ยังไม่มีผู้ติดต่อ</div>}</div></section></div>}

    {activeTab === "governance" && <div className="customer-tab-panel"><div className="governance-summary"><section className="card compact-card"><div className="card-header"><div><strong>Customer hierarchy</strong><small>Parent และ Child ที่มีผลอยู่</small></div></div><div className="card-body hierarchy-list">{customer.childRelationships.map(item=><div className="hierarchy-row" key={item.id}><span className="hierarchy-type">Parent</span><Link className="link" href={`/customers/${item.parentCustomer.id}`}>{item.parentCustomer.name}</Link><small>{item.relationshipType}</small></div>)}{customer.parentRelationships.map(item=><div className="hierarchy-row" key={item.id}><span className="hierarchy-type child">Child</span><Link className="link" href={`/customers/${item.childCustomer.id}`}>{item.childCustomer.name}</Link><small>{item.relationshipType}</small></div>)}{!customer.childRelationships.length&&!customer.parentRelationships.length&&<div className="compact-empty">ยังไม่มี Customer hierarchy</div>}</div></section><section className="card compact-card"><div className="card-header"><div><strong>Duplicate candidates</strong><small>รายการที่ยังไม่ได้ resolve</small></div><span className="badge">{duplicateCandidates.length}</span></div><div className="card-body">{duplicateCandidates.map(candidate=><div className="duplicate-row" key={candidate.id}><div><Link className="link" href={`/customers/${candidate.id}`}>{candidate.name}</Link><small>{candidate.taxId}</small></div><span>{Math.round(candidate.score*100)}% match</span></div>)}{!duplicateCandidates.length&&<div className="compact-empty">ไม่พบ duplicate candidate ที่รอตรวจสอบ</div>}</div></section></div>{editable&&<CustomerGovernanceActions customerId={customer.id} customers={customerOptions} canMerge={canMerge}/>}</div>}

    {activeTab === "sales" && <div className="customer-tab-panel">
      <div className="detail-columns compact-columns">
        <section className="card compact-card">
          <div className="card-header"><strong>Opportunity</strong>{canCreateRelated&&<Link className="secondary customer-panel-create" href="/opportunities/new" aria-label="สร้าง Opportunity"><Plus aria-hidden="true"/>สร้าง</Link>}</div>
          <div className="card-body">{opportunities.length?opportunities.map(item=><div className="timeline" key={item.id}><Link className="link" href={`/opportunities/${item.id}`}>{item.name}</Link><p>{stage[item.stage]??item.stage} · {formatMoney(item.estimatedValue,"THB")}</p></div>):<div className="compact-empty">ยังไม่มีโอกาสขาย</div>}</div>
        </section>
        <section className="card compact-card">
          <div className="card-header"><strong>Lead ที่เกี่ยวข้อง</strong>{canCreateLead&&<Link className="secondary customer-panel-create" href="/leads/new" aria-label="สร้าง Lead"><Plus aria-hidden="true"/>สร้าง</Link>}</div>
          <div className="card-body">{leads.length?leads.map(item=><div className="timeline" key={item.id}><Link className="link" href={`/leads/${item.id}`}>{item.company}</Link><p>{item.contactName} · Score {item.score}</p><small>{item.recommendedProducts||"ยังไม่มีสินค้าแนะนำ"}</small></div>):<div className="compact-empty">ยังไม่มี Lead ที่ผูกกับบัญชีนี้</div>}</div>
        </section>
      </div>
      <section className="card compact-card sales-activity">
        <div className="card-header"><strong>กิจกรรมล่าสุด</strong>{canCreateRelated&&<Link className="secondary customer-panel-create" href="/activities/new" aria-label="สร้างกิจกรรม"><Plus aria-hidden="true"/>สร้าง</Link>}</div>
        <div className="card-body">{activities.length?activities.map(item=><div className="timeline" key={item.id}><strong>{item.subject}</strong><p>{item.aiSummary||item.notes||"ไม่มีรายละเอียด"}</p><small>{item.owner.name} · {item.createdAt.toLocaleDateString("th-TH")}</small></div>):<div className="compact-empty">ยังไม่มีกิจกรรม</div>}</div>
      </section>
    </div>}
  </>;
}
