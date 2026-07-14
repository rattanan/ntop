import {
  ProspectHeatLevel,
  ProspectSource,
  ProspectStatus,
  type Prisma,
} from "@prisma/client";
import Link from "next/link";

import { ModuleTabs } from "@/components/module-tabs";
import { ProspectImportForm } from "@/components/prospect-import-form";
import { requireSession } from "@/lib/auth";
import { loadAuthorizationContext } from "@/lib/authorization/authorization-context";
import { PERMISSIONS } from "@/lib/authorization/permission-policy";
import {
  buildProspectScopeWhere,
  loadProspectPermissions,
} from "@/lib/prospect/prospect-authorization";
import { prisma } from "@/lib/prisma";

type Search = {
  q?: string;
  status?: string;
  heatLevel?: string;
  source?: string;
  province?: string;
  ownerId?: string;
  overdue?: string;
  page?: string;
  columns?: string;
  tab?: string;
};

const allColumns = [
  "code",
  "company",
  "industry",
  "province",
  "source",
  "owner",
  "status",
  "heat",
  "score",
  "value",
  "lastContact",
  "followUp",
  "created",
];

export default async function ProspectsPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const query = await searchParams;
  const session = await requireSession();
  const context = await loadAuthorizationContext({
    actorId: session.id,
    legacyRole: session.role,
  });
  const permissions = await loadProspectPermissions(context);
  const canImport = permissions.has(PERMISSIONS.prospectImport);
  const activeTab = query.tab === "import" && canImport ? "import" : "list";
  const tabItems = [
    { label: "รายการ Prospect", href: "/prospects", active: activeTab === "list" },
    ...(canImport
      ? [{ label: "Import Prospect", href: "/prospects?tab=import", active: activeTab === "import" }]
      : []),
  ];

  if (activeTab === "import") {
    return (
      <>
        <div className="page-head">
          <div>
            <p className="eyebrow">Prospect Management</p>
            <h1>Import Prospect</h1>
            <p>Upload → Validate → Preview → Confirm → Result Summary</p>
          </div>
        </div>
        <ModuleTabs label="เมนู Prospect" items={tabItems} />
        <ProspectImportForm />
      </>
    );
  }

  const page = Math.max(1, Number(query.page ?? 1));
  const columns = (query.columns ?? "").split(",").filter((column) => allColumns.includes(column));
  if (!columns.length) columns.push(...allColumns);
  const status = Object.values(ProspectStatus).includes(query.status as ProspectStatus)
    ? (query.status as ProspectStatus)
    : undefined;
  const heat = Object.values(ProspectHeatLevel).includes(query.heatLevel as ProspectHeatLevel)
    ? (query.heatLevel as ProspectHeatLevel)
    : undefined;
  const source = Object.values(ProspectSource).includes(query.source as ProspectSource)
    ? (query.source as ProspectSource)
    : undefined;
  const where: Prisma.ProspectWhereInput = {
    AND: [
      buildProspectScopeWhere(context, permissions),
      status ? { status } : {},
      heat ? { heatLevel: heat } : {},
      source ? { source } : {},
      query.province ? { province: query.province } : {},
      query.ownerId ? { ownerId: query.ownerId } : {},
      query.overdue === "1"
        ? { nextFollowUpAt: { lt: new Date() }, status: { notIn: ["CONVERTED", "LOST", "ARCHIVED"] } }
        : {},
      query.q
        ? {
            OR: [
              { companyName: { contains: query.q } },
              { companyNameEnglish: { contains: query.q } },
              { prospectCode: { contains: query.q } },
              { taxId: { contains: query.q } },
            ],
          }
        : {},
    ],
  };
  const [rows, total, owners] = await Promise.all([
    prisma.prospect.findMany({
      where,
      include: { owner: { select: { id: true, name: true } }, industry: { select: { name: true } } },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * 50,
      take: 50,
    }),
    prisma.prospect.count({ where }),
    prisma.user.findMany({
      where: { active: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
      take: 500,
    }),
  ]);
  const params = (next: number) =>
    `/prospects?${new URLSearchParams({
      ...Object.fromEntries(Object.entries(query).filter(([, value]) => value)),
      page: String(next),
    } as Record<string, string>)}`;

  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">Prospect Management</p>
          <h1>Prospects</h1>
          <p>{total.toLocaleString("th-TH")} รายการตามขอบเขตสิทธิ์</p>
        </div>
        <div className="actions">
          <Link className="secondary" href="/prospects/dashboard">Dashboard</Link>
          {permissions.has(PERMISSIONS.prospectExport) && (
            <Link className="secondary" href={`/api/v1/prospects/export?${new URLSearchParams(query as Record<string, string>)}`}>Export CSV</Link>
          )}
          {permissions.has(PERMISSIONS.prospectCreate) && (
            <Link className="primary" href="/prospects/new">สร้าง Prospect</Link>
          )}
        </div>
      </div>
      <ModuleTabs label="เมนู Prospect" items={tabItems} />
      <section className="card">
        <form className="card-body form-grid">
          <label className="field"><span>ค้นหา</span><input className="control" name="q" defaultValue={query.q} /></label>
          <label className="field"><span>Status</span><select className="control" name="status" defaultValue={query.status ?? ""}><option value="">ทั้งหมด</option>{Object.values(ProspectStatus).map((value) => <option key={value}>{value}</option>)}</select></label>
          <label className="field"><span>Heat</span><select className="control" name="heatLevel" defaultValue={query.heatLevel ?? ""}><option value="">ทั้งหมด</option>{Object.values(ProspectHeatLevel).map((value) => <option key={value}>{value}</option>)}</select></label>
          <label className="field"><span>Source</span><select className="control" name="source" defaultValue={query.source ?? ""}><option value="">ทั้งหมด</option>{Object.values(ProspectSource).map((value) => <option key={value}>{value}</option>)}</select></label>
          <label className="field"><span>Province</span><input className="control" name="province" defaultValue={query.province} /></label>
          <label className="field"><span>Owner</span><select className="control" name="ownerId" defaultValue={query.ownerId ?? ""}><option value="">ทั้งหมด</option>{owners.map((owner) => <option key={owner.id} value={owner.id}>{owner.name}</option>)}</select></label>
          <label><input type="checkbox" name="overdue" value="1" defaultChecked={query.overdue === "1"} /> Overdue follow-up</label>
          <div className="actions"><button className="primary">ค้นหา</button><Link className="secondary" href="/prospects">Reset Filter</Link></div>
        </form>
      </section>
      <section className="card">
        <div className="table-wrap">
          <table className="table">
            <thead><tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr></thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  {columns.includes("code") && <td><Link className="link" href={`/prospects/${row.id}`}>{row.prospectCode}</Link></td>}
                  {columns.includes("company") && <td>{row.companyName}</td>}
                  {columns.includes("industry") && <td>{row.industry?.name ?? "—"}</td>}
                  {columns.includes("province") && <td>{row.province ?? "—"}</td>}
                  {columns.includes("source") && <td>{row.source}</td>}
                  {columns.includes("owner") && <td>{row.owner.name}</td>}
                  {columns.includes("status") && <td><span className="badge">{row.status}</span></td>}
                  {columns.includes("heat") && <td><span className={`badge prospect-${row.heatLevel.toLowerCase()}`}>{row.heatLevel}</span></td>}
                  {columns.includes("score") && <td>{row.calculatedScore}</td>}
                  {columns.includes("value") && <td>{row.estimatedOpportunityValue?.toString() ?? "—"}</td>}
                  {columns.includes("lastContact") && <td>{row.lastContactAt?.toLocaleDateString("th-TH") ?? "—"}</td>}
                  {columns.includes("followUp") && <td>{row.nextFollowUpAt?.toLocaleString("th-TH", { timeZone: "Asia/Bangkok" }) ?? "—"}</td>}
                  {columns.includes("created") && <td>{row.createdAt.toLocaleDateString("th-TH")}</td>}
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length && <div className="empty">ไม่พบ Prospect</div>}
        </div>
        <div className="card-body actions">
          <span>หน้า {page}</span>
          {page > 1 && <Link className="secondary" href={params(page - 1)}>ก่อนหน้า</Link>}
          {page * 50 < total && <Link className="secondary" href={params(page + 1)}>ถัดไป</Link>}
        </div>
      </section>
    </>
  );
}
