# Architecture Decision Acceptance Record — 2026-07-11

| Metadata | Value |
|---|---|
| Status | Accepted |
| Effective date | 2026-07-11 |
| Scope | ADR-001, ADR-002, ADR-004 |
| Acceptance source | Explicit project owner instruction in Codex task: “Accepted all” |
| Related | [ADR Register](../adr-register.md), [Checklist](adr-acceptance-checklist.md) |

## Accepted decisions

- **ADR-001:** Modular monolith with enforced module/table ownership, public contracts and controlled events
- **ADR-002:** MySQL 8 InnoDB Cluster as production transactional database; MariaDB 5.5 development compatibility only
- **ADR-004:** REST `/api/v1` with OpenAPI governance, idempotency, optimistic concurrency and scoped authorization

## Conditions that remain

Acceptance selects technical direction; it does not claim that implementation or operational evidence already exists. Stories must pass Definition of Ready. ADR-002 still requires approved product/version/topology, environment, migration, failover and restore evidence. ADR-004 still requires representative OpenAPI contracts and CI compatibility/security gates. ADR-001 requires implementation-time dependency enforcement.

## Signature limitation

No verified names or organizational signature references were provided. This repository records the project owner acceptance exactly as supplied and does not fabricate Architecture Board, Data, Security or Operations signatures. Those references may be attached later without changing the decision content/effective date.

