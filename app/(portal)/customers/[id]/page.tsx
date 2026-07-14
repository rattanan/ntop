import Link from "next/link";
import { notFound } from "next/navigation";

import { CustomerGovernanceActions } from "@/components/customer-governance-actions";
import { CustomerContactForm } from "@/components/customer-contact-form";
import { CustomerLifecycleActions } from "@/components/data-retention-actions";
import { CustomerForm } from "@/components/forms";
import { isAdmin, requireSession } from "@/lib/auth";
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
import { prisma } from "@/lib/prisma";

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

const customerTabs = ["overview", "contacts", "governance", "sales"] as const;
type CustomerTab = (typeof customerTabs)[number];

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
  const editable = session.role !== "VIEWER" && !customer.mergedIntoCustomerId;
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
  const [users, customerOptions] = await Promise.all([
    isAdmin(session.role)
      ? prisma.user.findMany({
          select: { id: true, name: true, email: true },
          orderBy: { name: "asc" },
        })
      : Promise.resolve([]),
    prisma.customer.findMany({
      where: {
        AND: [
          { id: { not: customer.id }, mergedIntoCustomerId: null },
          buildCustomerScopeWhere(context),
        ],
      },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
      take: 200,
    }),
  ]);
  const duplicateCandidates = [
    ...customer.duplicateCandidatesA.map((item) => ({ ...item.customerB, score: Number(item.matchScore) })),
    ...customer.duplicateCandidatesB.map((item) => ({ ...item.customerA, score: Number(item.matchScore) })),
  ];
  const opportunities = [
    ...customer.opportunities,
    ...customer.mergeAliases.flatMap((alias) => alias.opportunities),
  ];
  const leads = [
    ...customer.leads,
    ...customer.mergeAliases.flatMap((alias) => alias.leads),
  ];
  const activities = [
    ...customer.activities,
    ...customer.mergeAliases.flatMap((alias) => alias.activities),
  ]
    .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
    .slice(0, 8);
  const customerFormValue = {
    id: customer.id,
    version: customer.version,
    name: customer.name,
    taxId: customer.taxId,
    type: customer.type,
    segment: customer.segment,
    province: customer.province,
    status: customer.status,
    address: customer.address,
    ownerId: customer.ownerId,
    contacts: customer.contacts.map((contact) => ({
      id: contact.id,
      name: contact.name,
      title: contact.title,
      phone: contact.phone,
      email: contact.email,
      relationship: contact.relationship,
      purpose: contact.purpose,
      isPrimary: contact.isPrimary,
    })),
    externalIds: customer.externalIds.map((externalId) => ({
      sourceSystem: externalId.sourceSystem,
      externalId: externalId.externalId,
    })),
  };
  const tabHref = (tab: CustomerTab, anchor = "") => `/customers/${customer.id}?tab=${tab}${anchor}`;
  return <>
    <div className="customer-hero">
      <div><p className="eyebrow">Customer 360 · {customer.taxId} · v{customer.version}</p><h1>{customer.name}</h1><div className="customer-meta"><span className="badge">{customer.type}</span><span className={`badge ${customer.status === "ACTIVE" ? "success" : "muted"}`}>{customer.status}</span><span>{customer.segment}</span><span>{customer.province}</span></div></div>
      {editable && activeTab === "overview" && <Link className="secondary" href={tabHref("overview", "#edit")}>แก้ไขข้อมูล</Link>}
    </div>
    {customer.mergedIntoCustomer && <p className="notice">บัญชีนี้ถูก merge แล้ว โปรดใช้ <Link className="link" href={`/customers/${customer.mergedIntoCustomer.id}`}>{customer.mergedIntoCustomer.name}</Link></p>}
    {canManageLifecycle&&!customer.mergedIntoCustomerId&&<div style={{marginBottom:18}}><CustomerLifecycleActions id={customer.id} version={customer.version}/></div>}
    <nav className="customer-tabs" aria-label="Customer detail sections">
      <Link className={activeTab === "overview" ? "active" : ""} href={tabHref("overview")}>ภาพรวม</Link>
      <Link className={activeTab === "contacts" ? "active" : ""} href={tabHref("contacts")}><span>Contacts</span><small>{customer.contacts.length}</small></Link>
      <Link className={activeTab === "governance" ? "active" : ""} href={tabHref("governance")}><span>Hierarchy & Duplicate</span><small>{customer.parentRelationships.length + customer.childRelationships.length + duplicateCandidates.length}</small></Link>
      <Link className={activeTab === "sales" ? "active" : ""} href={tabHref("sales")}><span>การขายและกิจกรรม</span><small>{opportunities.length + leads.length + activities.length}</small></Link>
    </nav>

    {activeTab === "overview" && <div className="customer-tab-panel">
      <section className="card compact-card"><div className="card-header">ภาพรวมบัญชี</div><div className="card-body detail-grid"><div><p className="detail-label">เจ้าของบัญชี</p><p className="detail-value">{customer.owner.name}</p></div><div><p className="detail-label">Organization</p><p className="detail-value">{customer.organizationUnit?.name ?? "—"}</p></div><div><p className="detail-label">ที่อยู่</p><p className="detail-value">{customer.address || "—"}</p></div></div></section>
      <div className="detail-columns compact-columns"><section className="card compact-card"><div className="card-header">Identifiers และ aliases</div><div className="card-body">{customer.externalIds.map(item=><div className="timeline" key={item.id}><strong>{item.sourceSystem}</strong><p>{item.externalId}</p></div>)}{customer.mergeAliases.map(alias=><div className="timeline" key={alias.id}><strong>Alias · {alias.name}</strong><p>{alias.taxId}</p></div>)}{!customer.externalIds.length&&!customer.mergeAliases.length&&<div className="compact-empty">ยังไม่มี External ID หรือ alias</div>}</div></section><section className="card compact-card"><div className="card-header">Ownership history</div><div className="card-body">{customer.ownershipHistory.map(item=><div className="timeline" key={item.id}><strong>{item.owner.name}</strong><p>{item.organizationUnit?.name ?? "ไม่ระบุหน่วยงาน"}</p><small>{item.validFrom.toLocaleString("th-TH",{timeZone:"Asia/Bangkok"})}{item.validTo?` – ${item.validTo.toLocaleString("th-TH",{timeZone:"Asia/Bangkok"})}`:" – ปัจจุบัน"}</small></div>)}{!customer.ownershipHistory.length&&<div className="compact-empty">ยังไม่มีประวัติเจ้าของบัญชี</div>}</div></section></div>
      {editable&&<section id="edit" className="customer-edit-section"><div className="section-heading"><div><p className="eyebrow">Account maintenance</p><h2>แก้ไขข้อมูลลูกค้า</h2></div></div><CustomerForm value={customerFormValue} users={users} role={session.role}/></section>}
    </div>}

    {activeTab === "contacts" && <div className="customer-tab-panel customer-contact-layout"><section className="card compact-card" id="contacts"><div className="card-header"><div><strong>ผู้ติดต่อทั้งหมด</strong><small>{customer.contacts.length} รายการ</small></div></div><div className="card-body">{customer.contacts.length?customer.contacts.map(contact=><div className="contact-record" key={contact.id}><div className="relationship"><div><strong>{contact.name}</strong><p>{contact.title||"ไม่ระบุตำแหน่ง"}{contact.relationship?` · ${contact.relationship}`:""}</p></div><span className={`badge ${contact.isPrimary?"success":"muted"}`}>{contact.isPrimary?"Primary":contact.purpose||"Contact"}</span><small>{contact.email||"ไม่มีอีเมล"} · {contact.phone||"ไม่มีโทรศัพท์"}</small></div>{editable&&<details className="contact-edit"><summary>แก้ไขรายละเอียด Contact</summary><CustomerContactForm customerId={customer.id} customerVersion={customer.version} value={contact}/></details>}</div>):<div className="compact-empty">ยังไม่มีผู้ติดต่อ</div>}</div></section>{editable&&<section className="card compact-card contact-create"><div className="card-header"><div><strong>เพิ่ม Contact</strong><small>สร้างผู้ติดต่อใหม่ภายใต้ Customer นี้</small></div></div><div className="card-body"><CustomerContactForm customerId={customer.id} customerVersion={customer.version}/></div></section>}</div>}

    {activeTab === "governance" && <div className="customer-tab-panel"><div className="governance-summary"><section className="card compact-card"><div className="card-header"><div><strong>Customer hierarchy</strong><small>Parent และ Child ที่มีผลอยู่</small></div></div><div className="card-body hierarchy-list">{customer.childRelationships.map(item=><div className="hierarchy-row" key={item.id}><span className="hierarchy-type">Parent</span><Link className="link" href={`/customers/${item.parentCustomer.id}`}>{item.parentCustomer.name}</Link><small>{item.relationshipType}</small></div>)}{customer.parentRelationships.map(item=><div className="hierarchy-row" key={item.id}><span className="hierarchy-type child">Child</span><Link className="link" href={`/customers/${item.childCustomer.id}`}>{item.childCustomer.name}</Link><small>{item.relationshipType}</small></div>)}{!customer.childRelationships.length&&!customer.parentRelationships.length&&<div className="compact-empty">ยังไม่มี Customer hierarchy</div>}</div></section><section className="card compact-card"><div className="card-header"><div><strong>Duplicate candidates</strong><small>รายการที่ยังไม่ได้ resolve</small></div><span className="badge">{duplicateCandidates.length}</span></div><div className="card-body">{duplicateCandidates.map(candidate=><div className="duplicate-row" key={candidate.id}><div><Link className="link" href={`/customers/${candidate.id}`}>{candidate.name}</Link><small>{candidate.taxId}</small></div><span>{Math.round(candidate.score*100)}% match</span></div>)}{!duplicateCandidates.length&&<div className="compact-empty">ไม่พบ duplicate candidate ที่รอตรวจสอบ</div>}</div></section></div>{editable&&<CustomerGovernanceActions customerId={customer.id} customers={customerOptions} canMerge={canMerge}/>}</div>}

    {activeTab === "sales" && <div className="customer-tab-panel"><div className="detail-columns compact-columns"><section className="card compact-card"><div className="card-header">Opportunity</div><div className="card-body">{opportunities.length?opportunities.map(item=><div className="timeline" key={item.id}><Link className="link" href={`/opportunities/${item.id}`}>{item.name}</Link><p>{stage[item.stage]??item.stage} · {new Intl.NumberFormat("th-TH",{style:"currency",currency:"THB",maximumFractionDigits:0}).format(Number(item.estimatedValue))}</p></div>):<div className="compact-empty">ยังไม่มีโอกาสขาย</div>}</div></section><section className="card compact-card"><div className="card-header">Lead ที่เกี่ยวข้อง</div><div className="card-body">{leads.length?leads.map(item=><div className="timeline" key={item.id}><Link className="link" href={`/leads/${item.id}`}>{item.company}</Link><p>{item.contactName} · Score {item.score}</p><small>{item.recommendedProducts||"ยังไม่มีสินค้าแนะนำ"}</small></div>):<div className="compact-empty">ยังไม่มี Lead ที่ผูกกับบัญชีนี้</div>}</div></section></div><section className="card compact-card sales-activity"><div className="card-header">กิจกรรมล่าสุด</div><div className="card-body">{activities.length?activities.map(item=><div className="timeline" key={item.id}><strong>{item.subject}</strong><p>{item.aiSummary||item.notes||"ไม่มีรายละเอียด"}</p><small>{item.owner.name} · {item.createdAt.toLocaleDateString("th-TH")}</small></div>):<div className="compact-empty">ยังไม่มีกิจกรรม</div>}</div></section></div>}
  </>;
}
