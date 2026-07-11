# Private-Cloud Platform Evaluation Scorecard

| Metadata | Value |
|---|---|
| Status | Discovery Ready |
| Backlog | FND-013 / ADR-006–009, ADR-014–015 |
| Owner | Platform Architecture / IT Operations / Security |

## Scoring

Score 0–5 with evidence; weighted score alone cannot override a failed mandatory security/support requirement

| Criterion | Weight | RabbitMQ/Queue | OpenSearch/Search | Redis/Cache | S3/Object | Deployment/Observability |
|---|---:|---|---|---|---|---|
| Functional fit/use cases | 15 | — | — | — | — | — |
| HA/failover/backup | 15 | — | — | — | — | — |
| Security/TLS/RBAC/audit | 15 | — | — | — | — | — |
| Operations/monitoring/runbooks | 15 | — | — | — | — | — |
| Performance/capacity evidence | 10 | — | — | — | — | — |
| Support/version lifecycle | 10 | — | — | — | — | — |
| Team skills/maintainability | 10 | — | — | — | — | — |
| Cost/licensing/procurement | 10 | — | — | — | — | — |

## Mandatory evidence

Approved private-cloud availability, product/version/support owner, encryption/secrets integration, failure-domain topology, upgrade/rollback, capacity limits, data retention/backup, operational staffing and test environment

## Decision output

For each capability: selected product/version or `No Decision`, rejected alternatives/rationale, risks/actions, owner, ADR update and procurement dependency No installation/procurement is authorized by this scorecard

