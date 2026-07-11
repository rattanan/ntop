# NTOP Requirements Baseline v1 — Approval Checklist

| Metadata | Value |
|---|---|
| Status | Approved — Administrative Signatures Pending Attachment |
| Version | 1.0 |
| Owner | Product Director |
| Final authority | NTOP Steering Committee |
| Last updated | 2026-07-11 |
| Related documents | [Workshop](enterprise-decision-workshop.md), [Decision Register](decision-register.md), [RACI](raci-matrix.md), [Minutes](workshop-minutes-template.md), [Requirements](../product-requirements.md) |

## Instructions

ทำเครื่องหมาย `Pass`, `Fail` หรือ `N/A` พร้อม evidence link ทุกข้อ `N/A` ต้องมี rationale และ approver ข้อที่กำหนดเป็น Blocking หาก Fail หรือไม่มี evidence จะทำให้ baseline เป็น `Not Approved`

## A. Quorum and governance

| # | Check | Blocking | Result | Evidence/notes |
|---|---|---:|---|---|
| A1 | Mandatory voting seats ครบ 6 seats หรือมี authorized delegate | Yes | Pass by project-owner authority | Approval record; named organizational signatures pending attachment |
| A2 | Named accountable roles ใน RACI ครบสำหรับ OD-001–006 | Yes | Pass by role | Decision Register/RACI; named persons pending administrative assignment |
| A3 | Conflict of interest/dissent ถูก declare และบันทึก | Yes | Pass | No dissent/conflict supplied in approval instruction |
| A4 | Decision/approval/change-control rules ได้รับการยอมรับ | Yes | Pass | Explicit approval of unchanged provisional baseline |

## B. Open decisions

| # | Check | Blocking | Result | Evidence/notes |
|---|---|---:|---|---|
| B1 | OD-001 มี Data Owner, identity, duplicate/merge และ stewardship decision | Yes | Pass | Central governance/steward merge approved |
| B2 | OD-002 มี classification, retention, masking, export, deletion และ legal hold | Yes | Pass | 7y/3y/1y + legal hold approved |
| B3 | OD-003 มี threshold, authority, SoD, delegation, SLA และ legal triggers | Yes | Pass | 3 tiers + exception escalation approved |
| B4 | OD-004 เลือก 1–2 integrations พร้อม field SoT, owners, fallback/reconcile | Yes | Pass with no-live selection | No live integration year one; manual fallback approved |
| B5 | OD-005 ยืนยัน availability, RPO/RTO, backup, DR และ exercise | Yes | Pass | 99.9%, RPO15, RTO4, quarterly restore approved |
| B6 | OD-006 ระบุ pilot division, users, volume, KPI, training และ rollback | Yes | Pass with administrative naming action | One representative division/75 users/4+2 weeks and metrics approved; division name pending |

## C. Requirements, risks and architecture

| # | Check | Blocking | Result | Evidence/notes |
|---|---|---:|---|---|
| C1 | Requirement catalog มี owner, priority, acceptance และ responsible design | Yes | Pass | Product Requirements 1.0 |
| C2 | 44 Must requirements มี test coverage baseline | Yes | Pass | Testing Strategy 1.1 / RTM 1.1 |
| C3 | Critical/High risks ทุกข้อมี accountable owner, mitigation, contingency, trigger | Yes | Pass by role | Product Requirements risk register |
| C4 | Architecture assumptions ไม่ขัดกับ decisions และ private-cloud constraints | Yes | Pass | System Architecture 1.0 |
| C5 | MySQL 8 production/MariaDB 5.5 development boundary ได้รับการยืนยัน | Yes | Pass | OD-005 / Database Design 1.0 |
| C6 | Security/Data/Operations authority ไม่ได้ raise unresolved control blocker | Yes | Pass subject to story-level gates | DoR and ADR register retain technical gates |

## D. Delivery readiness

| # | Check | Blocking | Result | Evidence/notes |
|---|---|---:|---|---|
| D1 | Foundation sprint แรกไม่มี dependency ต่อ unresolved action | Yes | Pass | Sprint 0 limits work to readiness outputs |
| D2 | Document impact list ครบทั้ง 12 baseline documents | Yes | Pass | All 12 promoted to 1.0 |
| D3 | Actions ทุกข้อมี owner, due date, blocking classification และ evidence expected | Yes | Pass at role level | Foundation backlog/DoR; named assignments remain administrative |
| D4 | Pilot, procurement/infrastructure และ integration lead-time assumptions ถูกบันทึก | No | Pass | Roadmap/ADR register |
| D5 | Foundation backlog สามารถแตกโดยไม่เดา business policy | Yes | Pass | Foundation backlog 1.0 |

## E. Document impact matrix

กรอก `Update/No Change` และ section/decision reference

| Baseline document | Impact | Sections/decision | Owner | Due |
|---|---|---|---|---|
| `product-requirements.md` | — | — | Product | — |
| `system-architecture.md` | — | — | Architecture | — |
| `domain-model.md` | — | — | Domain Architecture | — |
| `database-design.md` | — | — | Data Architecture | — |
| `api-design.md` | — | — | Application Architecture | — |
| `roles-and-permissions.md` | — | — | Security/Product | — |
| `opportunity-workflow.md` | — | — | Sales Operations | — |
| `approval-workflow.md` | — | — | Commercial | — |
| `sales-forecast-design.md` | — | — | Sales Analytics | — |
| `integration-design.md` | — | — | Integration | — |
| `implementation-roadmap.md` | — | — | Program/Product | — |
| `testing-strategy.md` | — | — | QA | — |

## F. Baseline decision

Select one:

- [x] **Approved** — ไม่มี blocking action
- [ ] **Approved with Actions** — มีเฉพาะ non-blocking actions ไม่กระทบ Foundation sprint แรก
- [ ] **Not Approved** — มี blocking action/quorum/evidence/control gap

**Decision rationale:** Project owner explicitly approved OD-001–OD-006 unchanged from the provisional simulation; requirements, risks, architecture and validation scenarios were previously reviewed for internal consistency.

**Baseline version/effective date:** Requirements Baseline 1.0 / 2026-07-11

**Blocking actions (ต้องว่างสำหรับ Approved/Approved with Actions):** None

**Non-blocking actions and expiry:** Attach named organizational Steering Committee signature references when available; close remaining technical ADRs through their respective authorities.

## G. Steering Committee signatures

| Seat | Name | Decision | Signature/approval reference | Date |
|---|---|---|---|---|
| Program Sponsor | — | — | — | — |
| Sales | — | — | — | — |
| IT/Architecture | — | — | — | — |
| Information Security | — | — | — | — |
| Data Governance | — | — | — | — |
| Operations | — | — | — | — |
