# ADR-004: REST `/api/v1` with OpenAPI Governance

| Field | Value |
|---|---|
| Status | Accepted |
| Date | 2026-07-11 |
| Owners | Application Architecture |
| Authority | Architecture Board |
| Requirements | NFR-004, SEC-002, INT-001 |
| Backlog | FND-019 |
| Accepted | 2026-07-11 — project owner confirmation in Codex task |

## Context

UI, background workers และ future adapters ต้องใช้ authorization/validation/workflow rules ชุดเดียวกัน Prototype server actions อย่างเดียวไม่ใช่ stable enterprise contract

## Options

1. **REST `/api/v1` + OpenAPI (recommended):** broad interoperability and governance tooling
2. GraphQL: flexible client queries แต่ authorization/query-cost governance สูง
3. UI-only server actions: fastest locally แต่ไม่มี stable integration contract

## Proposed decision

Public application boundary ใช้ REST JSON under `/api/v1`; OpenAPI เป็น contract source Resource IDs opaque, cursor pagination, standardized errors, correlation IDs, idempotency keys และ optimistic concurrency UI อาจใช้ server-side adapters แต่ต้องเรียก application services/policies เดียวกับ API

## Consequences and controls

- Breaking semantic changes require new major API version
- CI lint, backward-compatibility and contract tests
- Field/filter/sort allowlist; sensitive serialization by permission policy
- External gateway/authentication and rate values remain separate technical decisions
- Reversal/new protocol ต้อง map to same application contracts ไม่ bypass governance

## Evidence required

- [API Governance](../api-governance.md) reviewed
- representative Customer/Opportunity/Quote contracts lint and compatibility tests defined

## Acceptance record

Accepted unchanged on 2026-07-11 by explicit project owner instruction (“Accepted all”). API gateway product, external authentication and rate values remain separate technical decisions.
