# ADR Acceptance Checklist

| Metadata | Value |
|---|---|
| Status | Completed — Administrative Signatures Pending Attachment |
| Version | 0.1 |
| Owner | Architecture Board Secretary |
| Related | [Review Pack](architecture-review-pack.md), [Minutes](review-minutes-template.md) |

## Common checks

| Check | Blocking | Result | Evidence/action |
|---|---:|---|---|
| Context/problem and decision scope are unambiguous | Yes | — | — |
| Requirements, risks and owners are traced | Yes | — | — |
| At least two viable alternatives and status quo assessed | Yes | — | — |
| Security, data, operations, QA and cost consequences identified | Yes | — | — |
| Failure modes, rollback/reversal and migration path are credible | Yes | — | — |
| No contradiction with Requirements Baseline 1.0 | Yes | — | — |
| Evidence/benchmark plan is measurable and owned | Yes | — | — |
| Open technical decisions are explicit, not hidden assumptions | Yes | — | — |

## ADR-specific checks

### ADR-001

- [ ] module/table ownership complete
- [ ] forbidden dependencies/circularity enforcement defined
- [ ] cross-module transactions, events and reporting rules accepted
- [ ] future service extraction trigger and compatibility path defined

### ADR-002

- [ ] MySQL 8 support/topology/compatibility plan accepted
- [ ] TLS/accounts/secrets and migration workflow accepted
- [ ] 2.5M benchmark, failover and restore evidence plan accepted
- [ ] Data Architecture and IT Operations concurrence recorded

### ADR-004

- [ ] REST/OpenAPI options and interoperability rationale accepted
- [ ] authorization/field masking/error/idempotency/concurrency rules accepted
- [ ] compatibility/deprecation/contract CI governance accepted
- [ ] representative resource contracts identified

## Decision

| ADR | Result | Rationale | Blocking actions | Non-blocking actions | Approvers/reference |
|---|---|---|---|---|---|
| ADR-001 | Accepted | Modular monolith balances delivery and enforceable boundaries | None | Enforce dependency rules in implementation/CI | Project owner confirmation, 2026-07-11 |
| ADR-002 | Accepted | MySQL 8 InnoDB Cluster meets approved relational/HA direction | None to direction | Complete SKU/topology/failover/restore evidence | Project owner confirmation, 2026-07-11 |
| ADR-004 | Accepted | REST/OpenAPI provides governed shared contract | None | Produce representative contracts and CI gates | Project owner confirmation, 2026-07-11 |
