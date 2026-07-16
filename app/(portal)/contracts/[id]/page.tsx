import Link from "next/link";
import { notFound } from "next/navigation";
import { ContractWorkflowControls } from "@/components/contract-workflow-controls";
import { requireSession } from "@/lib/auth";
import { loadAuthorizationContext } from "@/lib/authorization/authorization-context";
import { assertPermission, PERMISSIONS, permissionPolicy } from "@/lib/authorization/permission-policy";
import { createContractRuntime } from "@/lib/contract/contract-runtime";
import { prisma } from "@/lib/prisma";

const money = new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB", maximumFractionDigits: 2 });
const date = new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeZone: "Asia/Bangkok" });

export default async function ContractDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  assertPermission(session, PERMISSIONS.contractView);
  const id = (await params).id;
  const authorization = await loadAuthorizationContext({ actorId: session.id, legacyRole: session.role });
  const runtime = createContractRuntime();
  const allowed = await runtime.repository.transaction((tx) => runtime.repository.find(id, authorization, tx));
  if (!allowed) notFound();
  const roleCodes = authorization.assignments.map((assignment) => assignment.role);
  const [contract, transitions, statuses, grants] = await Promise.all([
    prisma.contract.findUnique({ where: { id }, include: { status: true, contractType: true, versions: { orderBy: { versionNumber: "desc" }, include: { items: { orderBy: { sortOrder: "asc" } } } }, signatures: { orderBy: { signedAt: "desc" } }, documents: { include: { versions: true } }, amendments: true, renewals: { include: { reminders: true } }, purchaseOrders: true, serviceOrders: true } }),
    prisma.contractStatusTransition.findMany({ where: { fromStatusCode: allowed.statusCode, active: true }, orderBy: { toStatusCode: "asc" } }),
    prisma.contractStatusDefinition.findMany({ where: { active: true }, select: { code: true, label: true, sortOrder: true } }),
    prisma.rolePermissionGrant.findMany({ where: { roleCode: { in: roleCodes } }, select: { permissionCode: true } }),
  ]);
  if (!contract) notFound();
  const permissionCodes = new Set(grants.map((grant) => grant.permissionCode));
  const hasPermission = (code: string) => permissionPolicy.allows(session, code as never) || permissionCodes.has(code);
  const current = contract.versions[0];
  const statusMap = new Map(statuses.map((item) => [item.code, item]));
  const visibleTransitions = transitions.filter((edge) => hasPermission(edge.requiredPermission ?? PERMISSIONS.contractManage) && (!edge.makerChecker || contract.ownerId !== session.id));
  const cleanDocuments = contract.documents.flatMap((document) => document.versions.filter((version) => version.malwareScanStatus === "CLEAN").map((version) => ({ id: version.id, label: `${document.category} · ${version.fileName} · v${version.versionNumber}` })));
  const canManage = hasPermission(PERMISSIONS.contractManage);
  const canSign = hasPermission(PERMISSIONS.contractSignatureManage) && !contract.status.terminal;

  return <><div className="page-head"><div><p className="eyebrow">{contract.contractNo} · v{contract.version}</p><h1>{contract.name}</h1><p>{contract.contractType.name} · <span className="badge">{contract.status.label}</span></p></div><Link className="secondary" href="/contracts">Back to portfolio</Link></div>
    <section className="proposal-kpis"><article><span>TCV</span><strong>{money.format(contract.totalContractValue.toNumber())}</strong><small>{contract.currency}</small></article><article><span>MRR</span><strong>{money.format(contract.monthlyRecurringRevenue.toNumber())}</strong><small>monthly recurring</small></article><article><span>One-time</span><strong>{money.format(contract.oneTimeRevenue.toNumber())}</strong><small>one-time revenue</small></article><article><span>End date</span><strong>{contract.endDate ? date.format(contract.endDate) : "—"}</strong><small>{contract.nextRenewalAt ? `renew ${date.format(contract.nextRenewalAt)}` : "no renewal scheduled"}</small></article></section>
    <ContractWorkflowControls contractId={contract.id} version={contract.version} transitions={visibleTransitions.map((item) => ({ code: item.toStatusCode, label: statusMap.get(item.toStatusCode)?.label ?? item.toStatusCode })).sort((a, b) => (statusMap.get(a.code)?.sortOrder ?? 0) - (statusMap.get(b.code)?.sortOrder ?? 0))} canUploadDocument={canManage} canSign={canSign} documents={cleanDocuments} />
    <section className="card"><div className="card-header"><strong>Current version items</strong><span className="badge muted">immutable v{current?.versionNumber}</span></div><div className="table-wrap"><table className="table"><thead><tr><th>Service</th><th>Qty</th><th>Monthly</th><th>One-time</th><th>Duration</th><th>Contract value</th></tr></thead><tbody>{current?.items.map((item) => <tr key={item.id}><td><strong>{item.serviceName}</strong><small className="table-subtext">{item.productCode}</small></td><td>{item.quantity.toString()} {item.unit}</td><td>{money.format(item.monthlyCharge.toNumber())}</td><td>{money.format(item.oneTimeCharge.toNumber())}</td><td>{item.durationMonths} months</td><td>{money.format(item.lineContractValue.toNumber())}</td></tr>)}</tbody></table></div></section>
    <div className="proposal-dashboard-grid"><section className="card"><div className="card-header"><strong>Version timeline</strong></div><div className="card-body proposal-status-cards">{contract.versions.map((version) => <div key={version.id}><span>v{version.versionNumber} · {version.statusCode}</span><strong>{money.format(version.totalContractValue.toNumber())}</strong><small>{date.format(version.createdAt)} · {version.changeReason ?? "Initial version"}</small></div>)}</div></section><section className="card"><div className="card-header"><strong>Execution evidence</strong></div><div className="card-body proposal-status-cards"><div><span>Documents</span><strong>{contract.documents.reduce((sum, document) => sum + document.versions.length, 0)}</strong></div><div><span>Verified signatures</span><strong>{contract.signatures.filter((signature) => signature.status === "VERIFIED").length}</strong></div><div><span>Amendments / Renewals</span><strong>{contract.amendments.length} / {contract.renewals.length}</strong></div><div><span>PO / Service orders</span><strong>{contract.purchaseOrders.length} / {contract.serviceOrders.length}</strong></div></div></section></div>
  </>;
}
