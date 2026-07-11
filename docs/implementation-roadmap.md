# NTOP 12-Month Implementation Roadmap

| Metadata | Value |
|---|---|
| Status | Draft for Review |
| Version | 0.1 |
| Owner | Program Sponsor / Product Director |
| Reviewers | Business Owners, Architecture, Security, Data, Operations, Delivery Leads, QA |
| Last Updated | 2026-07-11 |
| Related Documents | [Requirements](product-requirements.md), [Architecture](system-architecture.md), [Integration](integration-design.md), [Testing](testing-strategy.md), [Historical Roadmap](nt-salesforce-roadmap.md) |
| Assumptions | Enterprise team; 12 months; private cloud; phased production rollout; no full migration before gates |
| Open Decisions | Budget/team names; pilot unit; integration priorities; procurement lead times; release calendar |

## 1. Delivery model

Workstreams: Product/Change, Platform/SRE, Customer/Data, Sales/Forecast, Presales/Commercial, Integration, Security, QA/Automation ทีมใช้ shared architecture/security/data governance และ empowered Product Owner Scope control ยึด Must requirements; Should/Could ไม่กระทบ critical path (R-12)

## 2. Phases and gates

| Timeline | Outcomes | Requirement groups | Measurable exit gate |
|---|---|---|---|
| M1–M2 Foundation | approve process/requirements/ADRs; provision dev/test MySQL8, Redis, RabbitMQ, OpenSearch, object storage, observability; CI/CD/security baseline | SEC-*, OPS-*, DATA-001/002 | architecture/security/data/ops sign-off; HA topology and test pipeline operational |
| M3–M4 Customer Foundation | Customer 360, hierarchy/contact/ownership, scoped access, search, saved filters, staged bulk jobs | BR-001, FR-001, FR-010/011, NFR-001/002, DATA-003 | 2.5M/100-user benchmark; authorization and import reconciliation pass |
| M5–M6 Sales Execution | Lead, Activity, Opportunity workflow, dashboards, forecast snapshots/quality | BR-002/003, FR-002–004/009 | selected pilot completes lead→opportunity; formula/audit/UAT pass |
| M7–M8 Commercial | Product, Coverage, Solution, Quote versions, policy approval, notifications | BR-004, FR-005–007/012 | coverage→approved quote passes; no approval bypass in negative tests |
| M9–M10 Order & Integration | Internal Order, handoff, 1–2 approved adapters, reconciliation/manual fallback | BR-005, FR-008, INT-* | normal/outage/replay/reconcile scenarios pass; external owners accept |
| M11–M12 Production Readiness | hardening, DR/load/security/UAT, training, phased rollout, hypercare | All Must | production acceptance evidence and executive go-live approval |

Full production customer migration ถูก defer จน Customer gate + Production gate ผ่านและ OD-001/002 ได้รับอนุมัติ

## 3. Milestones and dependencies

- Architecture/data/security decisions ต้องปิดก่อน schema/API implementation
- Private-cloud procurement/provisioning เริ่ม M1; หากช้ากว่า M2 trigger R-13 และ rebaseline
- Customer/identity policy foundation มาก่อน sales modules
- Opportunity gates มาก่อน Quote/Approval; approval มาก่อน Order
- Integration implementation เริ่มหลัง contract checklist sign-off แต่ adapter framework เริ่ม Foundation
- Performance/security automation เริ่ม M1 ไม่รอปลายโครงการ

## 4. Team topology

- Product Director + domain Product Owners (Customer, Sales, Commercial)
- Architecture: enterprise/application/data/integration/security
- 3–4 cross-functional squads: Customer Platform, Sales, Commercial/Order, Integration/Platform
- Shared SRE/DBA, QA automation/performance, UX research/design, Data Governance และ Change/Training
- Named business SMEs สำหรับ KAM, Presales, Coverage, Pricing และ Order Operations

จำนวนคนจริงและ vendor/internal split เป็น Open Decision แต่ห้ามเริ่มทุก workstream หากไม่มี accountable owner

## 5. Definition of Ready / Done

**Ready:** requirement ID/acceptance, owner, UX/process, domain/API impact, data classification, permission, observability, test approach, dependency และ rollout identified

**Done:** code/contract reviewed, migrations backward compatible, unit/integration/contract/E2E evidence, security/permission tests, telemetry/runbook, documentation, UAT where required, feature flag/rollback และ no unresolved Critical defect

## 6. Governance gates

- Fortnightly product demo/risk review; monthly architecture/security/data review
- Phase gate requires signed evidence ไม่ใช้เปอร์เซ็นต์ completion
- Change control: new Must item ต้องระบุ displaced scope/time/cost
- Critical/High risk owner update trigger/mitigation ทุก review
- Open Decisions มี due date ก่อน dependent sprint; overdue decision escalates Sponsor

## 7. Rollout

Internal alpha → selected enterprise-sales pilot → phased organization units → wider rollout แต่ละ wave มี data readiness, training, support, usage metrics, rollback criteria และ 2–4 week hypercare Shadow spreadsheet ถูกติดตามเป็น adoption signal (R-15)

## 8. Business acceptance gates

ใช้ 6 gates ใน [product-requirements.md](product-requirements.md) โดย Production gate ต้องมี UAT ทุก critical role, penetration/security approval, 2.5M/100-user capacity evidence, failover/restore/DR, integration fallback, support/on-call, training และ executive approval

