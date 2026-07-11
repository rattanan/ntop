# NTOP Governance RACI Matrix

| Metadata | Value |
|---|---|
| Status | Draft for Workshop |
| Version | 0.1 |
| Owner | Program Sponsor |
| Approver | NTOP Steering Committee |
| Last updated | 2026-07-11 |
| Related documents | [Workshop](enterprise-decision-workshop.md), [Decision Register](decision-register.md), [Roadmap](../implementation-roadmap.md), [Permissions](../roles-and-permissions.md) |

## Legend and rules

- **A — Accountable:** ผู้อนุมัติผลลัพธ์ มีหนึ่ง role ต่อ activity
- **R — Responsible:** ผู้จัดทำ/ดำเนินงาน มีได้หลาย role
- **C — Consulted:** ต้องให้ข้อมูล/ทบทวนก่อนตัดสิน
- **I — Informed:** รับทราบผล

หาก activity ไม่มี `A` หรือมีมากกว่าหนึ่ง `A` ถือว่ายังไม่พร้อมเริ่ม Named person และ delegate ต้องถูกกรอกก่อน Baseline approval

## Role abbreviations

| Code | Role |
|---|---|
| PS | Program Sponsor |
| PD | Product Director/Product Owner |
| SALES | Sales Business Owner |
| DATA | Customer Data Owner/Data Governance |
| SEC | Information Security |
| ARCH | Enterprise/Application/Data Architecture |
| COMM | Pricing/Commercial Owner |
| INT | Integration Governance/Architecture |
| OPS | IT/Service Operations/SRE |
| QA | QA and Quality Engineering |
| CHANGE | Change, Training and Adoption Lead |
| AUDIT | Internal Audit/Compliance |

## Decision and baseline RACI

| Activity | PS | PD | SALES | DATA | SEC | ARCH | COMM | INT | OPS | QA | CHANGE | AUDIT |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Product scope and outcomes | A | R | R | C | C | C | C | C | C | C | C | I |
| OD-001 Customer identity/merge | I | C | C | A/R | C | R | I | C | I | C | I | C |
| OD-002 Data lifecycle | I | C | C | A/R | R | C | I | C | R | C | I | C |
| OD-003 Commercial approval | I | C | R | C | C | C | A/R | I | C | C | I | C |
| OD-004 Integration priorities/SoT | I | C | C | C | C | C | I | A/R | R | C | I | I |
| OD-005 Availability/DR | I | I | C | C | C | R | I | C | A/R | C | I | I |
| OD-006 Pilot/adoption | I | R | A | C | C | I | C | C | R | C | R | I |
| Requirements Baseline v1 approval | A | R | R | R | R | R | R | R | R | C | C | C |
| Risk acceptance — business | A | R | R | C | C | C | C | C | C | I | I | I |
| Risk acceptance — security/data/ops | I | C | C | A* | A* | C | I | C | A* | I | I | C |

`A*` ใช้เฉพาะ risk ใน authority ของแต่ละ function; ต้องมี A เพียงหนึ่งรายต่อ risk record

## Delivery governance RACI

| Activity | PS | PD | SALES | DATA | SEC | ARCH | COMM | INT | OPS | QA | CHANGE | AUDIT |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Requirement change control | I | A/R | R | C | C | C | C | C | C | C | I | I |
| Architecture decisions | I | C | C | C | C | A/R | C | R | R | C | I | I |
| Data model/quality rules | I | C | C | A | C | R | I | C | C | R | I | C |
| Security controls/threat model | I | C | I | C | A/R | R | I | C | R | C | I | C |
| Commercial policy configuration | I | C | R | I | C | C | A/R | I | I | C | I | C |
| Integration contract/readiness | I | C | C | C | C | C | I | A/R | R | R | I | I |
| Test strategy/release evidence | I | C | C | C | C | C | C | C | R | A/R | I | C |
| Production readiness/go-live | A | R | R | R | R | R | R | R | R | R | R | C |
| Operations/runbooks/incident | I | I | C | I | C | C | I | C | A/R | R | I | I |
| Training/adoption/hypercare | I | C | A | I | I | I | C | I | R | C | R | I |

## Named-role confirmation

| Role code | Named accountable person | Delegate | Authority confirmed by | Date | Notes |
|---|---|---|---|---|---|
| PS | — | — | — | — | Required for quorum |
| PD | — | — | — | — | — |
| SALES | — | — | — | — | Required for quorum |
| DATA | — | — | — | — | Required for quorum |
| SEC | — | — | — | — | Required for quorum |
| ARCH | — | — | — | — | Required for quorum |
| COMM | — | — | — | — | Required for OD-003 |
| INT | — | — | — | — | Required for OD-004 |
| OPS | — | — | — | — | Required for quorum |
| QA | — | — | — | — | — |
| CHANGE | — | — | — | — | Required for OD-006 |
| AUDIT | — | — | — | — | — |

