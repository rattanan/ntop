# NTOP API Design

| Metadata | Value |
|---|---|
| Status | Approved Baseline |
| Version | 1.0 |
| Owner | Application Architecture |
| Reviewers | Domain, Integration, Security, Frontend, QA |
| Last Updated | 2026-07-11 |
| Related Documents | [Requirements](product-requirements.md), [Architecture](system-architecture.md), [Domain](domain-model.md), [Permissions](roles-and-permissions.md), [Integration](integration-design.md) |
| Assumptions | REST JSON over TLS; `/api/v1`; local session for UI and service credentials for adapters |
| Open Decisions | Internal API gateway product; maximum payload/file sizes; external authentication standard; rate-limit values |

## 1. Conventions

- Base path `/api/v1`; plural resources; UTF-8 JSON; timestamps ISO-8601 UTC; money `{amount, currency}`
- Opaque stable IDs; client ห้ามตีความรูปแบบ ID
- Request headers: `X-Correlation-Id`; mutating retriable operations ใช้ `Idempotency-Key`
- Resource response มี `id`, `version`, `createdAt`, `updatedAt`; update ใช้ `If-Match`/version และคืน `409 VERSION_CONFLICT` เมื่อ stale (NFR-004)
- Server enforce authentication, scoped authorization, validation และ workflow transition ทุกครั้ง (SEC-002)
- Sensitive fields และ allowed actions ถูก shape ตาม policy; ห้ามพึ่ง UI ซ่อนปุ่ม

## 2. Resource surface

| Domain | Endpoints (representative) | Requirements |
|---|---|---|
| Customer | `/customers`, `/customers/{id}`, `/customers/{id}/contacts`, `/customers/{id}/relationships`, `/customers/{id}/ownership` | BR-001, FR-001, FR-010 |
| Lead/Activity | `/leads`, `/leads/{id}/transitions`, `/activities` | FR-002, FR-003 |
| Opportunity | `/opportunities`, `/opportunities/{id}/transitions`, `/opportunities/{id}/timeline` | FR-004 |
| Presales | `/products`, `/coverage-checks`, `/solutions` | FR-005 |
| Commercial | `/quotes`, `/quotes/{id}/versions`, `/quotes/{id}/submit`, `/approval-requests/{id}/decisions` | FR-006, FR-007 |
| Order | `/internal-orders`, `/internal-orders/{id}/handoffs`, `/internal-orders/{id}/acknowledge` | FR-008 |
| Forecast | `/forecasts/snapshots`, `/forecasts/summary`, `/forecasts/quality` | FR-009 |
| Jobs | `/imports`, `/exports`, `/jobs/{id}`, `/jobs/{id}/cancel` | FR-011, OPS-002 |
| Administration | `/users`, `/role-assignments`, `/audit-events` | SEC-001, SEC-002, COMP-001 |

## 3. Query, filter and pagination

`GET /customers?limit=50&cursor=...&sort=updatedAt:desc&segment=B1&ownerId=...&q=...`

- Default 50, maximum 200; response มี `nextCursor`, ไม่มี total exact โดย default
- Filter/sort allowlist ต่อ resource; invalid filter คืน 400
- `q` ใช้ OpenSearch; exact ID/external ID ใช้ transactional lookup
- Cursor signed/opaque และผูก query shape; ห้าม offset สำหรับ large collections (FR-010, NFR-001)
- Exact total เป็น asynchronous/reporting operation เมื่อ expensive

```json
{
  "data": [{"id":"cus_...","version":7,"name":"Example","allowedActions":["view","update"]}],
  "page": {"limit":50,"nextCursor":"opaque","hasMore":true},
  "meta": {"correlationId":"...","searchFreshnessAt":"2026-07-11T02:00:00Z"}
}
```

## 4. Error contract

```json
{
  "error": {
    "code": "OPPORTUNITY_TRANSITION_DENIED",
    "message": "ไม่สามารถเปลี่ยนสถานะได้",
    "fieldErrors": [{"field":"coverageStatus","code":"REQUIRED"}],
    "retryable": false,
    "correlationId": "..."
  }
}
```

ใช้ 400 validation, 401 unauthenticated, 403 unauthorized, 404 not found (ไม่เปิดเผย cross-scope existence), 409 conflict/idempotency, 422 business rule, 429 rate limit, 503 dependency unavailable

## 5. Representative contracts

### Create customer

`POST /api/v1/customers` + `Idempotency-Key`

```json
{"legalName":"บริษัท ตัวอย่าง จำกัด","customerType":"B2B","segment":"B1","externalIds":[{"source":"CRM","value":"123"}],"ownerId":"usr_...","organizationUnitId":"ou_..."}
```

คืน `201`, resource + `Location`; duplicate candidate คืน `409 DUPLICATE_CANDIDATE` พร้อม candidate IDs ที่ caller มีสิทธิ์เห็นและ override token/reason flow (FR-001, DATA-003)

### Opportunity transition

`POST /api/v1/opportunities/{id}/transitions`

```json
{"targetStage":"PROPOSAL","reason":"Solution and coverage confirmed","expectedVersion":12}
```

ตรวจ [opportunity-workflow.md](opportunity-workflow.md), permission และ required fields แล้ว append stage history/audit ใน transaction เดียว

### Submit quote / approval decision

`POST /quotes/{id}/submit` ระบุ `quoteVersion`; สร้าง policy snapshot/approval request แบบ idempotent

`POST /approval-requests/{id}/decisions`

```json
{"decision":"APPROVE","comment":"Within delegated authority","expectedVersion":3}
```

ผู้ submit ห้าม approve ขั้นของตนเมื่อ SoD บังคับ (BR-004, FR-007)

## 6. Async jobs

Import request ใช้ multipart upload ไป object staging หรือ pre-signed private upload แล้ว `POST /imports`; คืน `202` + job URL สถานะ `QUEUED/RUNNING/NEEDS_REVIEW/COMPLETED/FAILED/CANCELLED` Preview และ promote เป็นคนละ command; export คืน expiring authorized object reference (FR-011, DATA-003)

## 7. Event/webhook envelope

```json
{
  "eventId":"evt_...","eventType":"OpportunityStageChanged","eventVersion":1,
  "occurredAt":"2026-07-11T02:00:00Z","aggregateId":"opp_...","aggregateVersion":13,
  "actor":{"type":"USER","id":"usr_..."},"correlationId":"...","payload":{}
}
```

Consumer deduplicate ด้วย `eventId`; breaking payload ใช้ event version ใหม่; webhook มี signature, timestamp/replay protection, retry และ delivery log (INT-003)

## 8. Versioning and lifecycle

- Additive compatible changes อยู่ใน v1; rename/remove/semantic break ต้อง v2
- Deprecation มี owner, usage evidence, migration guide และ approved sunset
- OpenAPI เป็น contract source; CI lint + backward compatibility + generated contract tests
- API audit ระบุ actor/client, scope, target, outcome และ correlation ID โดย redact secrets/PII
