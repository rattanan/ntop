# NTOP Requirements Traceability Matrix

| Metadata | Value |
|---|---|
| Status | Approved Baseline |
| Version | 1.1 |
| Owner | Product Owner / QA Lead |
| Last updated | 2026-07-11 |
| Source | [Product Requirements](../product-requirements.md) |
| Related | [Foundation Backlog](foundation-backlog.md), [ADR Register](adr-register.md), [Validation Scenarios](../workshops/simulations/simulation-validation-scenarios.md), [Sprint 0](sprint-0-plan.md) |

## Traceability rules

- `Design` อ้างเอกสาร baseline ที่รับผิดชอบ requirement
- `Foundation` อ้าง FND stories ที่สร้าง enabling control; ไม่ได้หมายความว่า feature เสร็จใน M1–M2
- `Evidence` เป็น test/review output ที่ต้องมีเมื่อเข้าสู่ phase ที่เกี่ยวข้อง
- `Gate` ระบุ decision หรือ phase gate ที่ห้ามข้าม
- Requirement ที่ไม่มี implementation story ใน Foundation ต้องมี planned phase และไม่ถือว่า gap หาก enabling control ชัดเจน

## Matrix

| Requirement | Design | Foundation enabler | Planned delivery | Evidence | Gate/status |
|---|---|---|---|---|---|
| BR-001 Customer 360 | Domain, Database, API | FND-014–017, FND-019 | Customer M3–M4 | customer/merge/search UAT, VS-01 | OD-001 approved; readiness gates apply |
| BR-002 Lead-to-order | Domain, Opportunity, Approval | FND-003, 006–008, 019–021 | Sales/Commercial M5–M10 | critical E2E/UAT | phase gates |
| BR-003 Forecast | Forecast, Database | FND-014, 022, 025–027 | Sales M5–M6 | formula/snapshot/load tests | Sales gate |
| BR-004 Approval evidence | Approval, Permissions | FND-007–009, 025, 030 | Commercial M7–M8 | VS-03–06, SoD/audit tests | OD-003 approved |
| BR-005 Manual fallback | Integration, Order | FND-020–023 | Order M9–M10 | VS-07–10 | OD-004/005 |
| FR-001 Customer hierarchy/identity | Domain, Database, API | FND-012, 014–017 | Customer M3–M4 | identity/hierarchy/merge tests | OD-001 |
| FR-002 Lead | Domain, API | FND-003, 006, 007, 019 | Sales M5–M6 | conversion/idempotency E2E | Sales gate |
| FR-003 Activity | Domain, API | FND-003, 006, 007, 019 | Sales M5–M6 | scope/overdue tests | Sales gate |
| FR-004 Opportunity | Opportunity, Domain | FND-003, 006–008, 019 | Sales M5–M6 | transition matrix E2E | Sales gate |
| FR-005 Product/Coverage/Solution | Domain, Opportunity | FND-003, 006–008, 019–021 | Commercial M7–M8 | gate/technical evidence tests | Commercial gate |
| FR-006 Versioned Quote | Domain, API, Database | FND-007–009, 019 | Commercial M7–M8 | totals/version/idempotency | OD-003 |
| FR-007 Approval routing | Approval, Permissions | FND-006–009, 025, 030 | Commercial M7–M8 | VS-03–06, authority negatives | approved values; configuration/test gate |
| FR-008 Internal Order | Domain, Integration | FND-007, 019–021 | Order M9–M10 | VS-07/08 | OD-004 |
| FR-009 Forecast | Forecast | FND-022, 025–027 | Sales M5–M6 | snapshot/rollup vectors | Sales gate |
| FR-010 Search/pagination | Architecture, Database, API | FND-012–014, 019, 026/027 | Customer M3–M4 | 2.5M benchmark | Customer gate |
| FR-011 Bulk jobs | Database, API, Integration | FND-017, 019/020, 025–027 | Customer M3–M4 | preview/retry/reconcile | OD-002 |
| FR-012 Notifications | Architecture, API | FND-020, 022, 025 | Commercial M7–M8 | dedupe/SLA tests | Ops readiness |
| NFR-001 2.5M scale | Architecture, Database, Testing | FND-010–014, 026/027 | Foundation + Customer | load/query-plan evidence | Customer gate |
| NFR-002 100 concurrent +30% | Architecture, Testing | FND-013, 022, 026/027 | Foundation + Production | workload/error/headroom report | Capacity gate |
| NFR-003 99.9%/degradation | Architecture, Testing | FND-022–024 | Foundation + Production | VS-09/10, failover/DR | OD-005 |
| NFR-004 Idempotency/concurrency | API, Integration | FND-019/020, 025 | all phases | duplicate/stale-update contracts | API gate |
| SEC-001 Local auth/MFA | Permissions, Architecture | FND-004/005, 025, 030 | Foundation | MFA/lockout/session negatives | OD/security approval |
| SEC-002 Scoped authorization | Permissions, API | FND-006–009, 019, 025/030 | Foundation + all modules | role×scope matrix | Security gate |
| SEC-003 Encryption/secrets | Architecture, Database, Integration | FND-010, 013, 022–025, 030 | Foundation | config/secret/TLS evidence | Security gate |
| DATA-001 Stable IDs/history | Domain, Database | FND-012, 014–017 | Foundation + Customer | VS-01, history invariants | OD-001 |
| DATA-002 MySQL SoT/search projection | Architecture, Database | FND-002, 010–013, 020, 026/027 | Foundation + Customer | rebuild/reconcile/load | Platform ADR |
| DATA-003 Data quality/lineage | Requirements, Database | FND-014–018, 025/026 | Customer | import/reject/reconcile | OD-001/002 |
| DATA-004 Immutable forecast | Forecast, Database | FND-007, 011, 025 | Sales M5–M6 | reproducibility test | Sales gate |
| INT-001 Versioned adapters/fallback | Integration, API | FND-019–021 | Foundation + Order | VS-07/08 | OD-004 |
| INT-002 SoT/field ownership | Integration | FND-001/002, 021 | future live integration | signed contract checklist | Steering approval |
| INT-003 Outbox/inbox/retry/DLQ | Architecture, Integration | FND-020, 025 | Foundation | duplicate/replay/failure tests | Integration gate |
| INT-004 Reconciliation/ownership | Integration | FND-020–023 | Foundation + Order | VS-08, reconcile rehearsal | Ops approval |
| OPS-001 Private cloud/observability | Architecture | FND-002, 010, 013, 022–024 | Foundation | readiness/capacity review | Platform ADR/OD-005 |
| OPS-002 Queue workers | Architecture, Integration | FND-013, 020, 022 | Foundation | backlog/retry/scale tests | Platform ADR |
| OPS-003 Backup/restore/DR | Architecture, Database, Testing | FND-010/011, 022–024 | Foundation + Production | VS-09/10 | OD-005 approved; ADR/procurement gate |
| OPS-004 Runbook/release/support | Roadmap, Testing | FND-001, 022–025, 028 | all phases | operational rehearsal | Production gate |
| COMP-001 Append-only audit | Permissions, Database | FND-007–009, 025/030 | Foundation + all modules | tamper/audit completeness | Security/Audit gate |
| COMP-002 Lifecycle approval | Requirements, Database | FND-017/018, 025 | Foundation + Customer | VS-02, policy evidence | OD-002 approved; safety gate |
| FR-013 AI provider administration | AI Design, Permissions | new AI foundation backlog | Foundation/M3–M4 | admin/auth/encryption/test-connection tests | AI security DoR |
| FR-014 Meeting Draft | AI Design, Activity | new AI Release 1 backlog | Sales M5–M6 | strict-schema/input-boundary/human-confirmation tests | AI Release 1 gate |
| FR-015 AI Next Action | AI Design, Activity | new AI Release 1 backlog | Sales M5–M6 | idempotency/owner/timezone/audit tests | AI Release 1 gate |
| FR-016 Deal Risk | AI Design, Forecast | new AI Release 1 backlog | Sales M5–M6 | deterministic rule/config/history tests | AI Release 1 gate |
| NFR-005 AI optional resilience | AI Design, Architecture | new AI foundation backlog | Foundation/M5–M6 | outage/circuit/manual-fallback tests | Operations gate |
| SEC-004 AI least privilege/autonomy | AI Design, Permissions | new AI foundation backlog | Foundation/all AI | authorization/secret/autonomy negative tests | Security gate |
| DATA-005 AI provenance/retention | AI Design, Database | new AI foundation backlog | Foundation/all AI | provenance/purge/no-raw-prompt tests | Data Governance gate |
| OPS-005 AI operations | AI Design, Architecture | new AI foundation backlog | Foundation/all AI | quota/retry/feature-flag/telemetry tests | Operations gate |

## Coverage summary

- 46/46 requirements mapped to design, foundation enabler, delivery phase, evidence and gate
- OD-001–OD-006 are approved; implementation still requires story-level DoR, ADR and safety/readiness evidence
- Release traceability must replace FND ranges with actual story/test/ADR IDs and evidence links as work is implemented
