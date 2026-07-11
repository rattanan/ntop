# NTOP Requirements Baseline v1 — Approval Checklist

| Metadata | Value |
|---|---|
| Status | Draft for Workshop |
| Version | 0.1 |
| Owner | Product Director |
| Final authority | NTOP Steering Committee |
| Last updated | 2026-07-11 |
| Related documents | [Workshop](enterprise-decision-workshop.md), [Decision Register](decision-register.md), [RACI](raci-matrix.md), [Minutes](workshop-minutes-template.md), [Requirements](../product-requirements.md) |

## Instructions

ทำเครื่องหมาย `Pass`, `Fail` หรือ `N/A` พร้อม evidence link ทุกข้อ `N/A` ต้องมี rationale และ approver ข้อที่กำหนดเป็น Blocking หาก Fail หรือไม่มี evidence จะทำให้ baseline เป็น `Not Approved`

## A. Quorum and governance

| # | Check | Blocking | Result | Evidence/notes |
|---|---|---:|---|---|
| A1 | Mandatory voting seats ครบ 6 seats หรือมี authorized delegate | Yes | — | — |
| A2 | Named accountable roles ใน RACI ครบสำหรับ OD-001–006 | Yes | — | — |
| A3 | Conflict of interest/dissent ถูก declare และบันทึก | Yes | — | — |
| A4 | Decision/approval/change-control rules ได้รับการยอมรับ | Yes | — | — |

## B. Open decisions

| # | Check | Blocking | Result | Evidence/notes |
|---|---|---:|---|---|
| B1 | OD-001 มี Data Owner, identity, duplicate/merge และ stewardship decision | Yes | — | — |
| B2 | OD-002 มี classification, retention, masking, export, deletion และ legal hold | Yes | — | — |
| B3 | OD-003 มี threshold, authority, SoD, delegation, SLA และ legal triggers | Yes | — | — |
| B4 | OD-004 เลือก 1–2 integrations พร้อม field SoT, owners, fallback/reconcile | Yes | — | — |
| B5 | OD-005 ยืนยัน availability, RPO/RTO, backup, DR และ exercise | Yes | — | — |
| B6 | OD-006 ระบุ pilot division, users, volume, KPI, training และ rollback | Yes | — | — |

## C. Requirements, risks and architecture

| # | Check | Blocking | Result | Evidence/notes |
|---|---|---:|---|---|
| C1 | Requirement catalog มี owner, priority, acceptance และ responsible design | Yes | — | — |
| C2 | 36 Must requirements มี test coverage baseline | Yes | — | — |
| C3 | Critical/High risks ทุกข้อมี accountable owner, mitigation, contingency, trigger | Yes | — | — |
| C4 | Architecture assumptions ไม่ขัดกับ decisions และ private-cloud constraints | Yes | — | — |
| C5 | MySQL 8 production/MariaDB 5.5 development boundary ได้รับการยืนยัน | Yes | — | — |
| C6 | Security/Data/Operations authority ไม่ได้ raise unresolved control blocker | Yes | — | — |

## D. Delivery readiness

| # | Check | Blocking | Result | Evidence/notes |
|---|---|---:|---|---|
| D1 | Foundation sprint แรกไม่มี dependency ต่อ unresolved action | Yes | — | — |
| D2 | Document impact list ครบทั้ง 12 baseline documents | Yes | — | — |
| D3 | Actions ทุกข้อมี owner, due date, blocking classification และ evidence expected | Yes | — | — |
| D4 | Pilot, procurement/infrastructure และ integration lead-time assumptions ถูกบันทึก | No | — | — |
| D5 | Foundation backlog สามารถแตกโดยไม่เดา business policy | Yes | — | — |

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

- [ ] **Approved** — ไม่มี blocking action
- [ ] **Approved with Actions** — มีเฉพาะ non-blocking actions ไม่กระทบ Foundation sprint แรก
- [ ] **Not Approved** — มี blocking action/quorum/evidence/control gap

**Decision rationale:**

**Baseline version/effective date:**

**Blocking actions (ต้องว่างสำหรับ Approved/Approved with Actions):**

**Non-blocking actions and expiry:**

## G. Steering Committee signatures

| Seat | Name | Decision | Signature/approval reference | Date |
|---|---|---|---|---|
| Program Sponsor | — | — | — | — |
| Sales | — | — | — | — |
| IT/Architecture | — | — | — | — |
| Information Security | — | — | — | — |
| Data Governance | — | — | — | — |
| Operations | — | — | — | — |

