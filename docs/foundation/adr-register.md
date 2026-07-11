# NTOP Architecture Decision Register

| Metadata | Value |
|---|---|
| Status | Approved Register — Individual ADRs Remain Proposed |
| Version | 1.0 |
| Owner | Enterprise Architecture |
| Last updated | 2026-07-11 |
| Related | [Architecture](../system-architecture.md), [Foundation Backlog](foundation-backlog.md), [Sprint 0](sprint-0-plan.md) |

## Status and ADR template

Statuses: `Proposed`, `In Review`, `Accepted`, `Rejected`, `Superseded` Only Architecture Board may mark technical ADR Accepted; business-policy decisions remain Steering Committee authority

Every ADR includes Context, Decision Drivers, Options, Evidence/Benchmark, Decision, Consequences, Security/Data/Operations impact, Rollback/Reversal, Requirements, Owners, Approval and Supersedes

## Register

| ADR | Topic | Provisional direction | Evidence required | Requirements/FND | Authority | Status |
|---|---|---|---|---|---|---|
| ADR-001 | Architecture style | Modular monolith with enforced boundaries | dependency model, team/deploy tradeoff | BR-002, FND-002/003 | Architecture Board | Proposed |
| ADR-002 | Production relational DB | MySQL 8 InnoDB Cluster | compatibility, HA, migration and support benchmark | DATA-002, OPS-003, FND-010/011 | Architecture + Operations | Proposed |
| ADR-003 | Internal ID format | sortable opaque UUIDv7/ULID candidate | index/storage/collision/pagination at scale | DATA-001, NFR-001, FND-012 | Data/Architecture | Proposed |
| ADR-004 | API style/versioning | REST `/api/v1` + OpenAPI | client/integration/governance tradeoff | NFR-004, FND-019 | Architecture Board | Proposed |
| ADR-005 | Async consistency | transactional outbox/inbox | failure/replay/atomicity spike | INT-003, OPS-002, FND-020 | Architecture Board | Proposed |
| ADR-006 | Queue product | RabbitMQ candidate | HA, DLQ, operations, security, throughput | OPS-002, FND-013/020 | Platform/Operations | Proposed |
| ADR-007 | Search product | OpenSearch candidate | 2.5M query/facet/index/rebuild benchmark | FR-010, DATA-002, FND-013/026/027 | Platform/Architecture | Proposed |
| ADR-008 | Cache/session product | Redis candidate | HA, session revocation, rate limit, operations | SEC-001, OPS-001, FND-013 | Platform/Security | Proposed |
| ADR-009 | Document storage | S3-compatible private object storage | encryption, malware scan, lifecycle, HA | SEC-003, FND-013 | Platform/Security | Proposed |
| ADR-010 | Authorization enforcement | scoped policy service/central contract | role×org×ownership performance and leakage tests | SEC-002, FND-006 | Security/Architecture | Proposed |
| ADR-011 | Audit integrity | append-only audit + tamper evidence | threat model, retention and query cost | COMP-001, FND-007 | Security/Audit | Proposed |
| ADR-012 | Policy configuration | versioned data-driven evaluator | reproducibility, cache/invalidation, SoD | BR-004, FR-007, FND-008 | Architecture; values by Steering | Proposed |
| ADR-013 | Customer matching | deterministic + scored candidates, no auto-merge | false-positive/negative dataset and recovery | DATA-003, FND-015 | Data Governance/Architecture | Proposed |
| ADR-014 | Deployment platform | Kubernetes vs managed VMs/private platform | team skill, HA, security, cost, support | OPS-001/003, FND-013/023 | IT Architecture/Operations | Proposed |
| ADR-015 | Observability stack | structured logs/metrics/traces | private-cloud products, retention, redaction | OPS-001/004, FND-022 | SRE/Security | Proposed |
| ADR-016 | Backup/DR topology | multi-failure-domain backups and rehearsed restore | BIA, RPO/RTO, site/network/cost | OPS-003, FND-023/024 | Operations + Steering OD-005 | Proposed |

## Decision sequence

1. ADR-001/002/004 establish architectural boundary and contracts
2. ADR-003/005/010/011/012 establish cross-cutting correctness
3. ADR-006–009/014/015 require product evaluation and private-cloud constraints
4. ADR-013 waits for OD-001 evidence; ADR-016 waits for OD-005 approval

No ADR may convert a simulated policy value into approved business policy
