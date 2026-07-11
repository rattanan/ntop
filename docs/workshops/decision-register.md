# NTOP Decision Register — OD-001 to OD-006

| Metadata | Value |
|---|---|
| Status | Draft for Workshop |
| Version | 0.1 |
| Owner | Product Director |
| Approver | NTOP Steering Committee |
| Last updated | 2026-07-11 |
| Related documents | [Workshop Guide](enterprise-decision-workshop.md), [Requirements](../product-requirements.md), [Minutes](workshop-minutes-template.md), [Approval Checklist](baseline-approval-checklist.md) |

## Status model

`Proposed → Ready for Decision → Approved / Rejected / Action Required → Superseded`

Decision ID และประวัติเดิมห้ามลบ เมื่อเปลี่ยนผลให้สร้าง revision ใหม่และระบุ `Supersedes`

## Master register

| ID | Decision statement | Accountable owner | Due | Requirements/risks | Workshop status | Final option | Approved by |
|---|---|---|---|---|---|---|---|
| OD-001 | อนุมัติ Customer Data Owner, canonical identifiers, duplicate/merge และ stewardship | Data Governance Lead | Workshop day | BR-001, FR-001, DATA-001/003; R-02, R-07 | Proposed | — | — |
| OD-002 | อนุมัติ classification, retention, masking, export, deletion และ legal hold | Data Governance + Security | Workshop day | COMP-002, SEC-003, DATA-001/003; R-04, R-07 | Proposed | — | — |
| OD-003 | อนุมัติ commercial thresholds, authority, SoD, delegation, SLA และ legal triggers | Pricing/Commercial Owner | Workshop day | BR-004, FR-006/007, SEC-002, COMP-001; R-08 | Proposed | — | — |
| OD-004 | เลือก 1–2 integrations และอนุมัติ field-level source of truth/owners/fallback | Integration Governance | Workshop day | BR-005, INT-001–004; R-06, R-11 | Proposed | — | — |
| OD-005 | ยืนยัน availability, RPO/RTO, backup, DR topology และ exercise | IT Operations | Workshop day | NFR-003, OPS-001/003/004; R-13 | Proposed | — | — |
| OD-006 | อนุมัติ pilot division, users, data volume, adoption KPIs และ rollback | Sales Sponsor | Workshop day | BR-002/003, NFR-002; R-12, R-15 | Proposed | — | — |

## OD-001 — Customer ownership and identity

**Recommended default:** แต่งตั้ง enterprise Customer Data Owner; ใช้ NTOP internal stable ID แยกจาก external IDs; duplicate match แบบ deterministic + scored candidates; merge ต้อง steward approve และเก็บ aliases/history

| Option | Description | Benefits | Risks/costs |
|---|---|---|---|
| A — Central governance (recommended) | Enterprise owner + governed stewardship | consistent identity/merge, auditable | ต้องมีทีม steward และ SLA |
| B — Federated ownership | แต่ละ sales unit ตัดสิน duplicate/merge | local speed/context | inconsistent rules, cross-unit duplicates |
| C — No merge in year one | flag duplicates only | implementation ง่าย | Customer 360/forecast ยังซ้ำและ manual burden สูง |

**Evidence required:** current customer identifiers/sources, duplicate samples/rate, legal/tax identifier rules, organization ownership map, proposed steward capacity/SLA

**Decision record:**

- Selected option/rules:
- Named Customer Data Owner:
- Merge approver and override authority:
- Duplicate thresholds and manual review rule:
- Rationale:
- Dissent/risk acceptance:
- Impacted documents:
- Approvers/date:

## OD-002 — Data lifecycle

**Recommended default:** data-class matrix แยก retention และ access; legal hold override deletion; export audited; anonymization/delete ผ่าน governed workflow ไม่ใช่ direct SQL

| Option | Description | Benefits | Risks/costs |
|---|---|---|---|
| A — Class-based policy (recommended) | retention/masking per data class | least privilege, defensible | ต้องจัด classification และ owner |
| B — Single retention period | period เดียวทั้งระบบ | simple | over/under-retention และ compliance risk |
| C — Retain indefinitely | ไม่ลบข้อมูล | historical completeness | privacy, storage, legal exposure |

**Evidence required:** applicable policies/laws, legal hold process, existing retention schedule, data inventory/classification, export use cases, audit retention requirement

**Decision record:** classification levels; retention periods; masking/export/deletion rules; legal-hold owner; rationale; dissent; impacted docs; approvers/date

## OD-003 — Commercial approval

**Recommended default:** versioned configurable policy ใช้ total/discount/margin/risk triggers; maker-checker; no eligible approver = escalation ไม่ auto-approve; delegation time/scope limited

| Option | Description | Benefits | Risks/costs |
|---|---|---|---|
| A — Risk-based matrix (recommended) | multiple commercial triggers | protects margin/risk | policy/model ซับซ้อนขึ้น |
| B — Amount-only tiers | route ตาม quote total | เข้าใจง่าย | discount/margin exception อาจหลุด |
| C — Manager discretion | manager เลือก route | flexible | bypass/inconsistent evidence |

**Evidence required:** current delegation of authority, historical deal distribution, margin/discount policy, legal triggers, approver availability, desired SLA/escalation

**Decision record:** threshold table; authority roles; sequential/parallel steps; SoD/delegation; SLA/escalation; legal triggers; rationale; dissent; impacted docs; approvers/date

## OD-004 — Integration priorities

**Recommended default:** เลือกสูงสุด 2 interfaces ที่มี approved owner/contract และให้ manual fallback กับระบบที่เหลือ

| Option | Description | Benefits | Risks/costs |
|---|---|---|---|
| A — OM + Coverage/GIS (recommended hypothesis) | เชื่อม critical presales/handoff | ลด rekey ใน core workflow | readiness/API ยังต้องพิสูจน์ |
| B — CRM + OM | customer context + order | broad business visibility | source-of-truth conflict สูง |
| C — Manual handoff year one | adapter framework แต่ไม่มี live link | delivery risk ต่ำ | duplicate work/adoption risk |

**Evidence required:** API/interface specs, owners, environments, volume/SLA, authentication, field ownership, support model, failure/reconciliation capability

**Decision record:** selected systems; field-level SoT matrix; business/data/technical/ops owners; protocol/security; fallback/reconciliation; rationale; dissent; impacted docs; approvers/date

## OD-005 — Availability and recovery

**Recommended default:** 99.9% monthly excluding approved maintenance, RPO ≤15 minutes, RTO ≤4 hours, quarterly restore และ pre-go-live failover/DR exercise

| Option | Description | Benefits | Risks/costs |
|---|---|---|---|
| A — Business-critical HA (recommended) | 99.9%, RPO15/RTO4 | balanced resilience/cost | ต้องมี HA/operations maturity |
| B — Mission-critical | 99.95%+, lower RPO/RTO | stronger continuity | infrastructure/operations cost สูง |
| C — Business-hours | lower availability target | cost ต่ำ | sales/handoff downtime risk |

**Evidence required:** business impact analysis, private-cloud topology/capacity, backup capability, DR site/network, staffing/on-call, maintenance constraints

**Decision record:** SLO; exclusions; RPO/RTO; backup/restore; DR topology; exercise cadence; service owner; rationale; dissent; impacted docs; approvers/date

## OD-006 — Pilot and adoption

**Recommended default:** หนึ่ง enterprise-sales division, 50–100 named users, production-shaped but controlled dataset, 4-week pilot + 2-week hypercare พร้อม measurable exit/rollback

| Option | Description | Benefits | Risks/costs |
|---|---|---|---|
| A — One representative division (recommended) | cross-role controlled pilot | valid feedback, manageable | selection bias ต้องควบคุม |
| B — Multiple regions | broader proof | adoption evidence มาก | support/data complexity สูง |
| C — Internal alpha only | SMEs/test users | safe/fast | ไม่พิสูจน์ real adoption |

**Evidence required:** candidate division, named role counts, workload/data volume, current process baseline, training/support capacity, adoption measures, rollback feasibility

**Decision record:** division/sponsor; named/peak users; record volume; pilot dates; KPIs/targets; training/hypercare; rollback triggers; rationale; dissent; impacted docs; approvers/date

## Action log

| Action ID | Decision | Description/evidence required | Blocking? | Owner | Due date | Status | Closure evidence |
|---|---|---|---:|---|---|---|---|
| ACT-001 | — | — | — | — | — | Open | — |

