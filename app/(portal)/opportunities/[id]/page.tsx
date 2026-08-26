import { Pencil } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { DealRiskPanel } from "@/components/deal-risk-panel";
import { OpportunityRelatedForms } from "@/components/opportunity-related-forms";
import { OpportunityProbabilityDialog, OpportunityTransitionForm } from "@/components/workflow-forms";
import { listOpportunityRiskSignals } from "@/lib/ai/prisma-deal-risk-repository";
import { requireSession } from "@/lib/auth";
import { loadAuthorizationContext } from "@/lib/authorization/authorization-context";
import { PERMISSIONS, permissionPolicy } from "@/lib/authorization/permission-policy";
import { getOpportunityHealth } from "@/lib/opportunity/opportunity-health-query";
import { getOpportunity } from "@/lib/opportunity/opportunity-query-service";
import { OpportunityAccessError } from "@/lib/opportunity/opportunity-service";
import { getOpportunityWorkflowPathStages } from "@/lib/opportunity/opportunity-workflow-path";
import { prisma } from "@/lib/prisma";
import { STAGES } from "@/lib/constants";

function jsonObject(value: unknown): Record<string, unknown> { return value!==null&&typeof value==="object"&&!Array.isArray(value)?value as Record<string,unknown>:{}; }
const healthLabels = { HEALTHY:"Healthy",WATCH:"Watch",AT_RISK:"At Risk",CRITICAL:"Critical" } as const;
const terminalStageLabels: Record<string,string> = { CANCELLED:"ยกเลิก",EXPIRED:"หมดอายุ" };

function OpportunityWorkflowPath({stage}:{stage:string}) {
  const workflowStages=getOpportunityWorkflowPathStages(stage);
  const currentIndex=workflowStages.findIndex(([value])=>value===stage);
  return <div className="opportunity-workflow-path" role="list" aria-label="เส้นทางการขาย">
    {workflowStages.map(([value,label],index)=><div className={`workflow-path-step ${index<currentIndex?"complete":index===currentIndex?"current":"future"}`} role="listitem" aria-current={index===currentIndex?"step":undefined} key={value}><span>{index+1}</span><div><strong>{value}</strong><small>{label}</small></div></div>)}
    {terminalStageLabels[stage]&&<div className="workflow-path-step current terminal" role="listitem" aria-current="step"><span>!</span><div><strong>{stage}</strong><small>{terminalStageLabels[stage]}</small></div></div>}
  </div>;
}

export default async function OpportunityDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireSession();
  const context = await loadAuthorizationContext({ actorId:session.id,legacyRole:session.role });
  let opportunity;
  try { opportunity = await getOpportunity(context,id); } catch (error) { if (error instanceof OpportunityAccessError) notFound(); throw error; }
  const roleCodes = context.assignments.map((item)=>item.role);
  const [riskSignalResult,health,overrideGrant] = await Promise.all([
    listOpportunityRiskSignals(prisma,id)
      .then((signals)=>({signals,available:true as const}))
      .catch(()=>({signals:[],available:false as const})), getOpportunityHealth(context,id),
    roleCodes.length?prisma.rolePermissionGrant.count({where:{roleCode:{in:roleCodes},permissionCode:PERMISSIONS.opportunityProbabilityOverride}}):Promise.resolve(0),
  ]);
  const transitionStages = STAGES.filter(([stage]) => stage !== opportunity.stage).map(([value,label])=>({value,label}));
  const canEdit=permissionPolicy.allows(session,PERMISSIONS.recordUpdate),canOverride=permissionPolicy.allows(session,PERMISSIONS.opportunityProbabilityOverride)||overrideGrant>0;
  const signalViews=riskSignalResult.signals.map((signal)=>({id:signal.id,riskType:signal.riskType,ruleCode:signal.ruleVersion.rule.code,ruleVersion:signal.ruleVersion.version,thresholdSnapshot:jsonObject(signal.thresholdSnapshot),triggeringFacts:jsonObject(signal.triggeringFacts),severitySnapshot:jsonObject(signal.severitySnapshot),evaluatedAt:signal.evaluatedAt.toISOString()}));
  const probabilityHistory=opportunity.probabilityHistory.map((item)=>({id:item.id,previousProbability:item.previousProbability,newProbability:item.newProbability,reason:item.reason,changedByName:item.changedBy.name,changedAt:item.changedAt.toLocaleString("th-TH")}));
  const money=new Intl.NumberFormat("th-TH",{style:"currency",currency:opportunity.currency,minimumFractionDigits:2,maximumFractionDigits:2}).format(Number(opportunity.estimatedValue));
  return <>
    <div className="opportunity-hero"><div><p className="eyebrow">{opportunity.opportunityNumber??"Opportunity เดิม"} · {opportunity.flow}</p><h1>{opportunity.name}</h1><p><Link href={`/customers/${opportunity.customer.id}`}>{opportunity.customer.name}</Link> · เจ้าของ {opportunity.owner.name}</p></div><div className="actions"><Link className="secondary" href="/activities/new">เพิ่มกิจกรรม</Link>{opportunity.solutionDesign?<Link className="secondary" href={`/solution-designs/${opportunity.solutionDesign.id}`}>เปิด Solution Design</Link>:<Link className="secondary" href={`/solution-designs?opportunityId=${id}`}>สร้าง Solution Design</Link>}{canEdit&&<Link className="secondary" href={`/proposals/new?opportunityId=${id}`}>สร้าง Proposal</Link>}{canEdit&&<Link className="secondary" href={`/opportunities/${id}/edit`}><Pencil aria-hidden="true"/>แก้ไข</Link>}</div></div>
    <section className="opportunity-summary" aria-label="Opportunity summary"><div><span>Stage</span><strong><span className="badge">{opportunity.stage}</span></strong></div><div><span>Estimated revenue</span><strong>{money}</strong></div><div className="probability-summary"><span>Probability</span><strong>{opportunity.probability}%</strong><small>{opportunity.probabilitySource}</small>{canOverride&&<OpportunityProbabilityDialog opportunityId={id} version={opportunity.version} probability={opportunity.probability} history={probabilityHistory}/>}</div><div><span>Forecast</span><strong>{opportunity.forecastCategory}</strong></div><div><span>Expected close</span><strong>{opportunity.expectedCloseAt?.toLocaleDateString("th-TH")??"ยังไม่กำหนด"}</strong></div><div><span>Health</span><strong><span className={`health-chip ${health.category.toLowerCase()}`}>{health.score} · {healthLabels[health.category]}</span></strong></div></section>
    <section className="card opportunity-workflow-overview" id="workflow"><div className="card-header"><div><strong>Sales workflow</strong><small>ขั้นปัจจุบันเป็นสีเขียว และขั้นถัดไปเป็นสีเทา</small></div></div><div className="card-body"><OpportunityWorkflowPath stage={opportunity.stage}/><details className="workflow-history"><summary>ดูประวัติ Transition ({opportunity.stageHistory.length})</summary><div className="timeline-list">{opportunity.stageHistory.map((item)=><div className="timeline" key={item.id}><strong>{item.fromStage} → {item.toStage}</strong><p>{item.command}{item.reason?` · ${item.reason}`:""}</p><small>{item.transitionedAt.toLocaleString("th-TH")}</small></div>)}{!opportunity.stageHistory.length&&<p className="empty">ยังไม่มี transition history</p>}</div></details></div></section>
    <nav className="opportunity-tabs" aria-label="ส่วนข้อมูล Opportunity"><a href="#workflow">Workflow</a><a href="#overview">Overview</a><a href="#health">Health</a><a href="#requirements">Requirements</a><a href="#stakeholders">Stakeholders</a><a href="#competitors">Competitors</a></nav>
    <div className="opportunity-workspace" id="overview"><section className="card"><div className="card-header"><strong>Overview</strong></div><div className="card-body detail-grid"><div><p className="detail-label">Next action</p><p className="detail-value">{opportunity.nextAction??"ยังไม่กำหนด"}</p></div><div><p className="detail-label">Requirements</p><p className="detail-value" data-expandable-text>{opportunity.requirements??"ยังไม่มีข้อมูล"}</p></div><div><p className="detail-label">Stakeholders</p><p className="detail-value">{opportunity.stakeholderSummary??"ยังไม่มีข้อมูล"}</p></div><div><p className="detail-label">Qualification</p><p className="detail-value">{opportunity.qualificationResult??"ยังไม่มีข้อมูล"}</p></div></div></section><section className="card" id="health"><div className="card-header"><strong>Opportunity Health</strong><span className={`health-chip ${health.category.toLowerCase()}`}>{health.score}/100</span></div><div className="card-body health-explanation"><div><h3>Positive signals</h3><ul>{health.positives.length?health.positives.map((item)=><li key={item}>{item}</li>):<li>ยังไม่มีสัญญาณเชิงบวก</li>}</ul></div><div><h3>Risks</h3><ul>{health.risks.length?health.risks.map((item)=><li key={item}>{item}</li>):<li>ไม่พบความเสี่ยงสำคัญ</li>}</ul></div></div></section></div>
    <section className="related-information" aria-label="Opportunity related information">
      <section className="card" id="requirements"><div className="card-header"><div><strong>Pain Points &amp; Requirements</strong><small>{opportunity.painPoints.length} pain points · {opportunity.structuredRequirements.length} requirements</small></div></div><div className="card-body related-list">{opportunity.painPoints.map(item=><article key={item.id}><div><span className="badge muted">{item.category}</span><strong>{item.title}</strong></div><p data-expandable-text>{item.businessProblem}</p><small>{item.priority} · {item.status}{item.expectedOutcome?` · เป้าหมาย: ${item.expectedOutcome}`:""}</small></article>)}{opportunity.structuredRequirements.map(item=><article key={item.id}><div><span className="badge">{item.requirementNumber}</span><strong>{item.title}</strong>{item.mandatoryFlag&&<span className="required-mark">Required</span>}</div><p data-expandable-text>{item.description}</p><small>{item.requirementType} · {item.feasibilityStatus} · Risk {item.riskLevel}</small></article>)}{!opportunity.painPoints.length&&!opportunity.structuredRequirements.length&&<div className="compact-empty">ยังไม่มี Pain Point หรือ Requirement</div>}</div></section>
      <section className="card" id="stakeholders"><div className="card-header"><div><strong>Stakeholder Map</strong><small>Influence และระดับการสนับสนุน</small></div></div><div className="card-body stakeholder-map">{opportunity.stakeholders.map(item=><article key={item.id} className={`stakeholder-${item.supportLevel.toLowerCase()}`}><div><strong>{item.primaryContactFlag?"★ ":""}{item.name}</strong><span>{item.stakeholderRole}</span></div><p>{item.jobTitle??item.organization??"ไม่ระบุตำแหน่ง"}</p><small>Influence {item.influenceLevel} · Support {item.supportLevel}</small></article>)}{!opportunity.stakeholders.length&&<div className="compact-empty">ยังไม่มี Stakeholder</div>}</div></section>
      <section className="card" id="competitors"><div className="card-header"><div><strong>Competitors &amp; Win Strategy</strong><small>{opportunity.competitors.length} รายการ</small></div></div><div className="card-body related-list">{opportunity.competitors.map(item=><article key={item.id}><div><span className={`threat-dot ${item.threatLevel.toLowerCase()}`} aria-hidden="true"/><strong>{item.competitorName}</strong>{item.incumbentFlag&&<span className="badge muted">Incumbent</span>}</div><p data-expandable-text>{item.winStrategy??item.differentiation??"ยังไม่มีกลยุทธ์"}</p><small>Threat {item.threatLevel}{item.estimatedPrice?` · ${new Intl.NumberFormat("th-TH",{style:"currency",currency:opportunity.currency,minimumFractionDigits:2,maximumFractionDigits:2}).format(Number(item.estimatedPrice))}`:""}</small></article>)}{!opportunity.competitors.length&&<div className="compact-empty">ยังไม่มีข้อมูลคู่แข่ง</div>}</div></section>
    </section>
    {canEdit&&<OpportunityRelatedForms opportunityId={id}/>}
    {canEdit&&<section className="opportunity-transition" id="stage-transition"><OpportunityTransitionForm opportunityId={id} version={opportunity.version} stage={opportunity.stage} expectedCloseAt={opportunity.expectedCloseAt?.toISOString().slice(0,16)} stages={transitionStages}/></section>}
    <DealRiskPanel opportunityId={id} signals={signalViews} canRefresh={canEdit} canExplain={canEdit} riskPersistenceAvailable={riskSignalResult.available}/>
  </>;
}
