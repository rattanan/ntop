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
| [ADR-001](adrs/ADR-001-modular-monolith.md) | Architecture style | Modular monolith with enforced boundaries | dependency model, team/deploy tradeoff | BR-002, FND-002/003 | Architecture Board | Accepted 2026-07-11 |
| [ADR-002](adrs/ADR-002-mysql8-innodb-cluster.md) | Production relational DB | MySQL 8 InnoDB Cluster | compatibility, HA, migration and support benchmark | DATA-002, OPS-003, FND-010/011 | Architecture + Operations | Accepted 2026-07-11 |
| ADR-003 | Internal ID format | sortable opaque UUIDv7/ULID candidate | index/storage/collision/pagination at scale | DATA-001, NFR-001, FND-012 | Data/Architecture | Proposed |
| [ADR-004](adrs/ADR-004-rest-api-openapi.md) | API style/versioning | REST `/api/v1` + OpenAPI | client/integration/governance tradeoff | NFR-004, FND-019 | Architecture Board | Accepted 2026-07-11 |
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
| [ADR-017](adrs/ADR-017-opportunity-single-contracting-customer.md) | Opportunity ownership boundary | one Contracting Customer per Opportunity; group related pursuits | domain consistency and forecast attribution | FR-004, FR-006, FR-008 | Product/Domain Architecture | Accepted 2026-07-11 |
| [ADR-018](adrs/ADR-018-quote-requires-opportunity.md) | Quote ownership boundary | every Quote belongs to one Opportunity and inherits Customer | pipeline, forecast and approval integrity | FR-006, FR-007 | Product/Domain Architecture | Accepted 2026-07-11 |
| [ADR-019](adrs/ADR-019-immutable-quote-versions.md) | Quote versioning | submitted Quote Versions are immutable; policy changes supersede approval | commercial evidence integrity | FR-006, FR-007, COMP-001 | Product/Commercial Architecture | Accepted 2026-07-11 |
| [ADR-020](adrs/ADR-020-forecast-amount-source.md) | Forecast amount source | estimated value until Primary Quote evidence exists; never sum alternatives | forecast explainability and no double count | BR-003, FR-009, DATA-004 | Sales/Product Architecture | Accepted 2026-07-11 |
| [ADR-021](adrs/ADR-021-ai-proposes-human-decides.md) | AI autonomy boundary | AI suggests/drafts; authorized human confirms all business mutations | AI safety, audit and commercial control | SEC-002, COMP-001, FR-002–009 | Product/Security Architecture | Accepted 2026-07-11 |
| [ADR-022](adrs/ADR-022-ai-data-boundary.md) | AI data boundary | least-privilege input scope, ACL-preserving retrieval and no secrets | customer/commercial data protection | SEC-002, SEC-003, COMP-001 | Security/Data Architecture | Accepted 2026-07-11 |
| [ADR-023](adrs/ADR-023-grounded-ai-source-conflicts.md) | AI grounding | cite sources, expose conflicts and abstain when evidence is insufficient | trustworthy customer research and recommendations | BR-001, DATA-003, COMP-001 | Product/Data Architecture | Accepted 2026-07-11 |
| [ADR-024](adrs/ADR-024-ai-confidence-calibration.md) | AI confidence | confidence bands until representative calibration; official values remain human-confirmed | prevent misleading forecast precision | BR-003, FR-009, DATA-004 | Product/AI Governance | Accepted 2026-07-11 |
| [ADR-025](adrs/ADR-025-long-documents-authored-outside-ntop.md) | Long-form documents | authored externally and uploaded as governed evidence | keep NTOP focused on sales control/workflow | FR-004, FR-006, COMP-001 | Product/Document Governance | Accepted 2026-07-11 |
| [ADR-026](adrs/ADR-026-ai-document-analysis-read-only.md) | AI document analysis | read-only, ACL-preserving, page/section-cited findings | useful TOR/proposal assistance without evidence mutation | SEC-002, SEC-003, COMP-001 | Product/Security/Document Governance | Accepted 2026-07-11 |
| [ADR-027](adrs/ADR-027-ai-capability-release-sequence.md) | AI rollout | phase capabilities by risk, data and evaluation readiness | prevent unsafe scope expansion | OPS-004, SEC-002, COMP-001 | Product/AI Governance | Accepted 2026-07-11 |
| [ADR-028](adrs/ADR-028-ai-meeting-capture-boundary.md) | AI meeting capture | explicit consented text/transcript/audio only; no ambient recording | privacy and trustworthy visit records | SEC-002, SEC-003, COMP-001 | Product/Security Governance | Accepted 2026-07-11 |
| [ADR-029](adrs/ADR-029-research-connector-deferred.md) | AI public research | server-side approved-source connector; deferred beyond Phase 1 | SSRF/source governance and Phase 1 scope | SEC-003, DATA-003, OPS-004 | Product/Security Architecture | Accepted 2026-07-11 |
| [ADR-030](adrs/ADR-030-ai-retention-feedback.md) | AI retention/feedback | minimize draft content, 30-day abandoned metadata, no training without approval | privacy and measurable quality | SEC-003, COMP-001, COMP-002 | Security/Data/AI Governance | Accepted 2026-07-11 |
| [ADR-031](adrs/ADR-031-ai-availability-operations.md) | AI availability | optional, async for long work, bounded retries/quotas and no public fallback | core workflow resilience | NFR-003, OPS-002, OPS-004 | SRE/Product/AI Architecture | Accepted 2026-07-11 |
| [ADR-032](adrs/ADR-032-simple-admin-managed-ai-provider.md) | AI provider configuration | simple Admin-managed OpenAI-compatible endpoint/model with manual fallback | operational simplicity | SEC-002, SEC-003, OPS-004 | Product/Security Architecture | Accepted 2026-07-11 |
| [ADR-033](adrs/ADR-033-encrypted-ai-key-storage.md) | AI secret storage | runtime key encrypted in DB using environment master key | simple Admin rotation without plaintext storage | SEC-003, COMP-001 | Security/Data Architecture | Accepted 2026-07-11 |
| [ADR-034](adrs/ADR-034-phase1-meeting-draft-fields.md) | Phase 1 Meeting AI | bounded draft fields only; no downstream business mutation | useful summary without scope/autonomy expansion | FR-003, SEC-002, COMP-001 | Product/Sales Operations | Accepted 2026-07-11 |
| [ADR-035](adrs/ADR-035-ai-next-action-confirmation.md) | AI Next Action | suggestion converts to one authorized task only after confirmation | actionable assistance without task spam | FR-003, SEC-002, NFR-004 | Product/Sales Operations | Accepted 2026-07-11 |
| [ADR-036](adrs/ADR-036-configurable-deal-risk-rules.md) | Deal risk rules | deterministic, versioned and Admin-configurable; AI explains only | transparent pipeline health without uncalibrated prediction | FR-009, DATA-004, COMP-001 | Product/Sales Operations | Accepted 2026-07-11 |

## Decision sequence

1. ADR-001/002/004 establish architectural boundary and contracts
2. ADR-003/005/010/011/012 establish cross-cutting correctness
3. ADR-006–009/014/015 require product evaluation and private-cloud constraints
4. ADR-013 waits for OD-001 evidence; ADR-016 waits for OD-005 approval

Business policy values in Requirements Baseline 1.0 are approved; ADRs determine technical realization and may not silently change those values
