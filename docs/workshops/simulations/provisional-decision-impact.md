# Provisional Decision Impact Analysis

> **SUPERSEDED BY APPROVED BASELINE 1.0**  
> Impact actions were applied on 2026-07-11; preserve this document as historical analysis.

| Metadata | Value |
|---|---|
| Status | Superseded — Applied to Approved Baseline 1.0 |
| Version | Simulation 0.1 |
| Owner | Product and Enterprise Architecture Working Group |
| Last updated | 2026-07-11 |
| Related documents | [Provisional Baseline](provisional-baseline-v1.md), [Requirements](../../product-requirements.md), [Decision Register](../decision-register.md), [Approved Backlog](../../foundation/foundation-backlog.md) |

## 1. Decision-to-requirement/risk mapping

| OD | Requirements affected | Risks mitigated | New/exposed risk | Validation |
|---|---|---|---|---|
| OD-001 | BR-001, FR-001/010/011, DATA-001/003, COMP-001 | R-02, R-07 | stewardship bottleneck, incorrect merge | VS-01 |
| OD-002 | FR-011, SEC-003, DATA-001/003, OPS-003, COMP-001/002 | R-04, R-07 | premature deletion, backup resurrection | VS-02 |
| OD-003 | BR-004, FR-006, FR-007, FR-012, SEC-002, COMP-001 | R-08 | unavailable committee, threshold misfit | VS-03–VS-06 |
| OD-004 | BR-005, FR-008, INT-001–004, OPS-002/004 | R-06, R-11 | manual rekey/adoption risk R-15 | VS-07–VS-08 |
| OD-005 | NFR-003, OPS-001/003/004, SEC-003 | R-01, R-13 | cost/capacity not yet confirmed | VS-09–VS-10 |
| OD-006 | BR-002/003, NFR-002, OPS-004 | R-12, R-15 | pilot selection bias/support capacity | VS-11–VS-12 |

## 2. Baseline document impact matrix

Baseline files remain unchanged until Steering Committee approval

| Document | Provisional updates if approved | Triggering OD | Owner | If actual decision differs |
|---|---|---|---|---|
| `product-requirements.md` | close OD-001–006; update assumptions, risks, gates and numeric acceptance | All | Product | reopen impacted requirements/acceptance |
| `system-architecture.md` | confirm no-live-integration topology, SLO/RPO/RTO and manual degradation | OD-004/005 | Architecture | revise adapter/deployment/capacity ADRs |
| `domain-model.md` | CustomerMerge/LegalHold/RetentionPolicy/ManualHandoff/ApprovalPolicy concepts | OD-001–004 | Domain Architecture | aggregates/events may change |
| `database-design.md` | external ID/merge history, legal hold, retention metadata and approval policy versions | OD-001–003 | Data Architecture | schema/migration design rework; no code yet |
| `api-design.md` | merge review, legal hold/delete dry-run, policy evaluation and manual handoff contracts | OD-001–004 | Application Architecture | version draft contract before implementation |
| `roles-and-permissions.md` | Data Steward, Commercial Committee, legal-hold/export and manual acknowledgement permissions | OD-001–004 | Security/Product | regenerate permission matrix/tests |
| `opportunity-workflow.md` | coverage exception routes and manual downstream handoff labels | OD-003/004 | Sales Operations | update gates/transitions |
| `approval-workflow.md` | 3 tiers, exception triggers, committee/delegation and SLA placeholders | OD-003 | Commercial | replace policy table/test vectors |
| `sales-forecast-design.md` | pilot metrics and duplicate/merge effects on rollups | OD-001/006 | Sales Analytics | revise quality/adoption metrics |
| `integration-design.md` | mark all year-one interfaces manual; define readiness gate for future live links | OD-004 | Integration | reprioritize adapter contracts/capacity |
| `implementation-roadmap.md` | classify adapter framework vs deferred live integrations; pilot timeline | OD-004/006 | Program/Product | rebaseline workstreams/milestones |
| `testing-strategy.md` | merge, retention, 3-tier policy, manual handoff, DR and pilot rollback scenarios | All | QA | update traceability/test datasets |

## 3. Safe foundations vs decision-coupled work

### Safe to start after normal governance

- Modular boundaries and dependency rules
- Stable internal/external identifier interfaces (not merge thresholds)
- Policy engine abstraction without active commercial values
- Outbox/inbox and adapter interfaces without live system binding
- Structured audit event contract
- Observability/test harness and MySQL 8 compatibility spike
- Retention classification metadata/dry-run interfaces without purge schedule

### Conditional

- Customer match scoring and steward queue UX
- Approval policy configuration and tier test vectors
- Manual handoff package fields and maker-checker
- HA/DR infrastructure sizing and runbook targets
- Pilot analytics, training and hypercare preparation

### Blocked until approval

- Activate merge execution or duplicate auto-resolution
- Activate retention purge/anonymization jobs
- Seed production approval amounts/discount/margin thresholds
- Sign/procure production SLO/DR topology based solely on simulation
- Provision pilot users or load production-shaped data
- Represent external systems as synchronized/live

## 4. Change-impact rules

| Actual decision change | Required response before implementation |
|---|---|
| Federated/no-merge customer governance | remove central merge execution; retain candidate flags and stable IDs; revise ownership/escalation |
| Different retention periods/classes | update lifecycle matrix, purge/archive tests, storage/capacity and legal evidence |
| Different approval tiers/triggers | replace configuration/test vectors; reassess role authority and SLA load |
| Live integration selected | approve SoT/contract/security/operations; add adapter-specific backlog and failure tests |
| Higher availability/lower RPO/RTO | re-run topology/cost/capacity ADR and operational staffing plan |
| Larger/multi-division pilot | re-run load/support/data readiness and authorization-scope plan |

## 5. Document update protocol after approval

1. Record approved decision and signatures in workshop register/minutes
2. Update Product Requirements first and increment version/history
3. Update architecture/domain/data/API/workflow/permissions documents
4. Update roadmap/testing and create requirement traceability matrix
5. Reclassify backlog stories; only approved + Definition-of-Ready stories enter implementation
6. Mark simulation pack superseded but preserve it as historical analysis
