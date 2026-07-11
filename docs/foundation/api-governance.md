# API and OpenAPI Governance

| Metadata | Value |
|---|---|
| Status | In Review |
| Version | 0.1 |
| Owner | Application Architecture / QA |
| Requirements | NFR-004, SEC-002, INT-001 |
| Related | [ADR-004](adrs/ADR-004-rest-api-openapi.md), [API Design](../api-design.md) |

## Contract source and review

OpenAPI file is contract source Every operation declares operation ID, permission, request/response schemas, errors, pagination, idempotency/concurrency, data classification and audit behavior Contract changes require domain owner, security for sensitive scope and integration review for published interfaces

## Compatibility

- Add optional field/operation is compatible when semantics unchanged
- Required field, removal/rename/type/meaning change is breaking and requires new major version or migration window
- Deprecation records owner, usage evidence, replacement and sunset
- Unknown response fields must be tolerated; unknown request fields rejected by policy selected per endpoint

## Standard behavior

- `/api/v1`, JSON/UTF-8, ISO UTC timestamps, opaque IDs
- default limit 50/max 200, signed cursor tied to query shape
- `X-Correlation-Id`, `Idempotency-Key`, resource version/`If-Match`
- standardized 400/401/403/404/409/422/429/503 error envelope
- server-side permission filtering and field masking; no UI-only control
- write retries return original effect; conflicting idempotency payload returns 409

## CI gates

OpenAPI syntax/style lint, breaking-change detection, example validation, generated contract tests, authorization metadata completeness and secret/PII example scan Representative Customer, Opportunity, Quote and Approval contracts must pass before ADR acceptance

