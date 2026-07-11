# NTOP Foundation Telemetry Catalog

| Metadata | Value |
|---|---|
| Status | Discovery Ready |
| Backlog | FND-022 / ADR-015 |
| Owner | SRE / Architecture / Security |
| Requirements | OPS-001, OPS-004, NFR-003 |

## Common dimensions

Environment, service/module, version, route/operation, outcome/error code, organization scope only when non-sensitive, correlation/request/job/event ID No password/token/document body or raw PII

| Signal | Metrics/logs/traces | Draft alert/SLO use | Owner |
|---|---|---|---|
| API | rate, p50/p95/p99, errors, saturation, trace | latency/error budget | App/SRE |
| MySQL | cluster state, pool, query latency, locks, storage, backup/binlog | failover/RPO/capacity | DBA/SRE |
| Queue/outbox | depth, oldest age, retry, DLQ, outbox lag | backlog/lost-work risk | Integration/SRE |
| Search | query/index latency, rejection, indexing lag, reconcile mismatch | freshness/degradation | Search/SRE |
| Cache/session | hit ratio, memory/eviction, revocation error | auth/performance | Security/SRE |
| Object/document | upload/scan/access/error/storage | malware/access/lifecycle | Document Ops |
| Authorization | allow/deny counts, policy latency, cross-scope probes | leakage/abuse | Security |
| Audit | append failure, coverage gap, integrity mismatch | compliance/tamper | Audit/Security |
| Jobs/integration | status/age/retry/reconcile/manual SLA | operational handoff | Operations |

## Requirements

- structured schema/version and redaction tests
- dashboard links to runbook/owner; alert includes severity and correlation context
- retention: security/technical logs 1 year under approved policy; high-volume metrics retention remains technical decision
- telemetry outage must not silently permit business/audit bypass
- output feeds ADR-015 and operational readiness; does not select tooling

