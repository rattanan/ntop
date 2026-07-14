import { DealRiskRuleForm } from "@/components/deal-risk-rule-form";
import { listDealRiskRuleVersions } from "@/lib/ai/prisma-deal-risk-repository";
import { PERMISSIONS } from "@/lib/authorization/permission-policy";
import { requirePermission } from "@/lib/authorization/require-permission";
import { prisma } from "@/lib/prisma";

export default async function AiRiskAdministrationPage() {
  await requirePermission(PERMISSIONS.aiConfigManage);
  let rules: Awaited<ReturnType<typeof listDealRiskRuleVersions>> = [];
  let unavailable = false;
  try {
    rules = await listDealRiskRuleVersions(prisma);
  } catch {
    unavailable = true;
  }
  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">Administration</p>
          <h1>Deal Risk Rules</h1>
        </div>
      </div>
      {unavailable && (
        <p className="notice">
          Risk Rule persistence ยังไม่พร้อมใน environment นี้ ระบบจะไม่ apply migration อัตโนมัติ
        </p>
      )}
      <DealRiskRuleForm />
      <section className="card" style={{ marginTop: 20 }}>
        <div className="card-header">Version history</div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr><th>Code</th><th>Version</th><th>Risk type</th><th>Metric / threshold</th><th>Effective</th></tr>
            </thead>
            <tbody>
              {rules.map((rule) => (
                <tr key={rule.id}>
                  <td>{rule.code}</td>
                  <td><span className="badge">v{rule.version}</span></td>
                  <td>{rule.riskType}</td>
                  <td>{rule.configuration.condition.metric} {rule.configuration.condition.operator} {rule.configuration.condition.threshold}</td>
                  <td>{rule.effectiveFrom.toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })}{rule.effectiveTo ? " – " + rule.effectiveTo.toLocaleString("th-TH", { timeZone: "Asia/Bangkok" }) : ""}</td>
                </tr>
              ))}
              {!rules.length && <tr><td colSpan={5} className="empty">ยังไม่มี Risk Rule version</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
