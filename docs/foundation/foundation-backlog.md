# NTOP Foundation Backlog

| Metadata | Value |
|---|---|
| Status | Approved Backlog — Story DoR Still Required |
| Version | 1.0 |
| Horizon | Months 1–2 Foundation |
| Owner | Product Director / Delivery Leads |
| Last updated | 2026-07-11 |
| Related documents | [Approved Requirements](../product-requirements.md), [RTM](requirements-traceability-matrix.md), [Roadmap](../implementation-roadmap.md), [Testing](../testing-strategy.md), [DoR](definition-of-ready-checklist.md) |

## 1. Classification and entry rules

- **Ready for DoR:** business decision dependency is approved; story still requires technical/security/test evidence and prerequisite completion
- **Conditional Technical Decision:** business baseline is approved but product/ADR/procurement or named-person evidence remains open
- **Blocked by Readiness Gate:** policy is approved but activation waits for safety, environment, data or pilot readiness evidence

ทุก story ต้องมี requirement IDs, owner role, dependencies, acceptance criteria, test/evidence และ classification ตามตาราง

## 2. Epic summary and sequencing

| Epic | Outcome | Sequence | Classification |
|---|---|---:|---|
| E01 Governance & ADR | approved ways of working and architecture decisions | 1 | Safe to Start |
| E02 Modular Architecture | enforceable application/domain boundaries | 2 | Safe to Start |
| E03 Identity & Authorization | local identity/MFA/scoped policy design | 2 | Ready for DoR |
| E04 Audit & Policy | immutable audit and server-side policy contracts | 2 | Safe to Start |
| E05 MySQL 8 Foundation | supported target environment/migration controls | 2 | Safe to Start |
| E06 Platform Services | evaluate Redis/RabbitMQ/OpenSearch/object storage | 2 | Conditional Technical Decision |
| E07 Customer Identity | internal/external ID, ownership and merge design | 3 | Ready for DoR |
| E08 Data Lifecycle | classification/legal-hold/retention controls | 3 | Ready design / activation gated |
| E09 API Contracts | `/api/v1`, errors, pagination, idempotency/versioning | 3 | Safe to Start |
| E10 Async Foundation | outbox/inbox/jobs/adapter ports | 3 | Safe to Start |
| E11 Operations & DR | telemetry, backup/restore/failure runbooks | 3 | Ready design / procurement gated |
| E12 Quality Gates | automated tests, security and traceability | continuous | Safe to Start |

## 3. Story backlog

| ID | Story/outcome | Owner role | Dependencies | Acceptance criteria/evidence | Class |
|---|---|---|---|---|---|
| FND-001 | Baseline governance, change control and decision records | Product Director | Workshop authority | templates/version rules/approval path reviewed; no simulated decision marked approved | Safe to Start |
| FND-002 | ADR set for modular monolith, REST, MySQL8, search, queue, cache, object storage | Enterprise Architecture | FND-001 | each ADR has context/options/decision/status/consequences; product-specific choices may remain proposed | Safe to Start |
| FND-003 | Define module dependency map and forbidden cross-module writes | Application Architecture | FND-002 | Customer/Sales/Presales/Commercial/Order/Integration/Audit boundaries mapped and statically enforceable design documented | Safe to Start |
| FND-004 | Define identity-provider abstraction and stable user subject | Security Architecture | FND-001/003 | local provider and future SSO map without changing domain user ID; threat review complete | Safe to Start |
| FND-005 | Define MFA, lockout, session revocation and JML policy | Security/Product | FND-004 | policy values/privileged roles approved; negative scenarios specified | Ready for DoR |
| FND-006 | Define scoped authorization policy model | Security/Product | FND-003/004 | role × org × ownership × workflow contract; deny-by-default and 404 behavior testable | Safe to Start |
| FND-007 | Define append-only audit event and redaction contract | Security/Audit | FND-003/006 | actor/action/target/version/reason/correlation; sensitive fields redacted; tamper-evidence ADR | Safe to Start |
| FND-008 | Define configurable commercial policy engine interface | Commercial/Application Architecture | FND-003/007 | policy/version/snapshot/decision interfaces support 3+ arbitrary tiers without hard-coded values | Safe to Start |
| FND-009 | Configure approved 3-tier approval policy | Commercial Owner | FND-008, security/test review | approved thresholds/authority/SoD test vectors pass; values stored as versioned configuration | Ready for DoR |
| FND-010 | Provision representative MySQL 8 integration test environment | Platform/DBA | FND-002, environment approval | cluster/client compatibility, TLS, least privilege and connectivity evidence | Safe to Start |
| FND-011 | Establish forward-only expand/backfill/verify/contract migration workflow | Data Architecture/DBA | FND-010 | sample migration supports backward compatibility and rollback procedure; no production data | Safe to Start |
| FND-012 | Benchmark sortable opaque ID candidates and select via ADR | Data/Application Architecture | FND-010 | collision/storage/index/pagination evidence at synthetic scale; decision recorded | Safe to Start |
| FND-013 | Evaluate Redis, RabbitMQ, OpenSearch and S3-compatible products | Platform/Architecture | procurement constraints | capability/HA/security/operations/cost matrix and recommendation; no procurement commitment | Conditional Technical Decision |
| FND-014 | Define Customer internal/external ID and ownership-history schema contract | Customer/Data Architecture | FND-003/012 | stable ID, source uniqueness, effective ownership and audit invariants documented/test vectors | Safe to Start |
| FND-015 | Define duplicate scoring, stewardship queue and merge recovery | Customer Data Owner | FND-014 | thresholds/authority/recovery/cross-unit escalation accepted with false-positive test set | Ready for DoR |
| FND-016 | Implement/activate customer merge execution | Customer/Data Team | FND-015, data/security readiness | approved merge/reversal/reconciliation/security tests pass | Blocked by Readiness Gate |
| FND-017 | Define data classification, legal-hold and lifecycle interfaces | Data Governance/Security | FND-007/014 | tags, hold state, dry-run and audit behavior independent of numeric periods | Safe to Start |
| FND-018 | Configure and activate retention/purge schedules | Data Operations | FND-017, backup/legal-hold readiness | approved 7y/3y/1y values; backup/legal-hold tests pass | Blocked by Readiness Gate |
| FND-019 | Publish `/api/v1` conventions and OpenAPI governance | Application Architecture | FND-003/006 | cursor/filter/error/idempotency/version rules lintable; contract review complete | Safe to Start |
| FND-020 | Define background job, outbox and inbox contracts | Integration/Application Architecture | FND-007/010/019 | atomic outbox, inbox dedupe, lease/retry/DLQ/replay test scenarios documented | Safe to Start |
| FND-021 | Define canonical adapter and manual handoff package contract | Integration/Order Operations | FND-019/020 | version/checksum/external ref/maker-checker/reconcile contract; explicitly not live sync | Ready for DoR |
| FND-022 | Define structured logs, metrics, traces and SLO signals | SRE/Architecture | FND-003/007 | API/DB/queue/search/adapter/audit dashboards and redaction requirements mapped | Safe to Start |
| FND-023 | Design backup/restore/failover/DR runbooks and exercise plan | SRE/DBA | FND-010/022 | topology and resource plan demonstrate approved RPO/RTO; owners/escalations named | Ready for DoR |
| FND-024 | Commit production HA/DR capacity/procurement | IT Operations | FND-023, ADR-014/016, procurement approval | signed SLO, capacity/cost and DR-site approval | Conditional Technical Decision |
| FND-025 | Establish CI quality pipeline and requirement trace format | QA/DevSecOps | FND-001/019 | lint/type/unit/integration/contract/security stages and immutable evidence format defined | Safe to Start |
| FND-026 | Build synthetic 2.5M-customer data generator design/test profile | QA/Data | FND-014, data policy | no real PII; realistic skew/hierarchy; deterministic seeds and volume manifest | Safe to Start |
| FND-027 | Define performance workload and environment acceptance | Performance QA/SRE | FND-010/013/026 | 100 concurrent +30% headroom workload, p95/error/resource thresholds mapped | Safe to Start |
| FND-028 | Define pilot telemetry, training and rollback runbook | Product/Change/SRE | FND-022/025 | approved user count/KPIs/rollback and hypercare ownership; named division recorded | Ready for DoR |
| FND-029 | Provision pilot users and production-shaped dataset | Product/Security/Data | named division, data/security/training readiness | authorization/data/security/training checks signed | Blocked by Readiness Gate |
| FND-030 | Threat model foundation architecture and critical workflows | Security Architecture | FND-003–008/019–022 | threats/controls/owners/tests recorded; Critical gaps block next phase | Safe to Start |

## 4. Proposed M1–M2 ordering

- **Weeks 1–2:** FND-001–004, FND-007, FND-010, FND-019, FND-025
- **Weeks 3–4:** FND-003/006/008/011/012/014/017/020/022/030
- **Weeks 5–6:** FND-013/015/021/023/026/027 after each story passes DoR
- **Weeks 7–8:** close ADR/evidence, rehearse quality gates and prepare readiness-gated activation stories

Readiness-gated stories FND-016/018/029 and technical-decision story FND-024 are excluded from sprint commitment until their stated evidence exists

## 5. Definition of Ready

A story enters implementation only when requirement IDs, owner, acceptance criteria, dependencies, security/data classification, API/domain impact, observability, test approach, rollout/rollback and decision/ADR evidence are complete. `Conditional Technical Decision` and `Blocked by Readiness Gate` cannot enter implementation sprint.

## 6. Backlog acceptance

- All 12 epics represented
- Every story has owner role, dependencies, testable acceptance and classification
- Approved values appear only as versioned configuration and test vectors, never hard-coded domain logic
- Critical security/data/approval/DR work has explicit gate
- Foundation outputs enable Customer phase without embedding unapproved business policy
