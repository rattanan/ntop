import Link from "next/link";
import { notFound } from "next/navigation";
import { ContractWorkflowControls } from "@/components/contract-workflow-controls";
import { PageNumberNavigation } from "@/components/page-number-navigation";
import { SortableTableHeader } from "@/components/sortable-table-header";
import { requireSession } from "@/lib/auth";
import { loadAuthorizationContext } from "@/lib/authorization/authorization-context";
import { assertPermission, PERMISSIONS, permissionPolicy } from "@/lib/authorization/permission-policy";
import { createContractRuntime } from "@/lib/contract/contract-runtime";
import { prisma } from "@/lib/prisma";
import { isApprovalWorkflowEnforced } from "@/lib/approval/approval-control";
import type { Prisma } from "@prisma/client";

const money = new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB", maximumFractionDigits: 2 });
const date = new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeZone: "Asia/Bangkok" });
const dateTime = new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Bangkok" });
const documentSortKeys = new Set(["createdAt", "fileName", "category", "sizeBytes", "versionNumber"]);
const documentPageSize = 10;

function fileSize(bytes: bigint) {
  const value = Number(bytes);
  if (value < 1_000_000) return `${(value / 1_000).toFixed(1)} KB`;
  return `${(value / 1_000_000).toFixed(1)} MB`;
}

export default async function ContractDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const session = await requireSession();
  assertPermission(session, PERMISSIONS.contractView);
  const id = (await params).id;
  const query = await searchParams;
  const documentQuery = String(query.q ?? "").trim().slice(0, 100);
  const documentSort = documentSortKeys.has(String(query.sort)) ? String(query.sort) : "createdAt";
  const documentOrder = query.order === "asc" ? "asc" : "desc";
  const requestedDocumentPage = Math.max(1, Number(query.page ?? 1) || 1);
  const authorization = await loadAuthorizationContext({ actorId: session.id, legacyRole: session.role });
  const runtime = createContractRuntime();
  const allowed = await runtime.repository.transaction((tx) => runtime.repository.find(id, authorization, tx));
  if (!allowed) notFound();
  const roleCodes = authorization.assignments.map((assignment) => assignment.role);
  const [contract, transitions, statuses, grants, approvalEnabled] = await Promise.all([
    prisma.contract.findUnique({ where: { id }, include: { status: true, contractType: true, versions: { orderBy: { versionNumber: "desc" }, include: { items: { orderBy: { sortOrder: "asc" } } } }, signatures: { orderBy: { signedAt: "desc" } }, amendments: true, renewals: { include: { reminders: true } }, purchaseOrders: true, serviceOrders: true } }),
    prisma.contractStatusTransition.findMany({ where: { fromStatusCode: allowed.statusCode, active: true }, orderBy: { toStatusCode: "asc" } }),
    prisma.contractStatusDefinition.findMany({ where: { active: true }, select: { code: true, label: true, sortOrder: true } }),
    prisma.rolePermissionGrant.findMany({ where: { roleCode: { in: roleCodes } }, select: { permissionCode: true } }),
    isApprovalWorkflowEnforced("CONTRACT_APPROVAL"),
  ]);
  if (!contract) notFound();
  const documentWhere: Prisma.ContractDocumentVersionWhereInput = { document: { contractId: id }, ...(documentQuery ? { OR: [{ fileName: { contains: documentQuery } }, { document: { category: { contains: documentQuery } } }] } : {}) };
  const [documentTotal, allDocumentTotal] = await Promise.all([
    prisma.contractDocumentVersion.count({ where: documentWhere }),
    prisma.contractDocumentVersion.count({ where: { document: { contractId: id } } }),
  ]);
  const documentTotalPages = Math.max(1, Math.ceil(documentTotal / documentPageSize));
  const documentPage = Math.min(requestedDocumentPage, documentTotalPages);
  const documentOrderBy: Prisma.ContractDocumentVersionOrderByWithRelationInput[] = documentSort === "category"
    ? [{ document: { category: documentOrder } }, { id: "asc" }]
    : [{ [documentSort]: documentOrder }, { id: "asc" }];
  const documentVersions = await prisma.contractDocumentVersion.findMany({
    where: documentWhere,
    select: { id: true, fileName: true, mimeType: true, sizeBytes: true, versionNumber: true, malwareScanStatus: true, createdAt: true, document: { select: { category: true } } },
    orderBy: documentOrderBy,
    skip: (documentPage - 1) * documentPageSize,
    take: documentPageSize,
  });
  const permissionCodes = new Set(grants.map((grant) => grant.permissionCode));
  const hasPermission = (code: string) => permissionPolicy.allows(session, code as never) || permissionCodes.has(code);
  const current = contract.versions[0];
  const statusMap = new Map(statuses.map((item) => [item.code, item]));
  const enabledTransitions = transitions.filter((edge) => approvalEnabled || (allowed.statusCode !== "PENDING_APPROVAL" && edge.toStatusCode !== "PENDING_APPROVAL"));
  const permittedTransitions = enabledTransitions.filter((edge) => hasPermission(edge.requiredPermission ?? PERMISSIONS.contractManage));
  const canManage = hasPermission(PERMISSIONS.contractManage);
  const canCreateServiceOrder = hasPermission(PERMISSIONS.contractServiceOrderCreate)
    && contract.status.reportingCategory === "ACTIVE"
    && Boolean(current)
    && !contract.serviceOrders.some((order) => order.contractVersionId === current?.id);
  const workflowUnavailableReason = contract.status.terminal
    ? "Contract นี้อยู่ในสถานะสิ้นสุดแล้ว จึงไม่มีสถานะถัดไป"
    : !approvalEnabled && enabledTransitions.length === 0 && transitions.length > 0
      ? "Contract Approval ถูกพักไว้ชั่วคราว จึงยังส่งต่อเข้าสู่ขั้นอนุมัติไม่ได้"
      : transitions.length === 0
          ? "ยังไม่มีเส้นทางสถานะถัดไปที่เปิดใช้งานสำหรับสถานะปัจจุบัน"
          : "คุณดู Contract นี้ได้ แต่ไม่มีสิทธิ์ส่งต่อสถานะ กรุณาให้ผู้รับผิดชอบขั้นตอนถัดไปดำเนินการ";

  return <><div className="page-head"><div><p className="eyebrow">{contract.contractNo} · v{contract.version}</p><h1>{contract.name}</h1><p>{contract.contractType.name} · <span className="badge">{contract.status.label}</span></p></div><Link className="secondary" href="/contracts">Back to portfolio</Link></div>
    {!approvalEnabled&&<p className="notice">Contract Approval ถูกพักไว้ สามารถจัดทำและแก้ไข Draft ได้ แต่ยังส่งหรือบันทึกผลอนุมัติไม่ได้</p>}
    <section className="proposal-kpis"><article><span>TCV</span><strong>{money.format(contract.totalContractValue.toNumber())}</strong><small>{contract.currency}</small></article><article><span>MRR</span><strong>{money.format(contract.monthlyRecurringRevenue.toNumber())}</strong><small>monthly recurring</small></article><article><span>One-time</span><strong>{money.format(contract.oneTimeRevenue.toNumber())}</strong><small>one-time revenue</small></article><article><span>End date</span><strong>{contract.endDate ? date.format(contract.endDate) : "—"}</strong><small>{contract.nextRenewalAt ? `renew ${date.format(contract.nextRenewalAt)}` : "no renewal scheduled"}</small></article></section>
    <ContractWorkflowControls contractId={contract.id} version={contract.version} currentStatusLabel={contract.status.label} workflowUnavailableReason={workflowUnavailableReason} transitions={permittedTransitions.map((item) => ({ code: item.toStatusCode, label: statusMap.get(item.toStatusCode)?.label ?? item.toStatusCode })).sort((a, b) => (statusMap.get(a.code)?.sortOrder ?? 0) - (statusMap.get(b.code)?.sortOrder ?? 0))} canUploadDocument={canManage} canCreateServiceOrder={canCreateServiceOrder} serviceOrders={contract.serviceOrders.map((order) => ({ id: order.id, orderNo: order.orderNo, status: order.status }))} />
    <section className="card" id="contract-documents"><div className="card-header"><div><strong>Contract Documents</strong><small>รายการเอกสารและ version ที่อัปโหลดล่าสุด</small></div><span className="badge muted">{allDocumentTotal} files</span></div>
      <form className="table-tools" method="get"><label className="field"><span>ค้นหาเอกสาร</span><input className="control" type="search" name="q" defaultValue={documentQuery} maxLength={100} placeholder="ชื่อไฟล์หรือ Category" /></label><input type="hidden" name="sort" value={documentSort}/><input type="hidden" name="order" value={documentOrder}/><button className="secondary" type="submit">ค้นหา</button>{documentQuery && <Link className="secondary" href={`/contracts/${id}#contract-documents`}>ล้างการค้นหา</Link>}</form>
      <div className="table-wrap"><table className="table"><thead><tr>
        <SortableTableHeader basePath={`/contracts/${id}`} column="fileName" currentSort={documentSort} currentOrder={documentOrder} label="File" params={documentQuery ? { q: documentQuery } : {}}/>
        <SortableTableHeader basePath={`/contracts/${id}`} column="category" currentSort={documentSort} currentOrder={documentOrder} label="Category" params={documentQuery ? { q: documentQuery } : {}}/>
        <SortableTableHeader basePath={`/contracts/${id}`} column="versionNumber" currentSort={documentSort} currentOrder={documentOrder} label="Version" params={documentQuery ? { q: documentQuery } : {}}/>
        <SortableTableHeader basePath={`/contracts/${id}`} column="sizeBytes" currentSort={documentSort} currentOrder={documentOrder} label="Size" params={documentQuery ? { q: documentQuery } : {}}/>
        <th>Status</th><SortableTableHeader basePath={`/contracts/${id}`} column="createdAt" currentSort={documentSort} currentOrder={documentOrder} label="Uploaded" params={documentQuery ? { q: documentQuery } : {}}/>
      </tr></thead><tbody>{documentVersions.length ? documentVersions.map((document) => <tr key={document.id}><td><strong>{document.fileName}</strong><small className="table-subtext">{document.mimeType}</small></td><td>{document.document.category}</td><td>v{document.versionNumber}</td><td>{fileSize(document.sizeBytes)}</td><td><span className="badge muted">{document.malwareScanStatus}</span></td><td>{dateTime.format(document.createdAt)}</td></tr>) : <tr><td colSpan={6}><div className="empty-state"><strong>ไม่พบเอกสาร</strong><p>{documentQuery ? "ลองเปลี่ยนคำค้นหาหรือล้างการค้นหา" : "อัปโหลดเอกสาร Contract แล้วรายการจะปรากฏที่นี่"}</p></div></td></tr>}</tbody></table></div>
      <PageNumberNavigation ariaLabel="แบ่งหน้ารายการเอกสาร Contract" basePath={`/contracts/${id}`} itemCount={documentVersions.length} page={documentPage} params={{ ...(documentQuery ? { q: documentQuery } : {}), sort: documentSort, order: documentOrder }} total={documentTotal} totalPages={documentTotalPages} unit="ไฟล์"/>
    </section>
    <section className="card"><div className="card-header"><strong>Current version items</strong><span className="badge muted">immutable v{current?.versionNumber}</span></div><div className="table-wrap"><table className="table"><thead><tr><th>Service</th><th>Qty</th><th>Monthly</th><th>One-time</th><th>Duration</th><th>Contract value</th></tr></thead><tbody>{current?.items.map((item) => <tr key={item.id}><td><strong>{item.serviceName}</strong><small className="table-subtext">{item.productCode}</small></td><td>{item.quantity.toString()} {item.unit}</td><td>{money.format(item.monthlyCharge.toNumber())}</td><td>{money.format(item.oneTimeCharge.toNumber())}</td><td>{item.durationMonths} months</td><td>{money.format(item.lineContractValue.toNumber())}</td></tr>)}</tbody></table></div></section>
    <div className="contract-overview-grid"><section className="card"><div className="card-header"><strong>Version timeline</strong></div><div className="card-body contract-version-list">{contract.versions.map((version) => <article key={version.id}><div className="contract-version-main"><span className="badge muted">v{version.versionNumber}</span><div><strong>{statusMap.get(version.statusCode)?.label ?? version.statusCode}</strong><small>{version.changeReason ?? "Initial version"}</small></div></div><div className="contract-version-meta"><strong>{money.format(version.totalContractValue.toNumber())}</strong><time dateTime={version.createdAt.toISOString()}>{date.format(version.createdAt)}</time></div></article>)}</div></section><section className="card"><div className="card-header"><strong>Execution evidence</strong></div><div className="card-body contract-evidence-grid"><article><span>Documents</span><strong>{allDocumentTotal}</strong><small>attached versions</small></article><article><span>Verified signatures</span><strong>{contract.signatures.filter((signature) => signature.status === "VERIFIED").length}</strong><small>verified records</small></article><article><span>Amendments / Renewals</span><strong>{contract.amendments.length} / {contract.renewals.length}</strong><small>execution records</small></article><article><span>PO / Service orders</span><strong>{contract.purchaseOrders.length} / {contract.serviceOrders.length}</strong><small>handoff records</small></article></div></section></div>
  </>;
}
